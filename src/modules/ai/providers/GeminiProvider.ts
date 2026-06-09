import { GoogleGenerativeAI } from '@google/generative-ai';
import { AppSettings } from '../../../types';
import { AiProvider, BuiltPrompt } from '../types';

export class GeminiProvider implements AiProvider {
  resolveModelName(settings: AppSettings, mode: string, area: string): string {
    const rawModel = settings.geminiModel || 'gemini-3.5-flash';
    const raw = rawModel.toLowerCase();
    
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
    onChunk: (text: string) => void,
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

    for await (const chunk of result.stream) {
      fullText += chunk.text();
      onChunk(helpers.stripScratchpad(helpers.cleanMarkdownFromResponse(fullText)));
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
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${settings.geminiApiKey}`;

    const response = await helpers.withRetry(() => fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: built.userMessage }] }],
        systemInstruction: { parts: [{ text: built.universalContext }] },
        generationConfig: {
          temperature: 0.1,
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
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('O modelo não retornou um JSON válido: ' + text);
    }
  }
}
