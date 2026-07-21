import { AppSettings } from '../../../types';
import { AiProvider, BuiltPrompt } from '../types';
import { robustJsonParse } from '../json';
import { geminiHttpError } from '../retry';
import { logger } from '../../../utils/logger';
import { auth } from '../../../lib/firebase';
import { getIdToken } from '../../../lib/authToken';

/**
 * Resolves the canonical Gemini model ID. Modelos oficiais do usuário:
 * Lite = gemini-3.5-flash, Pro = gemini-3.1-pro-preview.
 */
function resolveGeminiModelId(rawModel: string): string {
  const raw = (rawModel || '').toLowerCase();

  // IDs 2.5/1.5 antigos foram removidos: eram inválidos na API (404). Qualquer entrada
  // legada cai no mapeamento por 'pro'/'flash' abaixo, resolvendo para os modelos atuais.
  if (raw.includes('3.5') && raw.includes('flash')) return 'gemini-3.5-flash';
  if (raw.includes('3.1') && raw.includes('pro'))   return 'gemini-3.1-pro-preview';
  if (raw.includes('pro'))                           return 'gemini-3.1-pro-preview';
  if (raw.includes('flash'))                         return 'gemini-3.5-flash';

  return 'gemini-3.5-flash';
}

/** Build the standard Gemini request body. */
function buildBody(
  systemInstruction: string,
  userMessage: string,
  temperature: number,
  maxOutputTokens: number,
  extraConfig?: object
): string {
  return JSON.stringify({
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: {
      temperature,
      topP: 0.9,
      maxOutputTokens,
      ...extraConfig,
    },
  });
}

/** Headers common to all proxy calls (inclui o token Firebase exigido pelo proxy). */
async function proxyHeaders(model: string, stream: boolean, settings: AppSettings, mode?: string): Promise<Record<string, string>> {
  const idToken = await getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`,
    'x-uid': auth.currentUser?.uid || 'anonymous',
    'x-gemini-model': model,
    'x-gemini-stream': stream ? 'true' : 'false',
    // Modo do motor: usado pelo proxy para enforçar a cota de laudos SOMENTE na
    // geração de laudo (não em copiloto/refino/template).
    ...(mode ? { 'x-gemini-mode': mode } : {}),
  };
}

export class GeminiProvider implements AiProvider {
  resolveModelName(settings: AppSettings, _mode: string, _area: string): string {
    return resolveGeminiModelId(settings.geminiModel || '');
  }

  async generate(
    built: BuiltPrompt,
    settings: AppSettings,
    area: string,
    mode: string,
    signal?: AbortSignal,
    onComplete?: (scratchpad?: string) => void,
    helpers?: any
  ): Promise<string> {
    const model = this.resolveModelName(settings, mode, area);
    const systemInstruction = built.universalContext + (built.areaContext ? '\n\n' + built.areaContext : '');

    const headers = await proxyHeaders(model, false, settings, mode);
    const response = await helpers.withRetry(() => fetch('/api/gemini', {
      method: 'POST',
      headers,
      body: buildBody(
        systemInstruction,
        built.userMessage,
        helpers.getModeTemperature(mode, settings.aiTemperature),
        helpers.getMaxTokens(area)
      ),
      signal,
    }));

    if (!response.ok) {
      const errText = await response.text();
      throw geminiHttpError(response.status, errText);
    }

    const result = await response.json();
    const fullText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (onComplete) onComplete(helpers.extractScratchpad(fullText));
    return helpers.cleanMarkdownFromResponse(fullText);
  }

  async stream(
    built: BuiltPrompt,
    settings: AppSettings,
    area: string,
    mode: string,
    onChunk: (text: string, rawText?: string) => void,
    signal?: AbortSignal,
    onComplete?: (scratchpad?: string) => void,
    helpers?: any
  ): Promise<string> {
    const model = this.resolveModelName(settings, mode, area);
    const systemInstruction = built.universalContext + (built.areaContext ? '\n\n' + built.areaContext : '');

    const headers = await proxyHeaders(model, true, settings, mode);
    const response = await helpers.withRetry(() => fetch('/api/gemini', {
      method: 'POST',
      headers,
      body: buildBody(
        systemInstruction,
        built.userMessage,
        helpers.getModeTemperature(mode, settings.aiTemperature),
        helpers.getMaxTokens(area)
      ),
      signal,
    }));

    if (!response.ok) {
      const errText = await response.text();
      throw geminiHttpError(response.status, errText);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Não foi possível inicializar o leitor de stream.');

    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let buffer = '';

    try {
      while (true) {
        if (signal?.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const clean = line.trim();
          if (!clean || !clean.startsWith('data:')) continue;

          const dataStr = clean.slice(5).trim();
          if (!dataStr || dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);
            const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (chunk) {
              fullText += chunk;
              onChunk(
                helpers.stripScratchpad(helpers.cleanMarkdownFromResponse(fullText)),
                fullText
              );
            }
          } catch {
            // Skip non-JSON SSE events
          }
        }
      }
    } catch (streamErr) {
      if (signal?.aborted || (streamErr instanceof Error && streamErr.name === 'AbortError')) {
        throw streamErr;
      }
      throw new Error(`Erro durante streaming Gemini: ${streamErr instanceof Error ? streamErr.message : String(streamErr)}`);
    } finally {
      reader.cancel().catch(() => {});
    }

    if (onComplete) onComplete(helpers.extractScratchpad(fullText));
    return helpers.stripScratchpad(helpers.cleanMarkdownFromResponse(fullText));
  }

  async extractJson(
    built: BuiltPrompt,
    settings: AppSettings,
    area: string,
    signal?: AbortSignal,
    helpers?: any
  ): Promise<any> {
    const model = this.resolveModelName(settings, 'geral', area);

    const attemptFetch = async (isRetry = false, errorContext = '') => {
      let prompt = built.userMessage;
      if (isRetry) {
        prompt += `\n\nATENÇÃO: A sua resposta anterior falhou ao ser processada como JSON. Erro: ${errorContext}. Por favor, retorne APENAS um JSON válido, sem texto adicional ou markdown.`;
      }

      const headers = await proxyHeaders(model, false, settings);
      const response = await helpers.withRetry(() => fetch('/api/gemini', {
        method: 'POST',
        headers,
        body: buildBody(
          built.universalContext,
          prompt,
          isRetry ? 0.0 : 0.1,
          2048,
          { responseMimeType: 'application/json' }
        ),
        signal,
      }));

      if (!response.ok) {
        const errText = await response.text();
        throw geminiHttpError(response.status, errText, 'Gemini JSON');
      }

      const result = await response.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    };

    let text = await attemptFetch();

    try {
      return robustJsonParse(text);
    } catch (e: any) {
      logger.warn('Auto-healing JSON parsing triggered for Gemini:', e.message);
      text = await attemptFetch(true, e.message);
      return robustJsonParse(text);
    }
  }
}
