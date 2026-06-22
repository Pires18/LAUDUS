import { getDb, getAdminAuth } from './_firebase.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { userId, email } = req.body || {};
    if (!userId || !email) {
      return res.status(400).json({ error: 'userId e email são obrigatórios.' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autorizado. Token ausente.' });
    }
    const token = authHeader.split('Bearer ')[1];

    const auth = await getAdminAuth();
    const decodedToken = await auth.verifyIdToken(token);
    const authEmail = decodedToken.email || '';
    const authUid   = decodedToken.uid;

    const SUPER_ADMIN_EMAIL = 'matheuskpires@gmail.com';
    if (
      authEmail.trim().toLowerCase() !== SUPER_ADMIN_EMAIL ||
      email.trim().toLowerCase()     !== SUPER_ADMIN_EMAIL ||
      authUid !== userId
    ) {
      console.warn(`[PROMOTE-ADMIN] Tentativa não autorizada: UID ${authUid} (${authEmail})`);
      return res.status(403).json({ error: 'Apenas o Super Admin pode ser promovido.' });
    }

    const db = await getDb();
    await db.collection('users').doc(userId).set({ role: 'admin', updatedAt: Date.now() }, { merge: true });

    console.log(`[PROMOTE-ADMIN] Super Admin promovido: UID ${userId}`);
    return res.status(200).json({ success: true, message: 'Super Admin promovido com sucesso.' });

  } catch (error: any) {
    console.error('[PROMOTE-ADMIN] Erro:', error);
    return res.status(500).json({ error: error.message });
  }
}
