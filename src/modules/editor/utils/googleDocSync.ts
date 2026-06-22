import { updateItem } from '../../../store/db';
import { logger } from '../../../utils/logger';
import { Patient, ExamRequest, Clinic, AppSettings } from '../../../types';
import { copyFile, deleteFile } from '../../../lib/googleDrive';
import { replaceRichTextInDoc, RichTextRun } from '../../../lib/googleDocs';
import { calculateAge, formatDate } from '../../../utils/format';
import { deleteField } from 'firebase/firestore';

// Parser recursivo de HTML para RichTextRuns (preservando negrito e itálico)
function parseNodeToTextRuns(rootNode: Node, useSoftBreak = false): RichTextRun[] {
  const runs: RichTextRun[] = [];
  const breakChar = useSoftBreak ? '\v' : '\n';

  function traverse(currentNode: Node, activeStyles: { bold: boolean; italic: boolean }, isRoot = false) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      const text = currentNode.textContent || '';
      if (text) {
        // Trata os espaços para placeholders padrão do sistema (ex: "(…)" para "(     )")
        const processedText = text.replace(/\(…\)/g, '( \u00A0\u00A0\u00A0\u00A0 )');
        runs.push({
          text: processedText,
          bold: activeStyles.bold,
          italic: activeStyles.italic
        });
      }
    } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
      const el = currentNode as HTMLElement;
      const tag = el.tagName;
      
      const newStyles = { ...activeStyles };
      if (tag === 'B' || tag === 'STRONG') {
        newStyles.bold = true;
      }
      if (tag === 'I' || tag === 'EM') {
        newStyles.italic = true;
      }
      
      if (tag === 'BR') {
        runs.push({ text: breakChar });
      } else {
        for (const child of Array.from(el.childNodes)) {
          traverse(child, newStyles, false);
        }
        // Adiciona quebra apenas para parágrafos/divs internos, não o raiz
        if (!isRoot && (tag === 'P' || tag === 'DIV')) {
          runs.push({ text: breakChar });
        }
      }
    }
  }

  traverse(rootNode, { bold: false, italic: false }, true);
  return runs.filter(run => run.text !== '');
}

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
  const sectionRuns: Record<string, RichTextRun[]> = {
    tecnica_laudo: [],
    analise_laudo: [],
    conclusao_laudo: [],
    classificacao_laudo: [],
    observacao_laudo: [],
    recomendacao_laudo: [],
    titulo_laudo: []
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
      else if (header.includes('RECOMENDAÇ')) currentSection = 'recomendacao_laudo';
      else if (!currentSection) {
        sectionRuns.titulo_laudo.push({ text });
        currentSection = 'titulo_laudo';
      }
    } else if (currentSection) {
      const useSoftBreak = currentSection === 'analise_laudo';
      const joinChar = useSoftBreak ? '\v' : '\n';

      if (tag === 'UL' || tag === 'OL') {
        Array.from(node.children).forEach((li) => {
          if (sectionRuns[currentSection].length > 0) {
            sectionRuns[currentSection].push({ text: joinChar });
          }
          sectionRuns[currentSection].push({ text: '• ' });
          const liRuns = parseNodeToTextRuns(li, useSoftBreak);
          sectionRuns[currentSection].push(...liRuns);
        });
      } else {
        const pRuns = parseNodeToTextRuns(node, useSoftBreak);
        if (pRuns.length > 0) {
          if (sectionRuns[currentSection].length > 0) {
            sectionRuns[currentSection].push({ text: joinChar });
          }
          sectionRuns[currentSection].push(...pRuns);
        }
      }
    }
  }

  // Fallback para o título se estiver vazio
  if (sectionRuns.titulo_laudo.length === 0) {
    sectionRuns.titulo_laudo.push({ text: exam.examType.toUpperCase() });
  }

  const plainReplacements: Record<string, string> = {
    'PACIENTE_NOME': patient.name,
    'PACIENTE_NASC': patient.birthDate ? formatDate(patient.birthDate) : '—',
    'PACIENTE_IDADE': patient.birthDate ? calculateAge(patient.birthDate).toString() : '—',
    'EXAME_DATA': formatDate(actualExamDate),
    'EXAME_TIPO': exam.examType,
    'MEDICO_SOLICITANTE': exam.requestingPhysician || 'À determinar',
    'INDICACAO_CLINICA': exam.clinicalIndication || 'Não informada',
    'CLINICA_NOME': clinic.name,
    'dados_medico': (clinic.footerHtml?.replace(/<[^>]*>?/gm, '') || '') || settings.defaultSignature || (settings.physicianName ? `${settings.physicianName}\nCRM: ${settings.physicianCRM || ''}` : ''),
    'data_exame': formatDate(actualExamDate),
    'numero_laudo': (exam.friendlyId || exam.id).toUpperCase(),
    'nome_completo': patient.name,
    'data_nascimento': patient.birthDate ? formatDate(patient.birthDate) : '—'
  };

  await replaceRichTextInDoc(docId, plainReplacements, sectionRuns);

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
    logger.warn('[cleanupGoogleDoc] Erro ao remover arquivo:', err);
    throw err;
  }
}
