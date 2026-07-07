import { describe, it, expect, afterEach } from 'vitest';
import crypto from 'crypto';
import { verifyWebhook, markEventProcessedOnce } from '../../api/abacatepay-webhook';

/**
 * Fake mínimo de Firestore Admin — só a fatia usada por markEventProcessedOnce
 * (collection().doc(), runTransaction com tx.get/tx.set). Não substitui um
 * emulador real, mas é suficiente pra travar a semântica de idempotência.
 */
function fakeDb() {
  const store = new Map<string, any>();
  // Firestore serializa transações reais (isolamento via retry otimista) — o fake
  // encadeia execuções pra reproduzir essa garantia; sem isso, duas transações
  // "concorrentes" via Promise.all poderiam intercalar e as duas lerem exists:false.
  let chain: Promise<void> = Promise.resolve();
  return {
    store,
    collection: (name: string) => ({
      doc: (id: string) => ({ key: `${name}/${id}` }),
    }),
    runTransaction: (fn: (tx: any) => Promise<void>) => {
      const run = chain.then(async () => {
        const tx = {
          get: async (ref: { key: string }) => ({ exists: store.has(ref.key) }),
          set: (ref: { key: string }, data: any) => { store.set(ref.key, data); },
        };
        await fn(tx);
      });
      chain = run.catch(() => {}); // uma transação que lança não trava as próximas
      return run;
    },
  };
}

/**
 * Verificação de autenticidade do webhook de pagamento — é a única barreira entre
 * a internet aberta e conceder plano/add-on de graça. Testada por ser dinheiro.
 */
function reqWith(opts: { signature?: string; querySecret?: string }): any {
  return {
    headers: opts.signature ? { 'x-webhook-signature': opts.signature } : {},
    query: opts.querySecret ? { webhookSecret: opts.querySecret } : {},
  };
}

const SECRET = 'super-secret-webhook-key';
const BODY = JSON.stringify({ event: 'subscription.completed', data: { id: 'evt_1' } });

afterEach(() => {
  delete process.env.VERCEL_ENV;
});

describe('verifyWebhook', () => {
  it('aceita assinatura HMAC-SHA256 em hex correta', () => {
    const digestHex = crypto.createHmac('sha256', SECRET).update(BODY).digest('hex');
    const r = verifyWebhook(reqWith({ signature: digestHex }), BODY, SECRET);
    expect(r.ok).toBe(true);
  });

  it('aceita assinatura HMAC-SHA256 em base64 correta', () => {
    const digestB64 = crypto.createHmac('sha256', SECRET).update(BODY).digest('base64');
    const r = verifyWebhook(reqWith({ signature: digestB64 }), BODY, SECRET);
    expect(r.ok).toBe(true);
  });

  it('rejeita assinatura incorreta', () => {
    const r = verifyWebhook(reqWith({ signature: 'assinatura-forjada' }), BODY, SECRET);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/inválida/i);
  });

  it('rejeita assinatura calculada com corpo diferente (protege contra replay com payload alterado)', () => {
    const digestHex = crypto.createHmac('sha256', SECRET).update('{"event":"outro"}').digest('hex');
    const r = verifyWebhook(reqWith({ signature: digestHex }), BODY, SECRET);
    expect(r.ok).toBe(false);
  });

  it('rejeita assinatura calculada com o segredo errado', () => {
    const digestHex = crypto.createHmac('sha256', 'segredo-errado').update(BODY).digest('hex');
    const r = verifyWebhook(reqWith({ signature: digestHex }), BODY, SECRET);
    expect(r.ok).toBe(false);
  });

  it('aceita fallback por query string quando o secret bate', () => {
    const r = verifyWebhook(reqWith({ querySecret: SECRET }), BODY, SECRET);
    expect(r.ok).toBe(true);
  });

  it('rejeita fallback por query string quando o secret não bate', () => {
    const r = verifyWebhook(reqWith({ querySecret: 'chute' }), BODY, SECRET);
    expect(r.ok).toBe(false);
  });

  it('rejeita quando não há assinatura nem segredo na query (mas secret está configurado)', () => {
    const r = verifyWebhook(reqWith({}), BODY, SECRET);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/ausente/i);
  });

  it('sem secret configurado e fora de produção → aceita (bypass de dev)', () => {
    delete process.env.VERCEL_ENV;
    const r = verifyWebhook(reqWith({}), BODY, '');
    expect(r.ok).toBe(true);
  });

  it('sem secret configurado EM PRODUÇÃO → rejeita sempre (não pode haver bypass em prod)', () => {
    process.env.VERCEL_ENV = 'production';
    const r = verifyWebhook(reqWith({}), BODY, '');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/não configurado/i);
  });

  it('prioriza a assinatura HMAC sobre a query string quando ambas presentes', () => {
    // Query teria o secret certo, mas a assinatura no header está forjada — deve
    // rejeitar (o header, quando presente, é a via preferencial e é verificado
    // primeiro; um valor inválido ali não deve "cair" para o fallback de query).
    const r = verifyWebhook(reqWith({ signature: 'forjada', querySecret: SECRET }), BODY, SECRET);
    expect(r.ok).toBe(false);
  });
});

describe('markEventProcessedOnce (idempotência de webhook)', () => {
  it('primeira vez → processa (duplicate:false) e registra o evento', async () => {
    const db = fakeDb();
    const r = await markEventProcessedOnce(db, 'evt_123', 'subscription.completed');
    expect(r.duplicate).toBe(false);
    expect(db.store.has('webhook_events/evt_123')).toBe(true);
  });

  it('segunda vez com o MESMO eventId → ignora como duplicado, não reprocessa', async () => {
    const db = fakeDb();
    const first = await markEventProcessedOnce(db, 'evt_123', 'subscription.completed');
    const second = await markEventProcessedOnce(db, 'evt_123', 'subscription.completed');
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
  });

  it('eventIds diferentes são processados independentemente', async () => {
    const db = fakeDb();
    const a = await markEventProcessedOnce(db, 'evt_a', 'subscription.completed');
    const b = await markEventProcessedOnce(db, 'evt_b', 'subscription.completed');
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(false);
  });

  it('retries concorrentes do mesmo evento (2 chamadas em paralelo) → só uma processa', async () => {
    const db = fakeDb();
    const [a, b] = await Promise.all([
      markEventProcessedOnce(db, 'evt_race', 'subscription.completed'),
      markEventProcessedOnce(db, 'evt_race', 'subscription.completed'),
    ]);
    const duplicates = [a.duplicate, b.duplicate].filter(Boolean).length;
    expect(duplicates).toBe(1);
  });
});
