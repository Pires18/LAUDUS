import { AppSettings } from '../../../types';
import { AiProvider, BuiltPrompt } from '../types';
import { robustJsonParse } from '../json';
import { geminiHttpError } from '../retry';
import { logger } from '../../../utils/logger';
import { auth } from '../../../lib/firebase';
import { getIdToken } from '../../../lib/authToken';
import { resolveGeminiModel, getFallbackModel } from '../geminiModels';

// Status em que trocar de MODELO pode ajudar: 503 (modelo sobrecarregado) e 404
// (modelo indisponível/descontinuado). Não inclui 429 — costuma ser limite de
// requisições do PROJETO, que outro modelo não contorna.
const MODEL_UNAVAILABLE_STATUS = new Set([503, 404]);

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
    // settings.geminiModel já chega resolvido pelo engine; revalidamos pelo
    // resolvedor único (idempotente) usando o motor como fallback seguro.
    return resolveGeminiModel(settings.geminiModel, settings.selectedMotor);
  }

  /**
   * POST ao proxy com retry (withRetry) e, se o modelo primário esgotar em 503
   * (sobrecarga) ou 404 (indisponível), tenta UMA vez num modelo GA de
   * contingência (getFallbackModel). Retorna a Response final — o chamador trata
   * !ok. O corpo é idêntico entre as tentativas; só o header de modelo muda.
   */
  private async postWithModelFallback(
    primaryModel: string,
    bodyStr: string,
    stream: boolean,
    settings: AppSettings,
    mode: string | undefined,
    signal: AbortSignal | undefined,
    helpers: any,
  ): Promise<Response> {
    const attempt = (model: string): Promise<Response> =>
      helpers.withRetry(async () =>
        fetch('/api/gemini', {
          method: 'POST',
          headers: await proxyHeaders(model, stream, settings, mode),
          body: bodyStr,
          signal,
        }),
      );

    let response: Response = await attempt(primaryModel);
    if (!response.ok && MODEL_UNAVAILABLE_STATUS.has(response.status)) {
      const fallback = getFallbackModel(primaryModel);
      if (fallback && fallback !== primaryModel) {
        response.body?.cancel().catch(() => {});
        logger.warn(
          `[Gemini] "${primaryModel}" indisponível (HTTP ${response.status}); tentando modelo de contingência "${fallback}".`,
        );
        response = await attempt(fallback);
      }
    }
    return response;
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

    const bodyStr = buildBody(
      systemInstruction,
      built.userMessage,
      helpers.getModeTemperature(mode, settings.aiTemperature),
      helpers.getMaxTokens(area)
    );
    const response = await this.postWithModelFallback(model, bodyStr, false, settings, mode, signal, helpers);

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

    const bodyStr = buildBody(
      systemInstruction,
      built.userMessage,
      helpers.getModeTemperature(mode, settings.aiTemperature),
      helpers.getMaxTokens(area)
    );
    const response = await this.postWithModelFallback(model, bodyStr, true, settings, mode, signal, helpers);

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

      const bodyStr = buildBody(
        built.universalContext,
        prompt,
        isRetry ? 0.0 : 0.1,
        2048,
        { responseMimeType: 'application/json' }
      );
      const response = await this.postWithModelFallback(model, bodyStr, false, settings, undefined, signal, helpers);

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
