import { AppSettings } from '../../../types';
import { AiProvider, BuiltPrompt } from '../types';

export function getAnthropicBaseUrl(): string {
  const isLocalDev = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  return isLocalDev ? '/api/anthropic' : 'https://api.anthropic.com';
}

export class AnthropicProvider implements AiProvider {
  resolveModelName(settings: AppSettings, mode: string, area: string): string {
    return settings.anthropicModel || 'claude-3-5-sonnet-latest';
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
        text: built.areaContext
      });
    }

    const response = await helpers.withRetry(() => fetch(`/api/anthropic`, {
      method: 'POST',
      headers: {
        'x-api-key': settings.anthropicApiKey!,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31, max-tokens-3-5-sonnet-2024-07-15',
        'content-type': 'application/json'
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
    onChunk: (text: string) => void,
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
        text: built.areaContext
      });
    }

    const response = await helpers.withRetry(() => fetch(`/api/anthropic`, {
      method: 'POST',
      headers: {
        'x-api-key': settings.anthropicApiKey!,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31, max-tokens-3-5-sonnet-2024-07-15',
        'content-type': 'application/json'
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

    while (true) {
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
            onChunk(helpers.stripScratchpad(helpers.cleanMarkdownFromResponse(fullText)));
          }
        } catch {
          // Ignorar eventos não-JSON
        }
      }
    }

    return helpers.stripScratchpad(helpers.cleanMarkdownFromResponse(fullText));
  }

  async extractJson(
    built: BuiltPrompt,
    settings: AppSettings,
    area: string,
    signal?: AbortSignal,
    helpers?: any
  ): Promise<any> {
    const response = await helpers.withRetry(() => fetch(`/api/anthropic`, {
      method: 'POST',
      headers: {
        'x-api-key': settings.anthropicApiKey!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307', // Using haiku for fast JSON extraction
        max_tokens: 1024,
        system: built.universalContext,
        messages: [{ role: 'user', content: built.userMessage }],
        temperature: 0.1, // Low temperature for consistent JSON
      }),
      signal
    }));

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro na API da Anthropic JSON (${response.status}): ${errText}`);
    }

    const result = await response.json();
    let text = result.content?.[0]?.text || '';
    
    // Clean up potential markdown formatting block
    if (text.includes('```json')) {
      text = text.split('```json')[1].split('```')[0].trim();
    } else if (text.includes('```')) {
      text = text.split('```')[1].split('```')[0].trim();
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('O modelo não retornou um JSON válido: ' + text);
    }
  }
}
