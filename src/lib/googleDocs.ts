import { getGoogleAccessToken } from './googleAuth';

/**
 * Interface para a API do Google Docs (v1).
 * Documentação: https://developers.google.com/docs/api/reference/rest/v1/documents
 */

const DOCS_API_URL = 'https://docs.googleapis.com/v1/documents';

/**
 * Substitui texto em um documento Google Docs usando expressões regulares.
 * Útil para fazer "mail merge" substituindo variáveis como {{PACIENTE_NOME}}.
 */
export async function replaceTextInDoc(docId: string, replacements: Record<string, string>): Promise<void> {
  const token = await getGoogleAccessToken();

  const requests = Object.entries(replacements).map(([key, value]) => ({
    replaceAllText: {
      containsText: {
        text: `{{${key}}}`,
        matchCase: false,
      },
      replaceText: value || '',
    },
  }));

  if (requests.length === 0) return;

  const response = await fetch(`${DOCS_API_URL}/${docId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Docs API Error (replaceTextInDoc): ${error.error?.message}`);
  }
}

interface TextRun {
  textRun?: { content?: string };
}

interface ParagraphElement {
  paragraph?: { elements: TextRun[] };
  table?: {
    tableRows: {
      tableCells: {
        content: StructuralElement[];
      }[];
    }[];
  };
}

type StructuralElement = ParagraphElement;

/**
 * Extrai o texto puro de um nó estrutural do Google Docs.
 */
function extractTextFromStructuralElement(element: StructuralElement): string {
  if (element.paragraph) {
    return element.paragraph.elements
      .map((el) => el.textRun?.content || '')
      .join('');
  }
  if (element.table) {
    return element.table.tableRows.map((row) =>
      row.tableCells.map((cell) =>
        cell.content.map(extractTextFromStructuralElement).join('')
      ).join(' | ')
    ).join('\n');
  }
  return '';
}

/**
 * Lê o conteúdo em texto puro de um Google Doc.
 */
export async function getDocumentText(docId: string): Promise<string> {
  const token = await getGoogleAccessToken();

  const response = await fetch(`${DOCS_API_URL}/${docId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Docs API Error (getDocumentText): ${error.error?.message}`);
  }

  const doc = await response.json();
  const text = doc.body.content
    .map(extractTextFromStructuralElement)
    .join('');

  return text;
}

/**
 * Adiciona um texto simples ao final do documento.
 * Ideal para testes básicos de inserção de conteúdo.
 */
export async function appendTextToDoc(docId: string, text: string): Promise<void> {
  const token = await getGoogleAccessToken();

  // Para inserir no final de um doc, precisamos ler o tamanho atual do body
  const docResponse = await fetch(`${DOCS_API_URL}/${docId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const docData = await docResponse.json();
  
  // Pegamos o índice do final do corpo
  // docs body sempre termina com um \n. Inserimos logo antes dele
  const endIdx = docData.body.content[docData.body.content.length - 1].endIndex - 1;

  const requests = [
    {
      insertText: {
        location: { index: Math.max(1, endIdx) },
        text: '\n' + text,
      }
    }
  ];

  const response = await fetch(`${DOCS_API_URL}/${docId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Docs API Error (appendTextToDoc): ${error.error?.message}`);
  }
}
