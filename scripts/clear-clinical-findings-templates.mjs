/**
 * LAUD.US — Limpeza do "Achados Clínicos" padrão das máscaras de laudo,
 * EXCETO Medicina Fetal.
 *
 * O que faz:
 *   Percorre TODAS as máscaras de laudo do administrador
 *   (users/{ADMIN_UID}/templates) e ZERA o campo `customForm` (o texto que
 *   pré-preenche a caixa "Achados Clínicos" do Copiloto em todo exame NOVO
 *   daquela máscara) nas máscaras cuja `area` NÃO seja 'medicina-fetal'.
 *   Máscaras de Medicina Fetal são preservadas intactas.
 *
 * Por que isso é necessário além de scripts/clear-clinical-findings.mjs:
 *   Aquele script limpa o campo já preenchido nos EXAMES EXISTENTES.
 *   Mas todo exame NOVO herda o texto padrão da própria máscara
 *   (`exam.customFormValue ?? template?.customForm`) — sem limpar aqui, o
 *   texto continua "reaparecendo" em cada exame criado dali pra frente.
 *
 * Uso:
 *   node scripts/clear-clinical-findings-templates.mjs <email_admin> <senha_admin>
 *   node scripts/clear-clinical-findings-templates.mjs <email_admin> <senha_admin> --dry-run
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
const EXCLUDED_AREA = 'medicina-fetal';
const CHUNK = 400;

async function main() {
  const [email, password, flag] = process.argv.slice(2);
  const dryRun = flag === '--dry-run';

  if (!email || !password) {
    console.log('Uso: node scripts/clear-clinical-findings-templates.mjs <email_admin> <senha_admin> [--dry-run]');
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

  // Só as fora de Medicina Fetal, com customForm não-vazio.
  const toClear = snap.docs.filter((d) => {
    const data = d.data();
    if (data.area === EXCLUDED_AREA) return false;
    const v = data.customForm;
    return typeof v === 'string' && v.trim().length > 0;
  });

  const preserved = snap.docs.filter((d) => d.data().area === EXCLUDED_AREA).length;

  console.log(`→ ${preserved} máscara(s) de Medicina Fetal preservada(s).`);
  console.log(`→ ${toClear.length} máscara(s) fora de Medicina Fetal com "Achados Clínicos" padrão a limpar:`);
  toClear.forEach((d) => console.log(`   • [${d.data().area}] ${d.data().name || d.id}`));

  if (toClear.length === 0) {
    console.log('\n✓ Nenhuma máscara fora de Medicina Fetal com texto padrão. Tudo já está em branco.');
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
        customForm: '',
        updatedAt: Date.now(),
      });
    }
    await batch.commit();
    console.log(`✓ Lote ${Math.floor(i / CHUNK) + 1} gravado (${chunk.length} máscaras).`);
  }

  console.log(`\n✓ Concluído. "Achados Clínicos" padrão zerado em ${toClear.length} máscara(s). Medicina Fetal preservada.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('✗ Erro:', err?.message || err);
  process.exit(1);
});
