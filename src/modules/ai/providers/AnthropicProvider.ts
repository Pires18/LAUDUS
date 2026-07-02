import { AppSettings } from '../../../types';
import { AiProvider, BuiltPrompt } from '../types';
import { robustJsonParse } from '../json';
import { logger } from '../../../utils/logger';
import { auth } from '../../../lib/firebase';
import { getIdToken } from '../../../lib/authToken';

/** Headers de autenticação exigidos pelo proxy /api/anthropic. */
async function proxyAuthHeaders(settings: AppSettings): Promise<Record<string, string>> {
  const idToken = await getIdToken();
  return {
    'Authorization': `Bearer ${idToken}`,
    'x-uid': auth.currentUser?.uid || 'anonymous',
    'content-type': 'application/json',
    'x-api-key': settings.anthropicApiKey || ''
  };
}

export function getAnthropicBaseUrl(): string {
  const isLocalDev = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  return isLocalDev ? '/api/anthropic' : 'https://api.anthropic.com';
}

export class AnthropicProvider implements AiProvider {
  resolveModelName(settings: AppSettings, mode: string, area: string): string {
    return settings.anthropicModel || 'claude-sonnet-4-6';
  }

  /** Computa o header anthropic-beta correto com base no modelo selecionado */
  private getBetaHeader(settings: AppSettings): string {
    const model = this.resolveModelName(settings, 'geral', 'geral');
    const headers = ['prompt-caching-2024-07-31'];

    if (model.includes('opus')) {
      headers.push('interleaved-thinking-2025-05-14');
      headers.push('output-128k-2025-02-19');
    }
    return headers.join(', ');
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
    const systemBlocks: Array<{ type: string; text: string; cache_control?: { type: string } }> = [
      {
        type: 'text',
        text: built.universalContext,
        cache_control: { type: 'ephemeral' }
      }
    ];
    if (built.areaContext) {
      systemBlocks.push({
        type: 'text',
        text: built.areaContext,
        cache_control: { type: 'ephemeral' }
      });
    }

    const authHeaders = await proxyAuthHeaders(settings);
    const response = await helpers.withRetry(() => fetch(`/api/anthropic`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': this.getBetaHeader(settings)
      },
      body: JSON.stringify({
        model: this.resolveModelName(settings, mode, area),
        max_tokens: helpers.getMaxTokens(area),
        system: systemBlocks,
        messages: [{ role: 'user', content: built.userMessage }],
        temperature: helpers.getModeTemperature(mode, settings.aiTemperature)
      }),
      signal
    }));

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro na API da Anthropic (${response.status}): ${errText}`);
    }

    const result = await response.json();
    const fullText = result.content?.[0]?.text || '';
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
    const systemBlocks: Array<{ type: string; text: string; cache_control?: { type: string } }> = [
      {
        type: 'text',
        text: built.universalContext,
        cache_control: { type: 'ephemeral' }
      }
    ];
    if (built.areaContext) {
      systemBlocks.push({
        type: 'text',
        text: built.areaContext,
        cache_control: { type: 'ephemeral' }
      });
    }

    const authHeaders = await proxyAuthHeaders(settings);
    const response = await helpers.withRetry(() => fetch(`/api/anthropic`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': this.getBetaHeader(settings)
      },
      body: JSON.stringify({
        model: this.resolveModelName(settings, mode, area),
        max_tokens: helpers.getMaxTokens(area),
        system: systemBlocks,
        messages: [{ role: 'user', content: built.userMessage }],
        temperature: helpers.getModeTemperature(mode, settings.aiTemperature),
        stream: true
      }),
      signal
    }));

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro na API da Anthropic (${response.status}): ${errText}`);
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
          const cleanLine = line.trim();
          if (!cleanLine || !cleanLine.startsWith('data:')) continue;

          const dataStr = cleanLine.slice(5).trim();
          if (dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullText += parsed.delta.text;
              onChunk(helpers.stripScratchpad(helpers.cleanMarkdownFromResponse(fullText)), fullText);
            }
          } catch {
            // Ignorar eventos SSE não-JSON (ex: event:, ping)
          }
        }
      }
    } catch (streamErr) {
      if (signal?.aborted || (streamErr instanceof Error && streamErr.name === 'AbortError')) {
        throw streamErr;
      }
      throw new Error(`Erro durante streaming Anthropic: ${streamErr instanceof Error ? streamErr.message : String(streamErr)}`);
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
    const attemptFetch = async (isRetry = false, errorContext = '') => {
      let prompt = built.userMessage;
      if (isRetry) {
        prompt += `\n\nATENÇÃO: A sua resposta anterior falhou ao ser processada como JSON. Erro: ${errorContext}. Por favor, retorne APENAS um JSON válido, sem texto adicional ou markdown.`;
      }
      const authHeaders = await proxyAuthHeaders(settings);
      const response = await helpers.withRetry(() => fetch(`/api/anthropic`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.resolveModelName(settings, 'geral', 'geral'),
          max_tokens: 2048,
          system: built.universalContext,
          messages: [{ role: 'user', content: prompt }],
          temperature: isRetry ? 0.0 : 0.1,
        }),
        signal
      }));

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Erro na API da Anthropic JSON (${response.status}): ${errText}`);
      }

      const result = await response.json();
      return result.content?.[0]?.text || '';
    };

    let text = await attemptFetch();
    
    try {
      return robustJsonParse(text);
    } catch (e: any) {
      logger.warn('Auto-healing JSON parsing triggered for Anthropic:', e.message);
      text = await attemptFetch(true, e.message);
      return robustJsonParse(text);
    }
  }
}
