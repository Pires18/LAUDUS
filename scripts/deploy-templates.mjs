/**
 * LAUDUS — Deploy de templates do repositório → Firestore
 *
 * Corrige a cadeia de deploy quebrada (auditoria, achado D1): lê o JSON CANÔNICO
 * versionado no repo (laudia-deploy-unified.json) e faz upsert (merge) na coleção
 * users/{uid}/templates. Substitui o antigo update-templates.mjs, que apontava para
 * um arquivo inexistente (templates-export.json em caminho fora do repo).
 *
 * Uso (dry-run por padrão — NÃO grava nada):
 *   node scripts/deploy-templates.mjs <email> <senha>
 * Aplicar de fato:
 *   node scripts/deploy-templates.mjs <email> <senha> --commit
 * Filtros opcionais:
 *   --area medicina-fetal        (só uma área)
 *   --only "GEMELAR"             (só um template pelo name)
 *   --uid <uid>                  (grava em outra coleção; padrão = uid autenticado)
 *
 * Obtenha as credenciais do mesmo login do app. Sempre rode o dry-run antes de --commit.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, writeBatch } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { readFileSync } from 'fs';

const CONFIG = {
  apiKey:            'AIzaSyAVqN1pcxvcgxmZRt_-dCJCdg0Y4XK2Ixk',
  authDomain:        'antigravity-laudus.firebaseapp.com',
  projectId:         'antigravity-laudus',
  storageBucket:     'antigravity-laudus.firebasestorage.app',
  messagingSenderId: '542081396849',
  appId:             '1:542081396849:web:f80667d559e5a30b36abd0',
};

// Campos versionados no repo que o deploy grava (merge preserva os demais no Firestore).
const DEPLOY_FIELDS = [
  'area', 'name', 'title', 'technique',
  'analysisTemplate', 'conclusionTemplate', 'recommendationsTemplate',
  'observationsTemplate', 'aiInstructions',
];

function parseArgs(argv) {
  const a = { commit: false, area: null, only: null, uid: null };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--commit') a.commit = true;
    else if (v === '--area') a.area = argv[++i];
    else if (v === '--only') a.only = argv[++i];
    else if (v === '--uid') a.uid = argv[++i];
    else pos.push(v);
  }
  a.email = pos[0]; a.password = pos[1];
  return a;
}

const args = parseArgs(process.argv.slice(2));
if (!args.email || !args.password) {
  console.error('Uso: node scripts/deploy-templates.mjs <email> <senha> [--commit] [--area X] [--only "NAME"] [--uid U]');
  process.exit(1);
}

// JSON canônico ao lado deste script (independe do cwd).
const seedPath = new URL('./laudia-deploy-unified.json', import.meta.url);
const all = JSON.parse(readFileSync(seedPath, 'utf8'));
let templates = Array.isArray(all) ? all : (all.templates || []);
if (args.area) templates = templates.filter(t => t.area === args.area);
if (args.only) templates = templates.filter(t => t.name === args.only);

if (!templates.length) { console.error('Nenhum template após filtros.'); process.exit(1); }

function pick(t) {
  const o = {};
  for (const f of DEPLOY_FIELDS) if (t[f] !== undefined) o[f] = t[f];
  return o;
}

const app  = initializeApp(CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

try {
  const cred = await signInWithEmailAndPassword(auth, args.email, args.password);
  const uid  = args.uid || cred.user.uid;
  console.log(`✓ Autenticado (uid alvo: ${uid})`);
  console.log(`  Modo: ${args.commit ? 'COMMIT (grava)' : 'DRY-RUN (não grava)'} · ${templates.length} templates\n`);

  // Diff contra o Firestore atual.
  const planned = [];
  for (const t of templates) {
    const ref = doc(db, `users/${uid}/templates`, t.id);
    const snap = await getDoc(ref);
    const cur = snap.exists() ? snap.data() : null;
    const next = pick(t);
    const changed = [];
    for (const f of DEPLOY_FIELDS) {
      const a = cur ? (cur[f] ?? '') : '';
      const b = next[f] ?? '';
      if (a !== b) changed.push(f);
    }
    const status = !cur ? 'NOVO' : (changed.length ? 'ALTERA' : 'igual');
    planned.push({ id: t.id, name: t.name, area: t.area, status, changed, next });
    if (status !== 'igual') {
      console.log(`  [${status.padEnd(6)}] ${(t.area||'').padEnd(16)} ${t.name}`);
      if (changed.length) console.log(`            campos: ${changed.join(', ')}`);
    }
  }

  const toWrite = planned.filter(p => p.status !== 'igual');
  console.log(`\nResumo: ${toWrite.length} a gravar · ${planned.length - toWrite.length} já iguais.`);

  if (!args.commit) {
    console.log('\nDRY-RUN — nada gravado. Reexecute com --commit para aplicar.');
    process.exit(0);
  }
  if (!toWrite.length) { console.log('Nada a gravar.'); process.exit(0); }

  const CHUNK = 400;
  for (let i = 0; i < toWrite.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const p of toWrite.slice(i, i + CHUNK)) {
      const ref = doc(db, `users/${uid}/templates`, p.id);
      batch.set(ref, { ...p.next, updatedAt: Date.now() }, { merge: true });
    }
    await batch.commit();
    console.log(`✓ Lote ${Math.floor(i / CHUNK) + 1} commitado (${Math.min(CHUNK, toWrite.length - i)} docs).`);
  }
  console.log('\n✓ Deploy concluído.');
  process.exit(0);
} catch (err) {
  console.error('Erro:', err.message);
  process.exit(1);
}
