/**
 * Script de exportação de templates do Firestore.
 * Uso: node scripts/export-templates.mjs <email> <senha>
 *
 * Exporta todos os templates de users/{uid}/templates para JSON,
 * incluindo o campo aiInstructions e demais metadados.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { writeFileSync } from 'fs';

const firebaseConfig = {
  apiKey:            'AIzaSyAVqN1pcxvcgxmZRt_-dCJCdg0Y4XK2Ixk',
  authDomain:        'antigravity-laudus.firebaseapp.com',
  projectId:         'antigravity-laudus',
  storageBucket:     'antigravity-laudus.firebasestorage.app',
  messagingSenderId: '542081396849',
  appId:             '1:542081396849:web:f80667d559e5a30b36abd0',
};

const [,, email, password] = process.argv;

if (!email || !password) {
  console.error('Uso: node scripts/export-templates.mjs <email> <senha>');
  process.exit(1);
}

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

try {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid  = cred.user.uid;
  console.log(`✓ Autenticado como ${email} (uid: ${uid})`);

  const col  = collection(db, `users/${uid}/templates`);
  const snap = await getDocs(col);

  const templates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  templates.sort((a, b) => (a.area || '').localeCompare(b.area || '') || (a.name || '').localeCompare(b.name || ''));

  const outputPath = `scripts/templates-export.json`;
  writeFileSync(outputPath, JSON.stringify(templates, null, 2), 'utf8');

  console.log(`\n✓ ${templates.length} templates exportados → ${outputPath}`);
  console.log('\nResumo por área:');
  const byArea = {};
  for (const t of templates) {
    byArea[t.area] = (byArea[t.area] || 0) + 1;
  }
  for (const [area, count] of Object.entries(byArea).sort()) {
    const hasAI = templates.filter(t => t.area === area && t.aiInstructions?.trim()).length;
    console.log(`  ${area.padEnd(22)} ${count} templates  (${hasAI} com aiInstructions)`);
  }

  process.exit(0);
} catch (err) {
  console.error('Erro:', err.message);
  process.exit(1);
}
