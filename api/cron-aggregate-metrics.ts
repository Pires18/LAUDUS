import { getDb } from './_firebase.js';

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
      users: Set<string>;
    };
    const byDay: Record<string, DayAgg> = {};

    snap.forEach((doc: any) => {
      const d = doc.data() || {};
      const ts = typeof d.timestamp === 'number' ? d.timestamp : now;
      const day = new Date(ts).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
      const uid = doc.ref.parent?.parent?.id || 'unknown';
      const isPro = /pro/i.test(String(d.model || ''));
      const b = byDay[day] || (byDay[day] = {
        reports: 0, reportsLite: 0, reportsPro: 0,
        inputTokens: 0, outputTokens: 0, costUsd: 0, users: new Set<string>(),
      });
      b.reports += 1;
      if (isPro) b.reportsPro += 1; else b.reportsLite += 1;
      b.inputTokens += Number(d.inputTokens) || 0;
      b.outputTokens += Number(d.outputTokens) || 0;
      b.costUsd += Number(d.costUsd) || 0;
      b.users.add(uid);
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
        activeUsers: b.users.size,
        updatedAt: Date.now(),
      }, { merge: true });
    }
    await batch.commit();

    return res.status(200).json({ ok: true, daysWritten: Object.keys(byDay).length, eventsScanned: snap.size });
  } catch (e: any) {
    console.error('[CRON aggregate-metrics] Erro:', e?.message);
    return res.status(500).json({ error: e?.message || 'Falha na agregação.' });
  }
}
