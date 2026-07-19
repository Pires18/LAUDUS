/**
 * LAUD.US — Limpeza do campo "Achados Clínicos" em todos os exames do
 * sistema, EXCETO Medicina Fetal.
 *
 * O que faz:
 *   Percorre TODOS os exames de TODOS os usuários (collectionGroup('exams'))
 *   e ZERA o campo `customFormValue` ("Achados Clínicos", aba Formulário do
 *   Copiloto) nos exames cuja `area` NÃO seja 'medicina-fetal'. Exames de
 *   Medicina Fetal são preservados intactos. Não toca em anamnese, dados
 *   estruturados ou no laudo final (reportContent).
 *
 * Por que via script (e não pela UI):
 *   Operação administrativa única, no sistema inteiro — requer a Service
 *   Account (Firebase Admin), que ignora as regras de segurança por usuário,
 *   já que os exames vivem em `users/{uid}/exams` (por médico).
 *
 * Segurança:
 *   - Roda em modo DRY-RUN por padrão: só lista o que seria alterado.
 *   - Sempre grava um relatório JSON (path, área, tipo, paciente, e um
 *     preview do texto) de tudo que seria/foi apagado, ANTES de gravar —
 *     serve de backup manual pra recuperação se necessário.
 *   - Só grava de verdade com a flag --confirm.
 *
 * Uso:
 *   node scripts/clear-clinical-findings.mjs               (dry-run)
 *   node scripts/clear-clinical-findings.mjs --confirm      (grava de verdade)
 *
 * Requer no .env: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 * (as mesmas credenciais já usadas pelas funções serverless em api/_firebase.ts).
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, 'utf-8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    val = val.replace(/\\n/g, '\n');
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const EXCLUDED_AREA = 'medicina-fetal';
const CHUNK = 400;

async function main() {
  loadDotEnv();
  const confirm = process.argv.includes('--confirm');

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    console.error('✗ Faltam credenciais no .env (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY).');
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  const db = getFirestore();

  console.log('→ Buscando todos os exames do sistema (collectionGroup "exams")...');
  const snap = await db.collectionGroup('exams').get();
  console.log(`→ ${snap.size} exames encontrados no total.`);

  const toClear = snap.docs.filter((d) => {
    const data = d.data();
    if (data.area === EXCLUDED_AREA) return false;
    const v = data.customFormValue;
    return typeof v === 'string' && v.length > 0;
  });

  console.log(`→ ${toClear.length} exame(s) fora de Medicina Fetal com "Achados Clínicos" preenchido.`);

  // Relatório de auditoria/backup — grava SEMPRE, mesmo em dry-run.
  const report = toClear.map((d) => {
    const data = d.data();
    return {
      path: d.ref.path,
      area: data.area,
      examType: data.examType,
      patientId: data.patientId,
      status: data.status,
      preview: (data.customFormValue || '').slice(0, 80),
    };
  });
  const reportPath = resolve(process.cwd(), `clear-clinical-findings-report-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`→ Relatório salvo em ${reportPath} (serve de backup do conteúdo antes de apagar).`);

  if (!confirm) {
    console.log('\n(dry-run) Nada foi gravado. Revise o relatório e rode de novo com --confirm pra aplicar.');
    process.exit(0);
  }

  for (let i = 0; i < toClear.length; i += CHUNK) {
    const batch = db.batch();
    const chunk = toClear.slice(i, i + CHUNK);
    for (const d of chunk) {
      batch.update(d.ref, { customFormValue: '', updatedAt: Date.now() });
    }
    await batch.commit();
    console.log(`✓ Lote ${Math.floor(i / CHUNK) + 1} gravado (${chunk.length} exames).`);
  }

  console.log(`\n✓ Concluído. "Achados Clínicos" zerado em ${toClear.length} exame(s). Medicina Fetal preservada.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('✗ Erro:', err?.message || err);
  process.exit(1);
});
