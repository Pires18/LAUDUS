import { updateItem } from '../../../store/db';
import { Patient, ExamRequest, Clinic, AppSettings } from '../../../types';
import { copyFile, deleteFile } from '../../../lib/googleDrive';
import { replaceTextInDoc } from '../../../lib/googleDocs';
import { calculateAge, formatDate } from '../../../utils/format';
import { deleteField } from 'firebase/firestore';

export async function syncGoogleDoc(
  examId: string, 
  reportContent: string,
  patient: Patient,
  exam: ExamRequest,
  clinic: Clinic,
  settings: AppSettings
) {
  if (!clinic?.googleDocsTemplateId) {
    throw new Error('Configurações de clínica ou template do Google Docs ausentes.');
  }

  const actualExamDate = exam.examDate || exam.createdAt || Date.now();
  const docDate = formatDate(actualExamDate);
  const docName = `${docDate} | ${patient.name} | ${exam.examType} | ${clinic.name}`;

  const templateId = clinic.googleDocsTemplateId;
  const folderId = clinic.googleDriveFolderId;

  const docId = await copyFile(templateId, docName, folderId);

  // Parse HTML to extract sections
  const parser = new DOMParser();
  const doc = parser.parseFromString(reportContent, 'text/html');

  let currentSection = '';
  const sectionBuffer: Record<string, string[]> = {
    tecnica_laudo: [],
    analise_laudo: [],
    conclusao_laudo: [],
    classificacao_laudo: [],
    observacao_laudo: [],
    recomendacao_laudo: [],
    titulo_laudo: []
  };

  const cleanNodeText = (html: string, useSoftBreak = false) => {
    const div = document.createElement('div');
    const breakChar = useSoftBreak ? '\v' : '\n';
    const processedHtml = html
      .replace(/<br\s*\/?>/g, breakChar)
      .replace(/<\/p>/g, breakChar)
      .replace(/\(…\)/g, '( \u00A0\u00A0\u00A0\u00A0 )'); // Espaçamento adequado para o placeholder
    div.innerHTML = processedHtml;
    return (div.textContent || '').trim();
  };

  for (const node of Array.from(doc.body.children)) {
    const tag = node.tagName;
    const text = node.textContent?.trim() || '';

    if (tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4') {
      const header = text.toUpperCase();
      if (header.includes('TÉCNICA')) currentSection = 'tecnica_laudo';
      else if (header.includes('ANÁLISE')) currentSection = 'analise_laudo';
      else if (header.includes('CONCLUSÃO')) currentSection = 'conclusao_laudo';
      else if (header.includes('CLASSIFICAÇ')) currentSection = 'classificacao_laudo';
      else if (header.includes('OBSERVAÇ')) currentSection = 'observacao_laudo';
      else if (header.includes('RECOMENDAÇÕES')) currentSection = 'recomendacao_laudo';
      else if (!currentSection) {
        sectionBuffer.titulo_laudo.push(text);
        currentSection = 'titulo_laudo';
      }
    } else if (currentSection) {
      const useSoftBreak = currentSection === 'analise_laudo';
      if (tag === 'UL' || tag === 'OL') {
        Array.from(node.children).forEach(li => {
          sectionBuffer[currentSection].push(`• ${cleanNodeText(li.innerHTML, useSoftBreak)}`);
        });
      } else {
        const cleaned = cleanNodeText(node.innerHTML, useSoftBreak);
        if (cleaned) {
          sectionBuffer[currentSection].push(cleaned);
        }
      }
    }
  }

  const sections: Record<string, string> = {};
  Object.keys(sectionBuffer).forEach(key => {
    const joinChar = key === 'analise_laudo' ? '\v' : '\n';
    sections[key] = sectionBuffer[key].join(joinChar);
  });

  const replacements: Record<string, string> = {
    'PACIENTE_NOME': patient.name,
    'PACIENTE_NASC': patient.birthDate ? formatDate(patient.birthDate) : '—',
    'PACIENTE_IDADE': patient.birthDate ? calculateAge(patient.birthDate).toString() : '—',
    'EXAME_DATA': formatDate(actualExamDate),
    'EXAME_TIPO': exam.examType,
    'MEDICO_SOLICITANTE': exam.requestingPhysician || 'À determinar',
    'INDICACAO_CLINICA': exam.clinicalIndication || 'Não informada',
    'CLINICA_NOME': clinic.name,
    'dados_medico': (clinic.footerHtml?.replace(/<[^>]*>?/gm, '') || '') || settings.defaultSignature || (settings.physicianName ? `${settings.physicianName}\nCRM: ${settings.physicianCRM || ''}` : ''),
    'titulo_laudo': sections.titulo_laudo || exam.examType.toUpperCase(),
    'tecnica_laudo': sections.tecnica_laudo || '',
    'analise_laudo': sections.analise_laudo || '',
    'conclusao_laudo': sections.conclusao_laudo || '',
    'classificacao_laudo': sections.classificacao_laudo || '',
    'observacao_laudo': sections.observacao_laudo || '',
    'recomendacao_laudo': sections.recomendacao_laudo || '',
    'data_exame': formatDate(actualExamDate),
    'numero_laudo': (exam.friendlyId || exam.id).toUpperCase(),
    'nome_completo': patient.name,
    'data_nascimento': patient.birthDate ? formatDate(patient.birthDate) : '—'
  };

  await replaceTextInDoc(docId, replacements);

  const url = `https://docs.google.com/document/d/${docId}/edit`;
  await updateItem('exams', examId, {
    status: 'finalizado',
    finalizedAt: Date.now(),
    googleDocId: docId,
    googleDocUrl: url
  });

  return { docId, url };
}

export async function cleanupGoogleDoc(examId: string, docId: string) {
  try {
    await deleteFile(docId);
    await updateItem('exams', examId, {
      googleDocId: deleteField(),
      googleDocUrl: deleteField(),
      finalizedAt: deleteField()
    });
  } catch (err) {
    console.warn('[cleanupGoogleDoc] Erro ao remover arquivo:', err);
    throw err;
  }
}
