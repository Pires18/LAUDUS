import { AppSettings } from '../../../types';
import { AiProvider, BuiltPrompt } from '../types';
import { robustJsonParse } from '../json';
import { logger } from '../../../utils/logger';
import { auth } from '../../../lib/firebase';

/** Resolves the canonical Gemini model ID from any alias or raw setting. */
function resolveGeminiModelId(rawModel: string): string {
  const raw = (rawModel || '').toLowerCase();

  if (raw.includes('3.5') && raw.includes('flash')) return 'gemini-3.5-flash';
  if (raw.includes('3.1') && raw.includes('pro'))   return 'gemini-3.1-pro-preview';
  if (raw.includes('2.5') && raw.includes('pro'))   return 'gemini-2.5-pro-preview-06-05';
  if (raw.includes('2.5') && raw.includes('flash')) return 'gemini-2.5-flash-preview-05-20';
  if (raw.includes('2.5'))                           return 'gemini-2.5-flash-preview-05-20';
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

/** Headers common to all proxy calls. */
function proxyHeaders(model: string, stream: boolean, settings: AppSettings): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-uid': auth.currentUser?.uid || 'anonymous',
    'x-gemini-model': model,
    'x-gemini-stream': stream ? 'true' : 'false',
    'x-api-key': settings.geminiApiKey || '',
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

    const response = await helpers.withRetry(() => fetch('/api/gemini', {
      method: 'POST',
      headers: proxyHeaders(model, false, settings),
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
      throw new Error(`Erro na API do Gemini (${response.status}): ${errText}`);
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

    const response = await helpers.withRetry(() => fetch('/api/gemini', {
      method: 'POST',
      headers: proxyHeaders(model, true, settings),
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
      throw new Error(`Erro na API do Gemini (${response.status}): ${errText}`);
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

      const response = await helpers.withRetry(() => fetch('/api/gemini', {
        method: 'POST',
        headers: proxyHeaders(model, false, settings),
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
        throw new Error(`Erro na API do Gemini JSON (${response.status}): ${errText}`);
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
