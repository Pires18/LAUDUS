/**
 * LAUDUS — Exportador de Templates via IndexedDB do Firebase
 *
 * Cole este script inteiro no Console do navegador com o app aberto e logado.
 * Faz download automático de templates-export.json
 */
(async () => {
  // Abre o IndexedDB do Firestore (nome padrão do persistentLocalCache)
  const dbName = 'firestore/[DEFAULT]/antigravity-laudus/main';

  const openDB = () => new Promise((res, rej) => {
    const req = indexedDB.open(dbName);
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });

  const getAllFromStore = (db, storeName) => new Promise((res, rej) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });

  try {
    const db = await openDB();
    console.log('Stores disponíveis:', [...db.objectStoreNames]);

    // O Firestore armazena documentos no store "documents_overlay" ou "remote_documents"
    const storeName = db.objectStoreNames.contains('remote_documents_v14')
      ? 'remote_documents_v14'
      : db.objectStoreNames.contains('remote_documents')
        ? 'remote_documents'
        : [...db.objectStoreNames][0];

    const all = await getAllFromStore(db, storeName);
    console.log(`Total de docs no store "${storeName}":`, all.length);

    // Filtra apenas templates
    const templates = all
      .filter(r => {
        const key = r.prefixPath || r.key || JSON.stringify(r).slice(0, 200);
        return typeof key === 'string' && key.includes('/templates/');
      })
      .map(r => {
        // Extrai dados do documento Firestore serializado
        const raw = r.document || r.value || r;
        return raw;
      });

    console.log(`Templates encontrados: ${templates.length}`);
    console.table(templates.slice(0, 5));

    const json = JSON.stringify(templates, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'templates-export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('✓ Download iniciado: templates-export.json');
  } catch (err) {
    console.error('Erro ao acessar IndexedDB:', err);
    console.info('Tente o método alternativo: aba Application → IndexedDB no DevTools');
  }
})();
