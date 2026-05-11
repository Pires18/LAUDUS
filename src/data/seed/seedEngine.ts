import { batchAdd } from '../../store/db';
import { GINECOLOGIA_TEMPLATES } from './ginecologia';
import { FETAL_TEMPLATES } from './fetal';
import { INTERNA_TEMPLATES, VASCULAR_TEMPLATES } from './interna';
import { PEQUENAS_PARTES_TEMPLATES } from './pequenas-partes';
import { PEDIATRIA_TEMPLATES } from './pediatria';
import { MSK_TEMPLATES } from './msk';
import { PROCEDIMENTOS_TEMPLATES, REUMATO_TEMPLATES } from './procedimentos';
import { ReportTemplate } from '../../types';

export async function seedDefaultTemplates() {
  const allTemplates = [
    ...GINECOLOGIA_TEMPLATES,
    ...FETAL_TEMPLATES,
    ...INTERNA_TEMPLATES,
    ...VASCULAR_TEMPLATES,
    ...PEQUENAS_PARTES_TEMPLATES,
    ...PEDIATRIA_TEMPLATES,
    ...MSK_TEMPLATES,
    ...PROCEDIMENTOS_TEMPLATES,
    ...REUMATO_TEMPLATES
  ];

  // Prepare objects for Firestore
  const now = Date.now();
  const documents = allTemplates.map(t => {
    // Generate a predictable or random ID
    const docId = `seed_${t.area}_${t.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    return {
      ...t,
      id: docId,
      createdAt: now,
      updatedAt: now,
    } as ReportTemplate;
  });

  try {
    await batchAdd('templates', documents as any[]);
    return { success: true, count: documents.length };
  } catch (error) {
    console.error('Error seeding templates:', error);
    return { success: false, error };
  }
}
