import { batchAdd } from '../store/db';

/**
 * Utilitário de migração para transferir dados do IndexedDB local (antigo Dexie)
 * para o Firebase Firestore (novo backend).
 */
export async function migrateFromDexieToFirestore(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Tenta abrir o banco de dados antigo criado pelo Dexie
    const request = window.indexedDB.open('LaudosUSDB');

    request.onerror = (event) => {
      console.error('Erro ao abrir IndexedDB:', event);
      reject(new Error('Falha ao abrir banco de dados local.'));
    };

    request.onsuccess = async (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      try {
        // Migrar Pacientes
        if (db.objectStoreNames.contains('patients')) {
          const patients = await getAllFromStore(db, 'patients');
          if (patients.length > 0) {
            console.log(`Migrando ${patients.length} pacientes...`);
            await batchAdd('patients', patients);
          }
        }

        // Migrar Exames
        if (db.objectStoreNames.contains('exams')) {
          const exams = await getAllFromStore(db, 'exams');
          if (exams.length > 0) {
            console.log(`Migrando ${exams.length} exames...`);
            await batchAdd('exams', exams);
          }
        }

        // Migrar Máscaras/Templates
        if (db.objectStoreNames.contains('templates')) {
          const templates = await getAllFromStore(db, 'templates');
          if (templates.length > 0) {
            console.log(`Migrando ${templates.length} máscaras...`);
            await batchAdd('templates', templates);
          }
        }

        console.log('Migração concluída com sucesso!');
        resolve();
      } catch (error) {
        console.error('Erro durante a migração dos dados:', error);
        reject(error);
      } finally {
        db.close();
      }
    };
  });
}

/**
 * Helper para extrair todos os registros de uma object store usando API nativa
 */
function getAllFromStore(db: IDBDatabase, storeName: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
