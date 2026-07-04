import { getDb } from './_firebase.js';
import { verifyAuth, isAdmin } from './_auth.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // Endpoint administrativo: só o admin autenticado pode validar a chave da AbacatePay.
  const authed = await verifyAuth(req);
  if (!authed) return res.status(401).json({ ok: false, error: 'Não autenticado.' });
  const db = await getDb();
  if (!(await isAdmin(db, authed.uid))) {
    return res.status(403).json({ ok: false, error: 'Apenas administradores.' });
  }

  const apiKey = (req.body?.apiKey || '').trim();
  if (!apiKey) {
    return res.status(200).json({ ok: false, error: 'API Key não fornecida.' });
  }

  try {
    const response = await fetch('https://api.abacatepay.com/v2/checkouts/list', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    let body: any = null;
    try { body = await response.json(); } catch { /* ignore */ }

    if (body?.success === true) {
      return res.status(200).json({ ok: true, message: 'Conexão com AbacatePay v2 estabelecida com sucesso.' });
    }

    if (response.status === 401 || response.status === 403) {
      return res.status(200).json({ ok: false, error: 'Chave inválida ou inativa. Verifique no painel AbacatePay.' });
    }

    if (body?.error) {
      return res.status(200).json({ ok: false, error: `AbacatePay: ${body.error}` });
    }

    return res.status(200).json({ ok: false, error: `AbacatePay respondeu HTTP ${response.status}.` });

  } catch (err: any) {
    return res.status(200).json({ ok: false, error: `Falha de rede: ${err.message}` });
  }
}
