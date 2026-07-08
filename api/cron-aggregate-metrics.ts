import { getDb } from './_firebase.js';
import { intervalMultiplier } from './_pricing.js';

/**
 * MRR/ARR a partir das assinaturas — soma o preço mensal-equivalente de cada
 * assinatura `active`/`trialing`, usando o preço/intervalo TRAVADOS na própria
 * assinatura (nunca o preço vigente no catálogo `saas_plans`, que pode ter
 * mudado desde a venda). Espelha a lógica já correta em produção no painel
 * "Receita por Intervalo" (FinanceOverviewTab.tsx). Extraída p/ ser testável
 * sem Firestore — antes o cálculo inline aqui só tratava `interval==='year'`
 * como não-mensal (semestral contava o preço cheio como se fosse mensal, 6x
 * de superestimação) e relia o preço atual do plano em vez do da assinatura.
 */
export function computeMrr(
  subscriptions: Array<{ status?: string; price?: number; interval?: string }>
): { mrr: number; activeSubscribers: number; trials: number } {
  let mrr = 0, activeSubscribers = 0, trials = 0;
  for (const d of subscriptions) {
    if (d.status === 'active') activeSubscribers += 1;
    else if (d.status === 'trialing') trials += 1;
    else continue;
    mrr += (Number(d.price) || 0) / intervalMultiplier(d.interval || 'month');
  }
  return { mrr: Math.round(mrr * 100) / 100, activeSubscribers, trials };
}

/**
 * CRON — Agregação diária de telemetria de IA para o painel admin.
 *
 * Problema que resolve: `ai_usage` é uma subcoleção POR usuário
 * (`users/{uid}/ai_usage`), então o admin não conseguia ver o uso do sistema
 * inteiro (só o próprio). Aqui, com o Admin SDK (ignora as regras), fazemos uma
 * **collection-group query** sobre todos os `ai_usage` e consolidamos por dia em
 * `metrics_daily/{YYYY-MM-DD}` — que o painel lê barato (poucos docs).
 *
 * Reagrega as últimas 48h a cada execução (idempotente via `set`): captura
 * eventos que chegaram atrasados e recomputa os totais do dia sem duplicar.
 *
 * Protegido por CRON_SECRET (Vercel envia `Authorization: Bearer <CRON_SECRET>`).
 */
export default async function handler(req: any, res: any) {
  const secret = (process.env.CRON_SECRET || '').trim();
  const authHeader = req.headers.authorization || '';
  const provided = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : String(req.query?.secret || '');
  if (!secret || provided !== secret) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  try {
    const db = await getDb();
    const now = Date.now();
    const windowStart = now - 2 * 24 * 60 * 60 * 1000; // últimas 48h

    const snap = await db
      .collectionGroup('ai_usage')
      .where('timestamp', '>=', windowStart)
      .get();

    type DayAgg = {
      reports: number; reportsLite: number; reportsPro: number;
      inputTokens: number; outputTokens: number; costUsd: number;
      revenue: number; revenueByMethod: Record<string, number>; countByMethod: Record<string, number>;
      revenueByInterval: Record<string, number>;
      users: Set<string>;
    };
    const byDay: Record<string, DayAgg> = {};
    const mkDay = (): DayAgg => ({
      reports: 0, reportsLite: 0, reportsPro: 0,
      inputTokens: 0, outputTokens: 0, costUsd: 0, revenue: 0, revenueByMethod: {}, countByMethod: {},
      revenueByInterval: {}, users: new Set<string>(),
    });

    snap.forEach((doc: any) => {
      const d = doc.data() || {};
      const ts = typeof d.timestamp === 'number' ? d.timestamp : now;
      const day = new Date(ts).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
      const uid = doc.ref.parent?.parent?.id || 'unknown';
      const isPro = /pro/i.test(String(d.model || ''));
      const b = byDay[day] || (byDay[day] = mkDay());
      b.reports += 1;
      if (isPro) b.reportsPro += 1; else b.reportsLite += 1;
      b.inputTokens += Number(d.inputTokens) || 0;
      b.outputTokens += Number(d.outputTokens) || 0;
      b.costUsd += Number(d.costUsd) || 0;
      b.users.add(uid);
    });

    // Receita por dia (transações pagas na janela). where só no timestamp
    // (single-field) e filtro de status em memória — evita índice composto.
    const txSnap = await db.collection('transactions').where('timestamp', '>=', windowStart).get();
    txSnap.forEach((doc: any) => {
      const t = doc.data() || {};
      if (t.status !== 'paid') return;
      const day = new Date(typeof t.timestamp === 'number' ? t.timestamp : now).toISOString().slice(0, 10);
      const b = byDay[day] || (byDay[day] = mkDay());
      const amount = Number(t.amount) || 0;
      b.revenue += amount;
      const method = String(t.paymentMethod || 'unknown');
      b.revenueByMethod[method] = (b.revenueByMethod[method] || 0) + amount;
      b.countByMethod[method] = (b.countByMethod[method] || 0) + 1;
      // Só transações de ASSINATURA têm `interval` (add-ons não são recorrentes
      // por definição) — usado pra separar caixa mensal-recorrente de compra
      // avulsa semestral/anual na reconciliação (evita falso-positivo em mês
      // com renovação avulsa, ver FinanceOverviewTab).
      if (t.type === 'subscription') {
        const iv = String(t.interval || 'month');
        b.revenueByInterval[iv] = (b.revenueByInterval[iv] || 0) + amount;
      }
    });

    const batch = db.batch();
    for (const [day, b] of Object.entries(byDay)) {
      batch.set(db.collection('metrics_daily').doc(day), {
        date: day,
        reports: b.reports,
        reportsLite: b.reportsLite,
        reportsPro: b.reportsPro,
        inputTokens: b.inputTokens,
        outputTokens: b.outputTokens,
        costUsd: Math.round(b.costUsd * 10000) / 10000,
        revenue: Math.round(b.revenue * 100) / 100,
        revenueByMethod: Object.fromEntries(
          Object.entries(b.revenueByMethod).map(([k, v]) => [k, Math.round(v * 100) / 100])
        ),
        countByMethod: b.countByMethod,
        revenueByInterval: Object.fromEntries(
          Object.entries(b.revenueByInterval).map(([k, v]) => [k, Math.round(v * 100) / 100])
        ),
        activeUsers: b.users.size,
        updatedAt: Date.now(),
      }, { merge: true });
    }
    await batch.commit();

    // MRR / ARR — ver computeMrr() acima. Guardado em metrics_daily/_summary
    // (mesma regra admin-only). Sem campo `date`, então não aparece nas
    // consultas por intervalo de datas.
    try {
      const subsSnap = await db.collection('subscriptions').get();
      const { mrr, activeSubscribers, trials } = computeMrr(subsSnap.docs.map((s: any) => s.data() || {}));
      await db.collection('metrics_daily').doc('_summary').set({
        mrr,
        arr: Math.round(mrr * 12 * 100) / 100,
        activeSubscribers,
        trials,
        updatedAt: Date.now(),
      }, { merge: true });
    } catch (e: any) {
      console.warn('[CRON aggregate-metrics] Falha no resumo MRR (ignorado):', e?.message);
    }

    return res.status(200).json({ ok: true, daysWritten: Object.keys(byDay).length, eventsScanned: snap.size });
  } catch (e: any) {
    console.error('[CRON aggregate-metrics] Erro:', e?.message);
    return res.status(500).json({ error: e?.message || 'Falha na agregação.' });
  }
}
