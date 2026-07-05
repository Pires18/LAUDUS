import { getDb, getAdminAuth } from './_firebase.js';

const VALID_ROLES = ['editor', 'viewer'];

/**
 * Convida um usuário existente para colaborar em uma clínica do chamador.
 *
 * A criação de `clinic_memberships/*` é bloqueada para o cliente nas regras
 * do Firestore (só o dono/admin da clínica pode convidar, e é preciso
 * resolver e-mail→uid, o que exige Admin SDK) — por isso passa por aqui.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autorizado. Token ausente.' });
    }
    const token = authHeader.split('Bearer ')[1];
    const auth = await getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    const ownerUid = decoded.uid;

    const { clinicId, inviteEmail, role } = req.body || {};
    if (!clinicId || !inviteEmail || !role) {
      return res.status(400).json({ error: 'clinicId, inviteEmail e role são obrigatórios.' });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `role deve ser um de: ${VALID_ROLES.join(', ')}.` });
    }

    const db = await getDb();

    // Só o dono da clínica (ou admin) pode convidar.
    const callerSnap = await db.collection('users').doc(ownerUid).get();
    const callerRole = callerSnap.exists ? callerSnap.data()?.role : null;
    const clinicSnap = await db.collection('users').doc(ownerUid).collection('clinics').doc(clinicId).get();
    if (!clinicSnap.exists && callerRole !== 'admin') {
      return res.status(404).json({ error: 'Clínica não encontrada para este usuário.' });
    }

    let memberRecord;
    try {
      memberRecord = await auth.getUserByEmail(String(inviteEmail).trim().toLowerCase());
    } catch {
      return res.status(404).json({ error: 'Nenhum usuário LAUD.US cadastrado com este e-mail. Peça para a pessoa criar a conta primeiro.' });
    }

    if (memberRecord.uid === ownerUid) {
      return res.status(400).json({ error: 'Você já tem acesso total às suas próprias clínicas.' });
    }

    const membershipId = `${ownerUid}_${clinicId}_${memberRecord.uid}`;
    const now = Date.now();
    await db.collection('clinic_memberships').doc(membershipId).set({
      ownerId: ownerUid,
      clinicId,
      memberUid: memberRecord.uid,
      memberEmail: memberRecord.email || inviteEmail,
      role,
      invitedByUid: ownerUid,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    return res.status(200).json({ success: true, membershipId });
  } catch (error: any) {
    console.error('[CLINIC-INVITE] Erro:', error);
    return res.status(500).json({ error: error.message || 'Erro interno ao convidar usuário.' });
  }
}
