import { GoogleGenerativeAI } from '@google/generative-ai';
import { AppSettings } from '../../../types';
import { AiProvider, BuiltPrompt } from '../types';
import { robustJsonParse } from '../json';
import { logger } from '../../../utils/logger';

export class GeminiProvider implements AiProvider {
  resolveModelName(settings: AppSettings, mode: string, area: string): string {
    const rawModel = settings.geminiModel || 'gemini-3.5-flash';
    const raw = rawModel.toLowerCase();

    // Gemini 2.5 series
    if (raw.includes('2.5') && raw.includes('pro')) return 'gemini-2.5-pro-preview-06-05';
    if (raw.includes('2.5') && raw.includes('flash')) return 'gemini-2.5-flash-preview-05-20';
    if (raw.includes('2.5')) return 'gemini-2.5-flash-preview-05-20';
    // Legacy aliases
    if (raw.includes('3.1') && raw.includes('pro')) return 'gemini-3.1-pro-preview';
    if (raw.includes('3.5') && raw.includes('flash')) return 'gemini-3.5-flash';
    if (raw.includes('pro')) return 'gemini-3.1-pro-preview';

    return 'gemini-3.5-flash';
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
    const genAI = new GoogleGenerativeAI(settings.geminiApiKey!);
    const systemInstruction = built.universalContext + (built.areaContext ? '\n\n' + built.areaContext : '');
    const modelName = this.resolveModelName(settings, mode, area);
    const maxTokens = helpers.getMaxTokens(area);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction,
      generationConfig: {
        temperature: helpers.getModeTemperature(mode, settings.aiTemperature),
        topP: 0.9,
        maxOutputTokens: maxTokens,
      }
    });
    const result = await helpers.withRetry(() => model.generateContent(built.userMessage, { signal }));
    const fullText = result.response.text();
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
    const genAI = new GoogleGenerativeAI(settings.geminiApiKey!);
    const systemInstruction = built.universalContext + (built.areaContext ? '\n\n' + built.areaContext : '');
    const modelName = this.resolveModelName(settings, mode, area);
    const maxTokens = helpers.getMaxTokens(area);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction,
      generationConfig: {
        temperature: helpers.getModeTemperature(mode, settings.aiTemperature),
        topP: 0.9,
        maxOutputTokens: maxTokens,
      }
    });

    const result = await helpers.withRetry(() => model.generateContentStream(built.userMessage, { signal }));
    let fullText = '';

    try {
      for await (const chunk of result.stream) {
        if (signal?.aborted) break;
        fullText += chunk.text();
        onChunk(helpers.stripScratchpad(helpers.cleanMarkdownFromResponse(fullText)), fullText);
      }
    } catch (streamErr) {
      if (signal?.aborted || (streamErr instanceof Error && streamErr.name === 'AbortError')) {
        throw streamErr;
      }
      throw new Error(`Erro durante streaming Gemini: ${streamErr instanceof Error ? streamErr.message : String(streamErr)}`);
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
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${settings.geminiApiKey}`;
      const response = await helpers.withRetry(() => fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: built.universalContext }] },
          generationConfig: {
            temperature: isRetry ? 0.0 : 0.1,
            responseMimeType: 'application/json',
          }
        }),
        signal
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
