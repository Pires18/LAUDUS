/**
 * LAUD.US — Limpeza das anamneses padrão das máscaras de laudo
 *
 * O que faz:
 *   Percorre TODAS as máscaras de laudo do administrador
 *   (users/{ADMIN_UID}/templates) e ZERA o campo `anamnesisTemplate`,
 *   deixando a anamnese padrão em branco. O campo de anamnese permanece
 *   plenamente funcional e ligado em todo o fluxo (criação → editor → IA →
 *   exportação) — apenas deixa de vir pré-preenchido a partir da máscara.
 *
 * Por que via script:
 *   O editor de máscaras não possui campo de "anamnese padrão"; os valores
 *   existentes vieram dos scripts de seed. Esta é uma migração única de dados.
 *
 * Uso:
 *   node scripts/clear-anamnesis-templates.mjs <email_admin> <senha_admin>
 *   node scripts/clear-anamnesis-templates.mjs <email_admin> <senha_admin> --dry-run
 *
 *   --dry-run  apenas lista o que seria alterado, sem gravar.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// ─── Firebase config (mesmo projeto dos demais scripts) ─────────────────────
const CONFIG = {
  apiKey:            'AIzaSyAVqN1pcxvcgxmZRt_-dCJCdg0Y4XK2Ixk',
  authDomain:        'antigravity-laudus.firebaseapp.com',
  projectId:         'antigravity-laudus',
  storageBucket:     'antigravity-laudus.firebasestorage.app',
  messagingSenderId: '542081396849',
  appId:             '1:542081396849:web:f80667d559e5a30b36abd0',
};
const ADMIN_UID = 'unU2WjwHXYac5lZgiqXMgcWxoBA3';
const CHUNK = 400;

async function main() {
  const [email, password, flag] = process.argv.slice(2);
  const dryRun = flag === '--dry-run';

  if (!email || !password) {
    console.log('Uso: node scripts/clear-anamnesis-templates.mjs <email_admin> <senha_admin> [--dry-run]');
    process.exit(1);
  }

  const app  = initializeApp(CONFIG);
  const auth = getAuth(app);
  const db   = getFirestore(app);

  console.log(`→ Autenticando como ${email}...`);
  await signInWithEmailAndPassword(auth, email, password);

  const colRef = collection(db, `users/${ADMIN_UID}/templates`);
  const snap = await getDocs(colRef);
  console.log(`→ ${snap.size} máscaras encontradas.`);

  // Apenas as que possuem anamnesisTemplate não-vazio precisam de mudança.
  const toClear = snap.docs.filter((d) => {
    const v = d.data().anamnesisTemplate;
    return typeof v === 'string' && v.trim().length > 0;
  });

  console.log(`→ ${toClear.length} máscaras com anamnese padrão a limpar:`);
  toClear.forEach((d) => console.log(`   • ${d.data().name || d.id}`));

  if (toClear.length === 0) {
    console.log('\n✓ Nenhuma anamnese padrão para limpar. Tudo já está em branco.');
    process.exit(0);
  }

  if (dryRun) {
    console.log('\n(--dry-run) Nada foi gravado.');
    process.exit(0);
  }

  for (let i = 0; i < toClear.length; i += CHUNK) {
    const batch = writeBatch(db);
    const chunk = toClear.slice(i, i + CHUNK);
    for (const d of chunk) {
      batch.update(doc(db, `users/${ADMIN_UID}/templates`, d.id), {
        anamnesisTemplate: '',
        updatedAt: Date.now(),
      });
    }
    await batch.commit();
    console.log(`✓ Lote ${Math.floor(i / CHUNK) + 1} gravado (${chunk.length} máscaras).`);
  }

  console.log(`\n✓ Concluído. Anamnese padrão zerada em ${toClear.length} máscara(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error('✗ Erro:', err?.message || err);
  process.exit(1);
});
