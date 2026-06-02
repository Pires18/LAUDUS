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
