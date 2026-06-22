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


export interface RichTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

/**
 * Lê a estrutura JSON de um Google Doc.
 */
export async function getDoc(docId: string): Promise<any> {
  const token = await getGoogleAccessToken();
  const response = await fetch(`${DOCS_API_URL}/${docId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Docs API Error (getDoc): ${error.error?.message}`);
  }
  return response.json();
}

/**
 * Busca de forma recursiva a faixa de índices de um placeholder no conteúdo do documento.
 */
function findPlaceholderRange(elements: any[], placeholder: string): { startIndex: number; endIndex: number } | null {
  for (const element of elements) {
    if (element.paragraph) {
      for (const el of element.paragraph.elements) {
        if (el.textRun && el.textRun.content) {
          const idx = el.textRun.content.toLowerCase().indexOf(placeholder.toLowerCase());
          if (idx !== -1) {
            const start = el.startIndex + idx;
            return {
              startIndex: start,
              endIndex: start + placeholder.length
            };
          }
        }
      }
    } else if (element.table) {
      for (const row of element.table.tableRows) {
        for (const cell of row.tableCells) {
          const found = findPlaceholderRange(cell.content, placeholder);
          if (found) return found;
        }
      }
    } else if (element.tableOfContents) {
      const found = findPlaceholderRange(element.tableOfContents.content, placeholder);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Substitui placeholders comuns com texto simples e placeholders de texto rico formatado,
 * aplicando negrito e itálico em ordem reversa para evitar o deslocamento dos índices.
 */
export async function replaceRichTextInDoc(
  docId: string,
  plainReplacements: Record<string, string>,
  richReplacements: Record<string, RichTextRun[]>
): Promise<void> {
  // Fase 1: Substitui os placeholders comuns de texto puro
  if (Object.keys(plainReplacements).length > 0) {
    await replaceTextInDoc(docId, plainReplacements);
  }

  // Fase 2: Carrega a estrutura atualizada para identificar as posições exatas dos placeholders de texto rico
  const doc = await getDoc(docId);
  const placeholdersToReplace: { placeholder: string; startIndex: number; endIndex: number; runs: RichTextRun[] }[] = [];

  for (const [key, runs] of Object.entries(richReplacements)) {
    const placeholder = `{{${key}}}`;
    const range = findPlaceholderRange(doc.body.content, placeholder);
    if (range) {
      placeholdersToReplace.push({
        placeholder,
        startIndex: range.startIndex,
        endIndex: range.endIndex,
        runs
      });
    }
  }

  // Ordena em ordem decrescente de índice inicial para não afetar os índices anteriores
  placeholdersToReplace.sort((a, b) => b.startIndex - a.startIndex);

  const requests: any[] = [];

  for (const item of placeholdersToReplace) {
    // 1. Apaga o texto do placeholder
    requests.push({
      deleteContentRange: {
        range: {
          startIndex: item.startIndex,
          endIndex: item.endIndex
        }
      }
    });

    // 2. Concatena todos os fragmentos de texto do placeholder
    const fullText = item.runs.map(run => run.text).join('');
    if (!fullText) continue;

    // 3. Insere o texto completo de uma única vez no startIndex
    requests.push({
      insertText: {
        location: {
          index: item.startIndex
        },
        text: fullText
      }
    });

    // 4. Aplica a formatação de cada run de forma sequencial usando os índices finais calculados
    let currentOffset = item.startIndex;
    for (const run of item.runs) {
      if (!run.text) continue;

      requests.push({
        updateTextStyle: {
          range: {
            startIndex: currentOffset,
            endIndex: currentOffset + run.text.length
          },
          textStyle: {
            bold: !!run.bold,
            italic: !!run.italic
          },
          fields: 'bold,italic'
        }
      });

      currentOffset += run.text.length;
    }
  }

  if (requests.length === 0) return;

  const token = await getGoogleAccessToken();
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
    throw new Error(`Docs API Error (replaceRichTextInDoc batchUpdate): ${error.error?.message}`);
  }
}
