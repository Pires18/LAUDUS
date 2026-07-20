import { getDb, getAdminAuth } from './_firebase.js';

/**
 * Cadastra (ou atualiza) o login de RECEPÇÃO de uma clínica do chamador.
 *
 * Diferente do convite (api/clinic-invite.ts), que exige uma conta LAUD.US
 * pré-existente, aqui o dono da clínica CRIA a conta da recepção (e-mail +
 * senha) direto do módulo Clínicas — Admin SDK cria o usuário no Firebase
 * Auth, grava users/{uid} com role 'recepcao' (sem privilégios/cota) e o
 * vínculo em clinic_memberships com role 'recepcao'.
 *
 * Se o e-mail já existir, só permite reaproveitar/redefinir a senha quando a
 * conta foi criada por ESTE dono (users/{uid}.receptionOwnerUid == caller) —
 * impede que alguém "sequestre" uma conta alheia apontando o e-mail dela.
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

    const { clinicId, email, password, displayName } = req.body || {};
    if (!clinicId || !email || !password) {
      return res.status(400).json({ error: 'clinicId, email e password são obrigatórios.' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });
    }

    const db = await getDb();

    // Só o dono da clínica (ou admin) pode cadastrar a recepção dela.
    const callerSnap = await db.collection('users').doc(ownerUid).get();
    const callerRole = callerSnap.exists ? callerSnap.data()?.role : null;
    const clinicSnap = await db.collection('users').doc(ownerUid).collection('clinics').doc(clinicId).get();
    if (!clinicSnap.exists && callerRole !== 'admin') {
      return res.status(404).json({ error: 'Clínica não encontrada para este usuário.' });
    }

    // Cria a conta — ou reaproveita se já for uma conta de recepção deste dono.
    let receptionUid: string;
    let created = false;
    try {
      const existing = await auth.getUserByEmail(cleanEmail);
      const existingDoc = await db.collection('users').doc(existing.uid).get();
      const receptionOwnerUid = existingDoc.exists ? existingDoc.data()?.receptionOwnerUid : null;
      if (receptionOwnerUid !== ownerUid && callerRole !== 'admin') {
        return res.status(409).json({
          error: 'Este e-mail já pertence a outra conta LAUD.US. Use um e-mail dedicado à recepção, ou convide a conta existente pela Equipe da Clínica.',
        });
      }
      // Conta de recepção deste dono: redefine a senha e atualiza o nome.
      await auth.updateUser(existing.uid, {
        password: String(password),
        ...(displayName ? { displayName: String(displayName) } : {}),
      });
      receptionUid = existing.uid;
    } catch (err: any) {
      if (err?.code && err.code !== 'auth/user-not-found') throw err;
      const record = await auth.createUser({
        email: cleanEmail,
        password: String(password),
        displayName: displayName ? String(displayName) : 'Recepção',
        emailVerified: true,
      });
      receptionUid = record.uid;
      created = true;
    }

    const now = Date.now();

    // Doc do usuário: role 'recepcao', sem privilégio/cota de laudos.
    await db.collection('users').doc(receptionUid).set({
      name: displayName ? String(displayName) : 'Recepção',
      displayName: displayName ? String(displayName) : 'Recepção',
      email: cleanEmail,
      role: 'recepcao',
      active: true,
      receptionOwnerUid: ownerUid,
      updatedAt: now,
      ...(created ? { createdAt: now } : {}),
    }, { merge: true });

    // Vínculo com a clínica (papel 'recepcao').
    const membershipId = `${ownerUid}_${clinicId}_${receptionUid}`;
    await db.collection('clinic_memberships').doc(membershipId).set({
      ownerId: ownerUid,
      clinicId,
      memberUid: receptionUid,
      memberEmail: cleanEmail,
      role: 'recepcao',
      invitedByUid: ownerUid,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    return res.status(200).json({ success: true, membershipId, created });
  } catch (error: any) {
    console.error('[CLINIC-RECEPTION] Erro:', error);
    return res.status(500).json({ error: error.message || 'Erro interno ao cadastrar login de recepção.' });
  }
}
