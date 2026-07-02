import { useState, useCallback, useRef } from 'react';
import { AppSettings } from '../../../types';
import { auth } from '../../../lib/firebase';
import { getIdToken } from '../../../lib/authToken';
import { robustJsonParse } from '../../ai/json';
import { logger } from '../../../utils/logger';

export interface CopilotSuggestion {
  label: string;
  text: string;
}

const SYSTEM_PROMPT = `Você é um assistente de radiologia. Analise o laudo ultrassonográfico e sugira 3 perguntas curtas e diretas que o médico pode querer perguntar ao copiloto de IA para refinar ou complementar o laudo. Foque em achados específicos do laudo, não sugestões genéricas.

Retorne APENAS um JSON array com o formato:
[{"label": "Texto curto do chip (max 8 palavras)", "text": "Pergunta completa para o copiloto"}]`;

function resolveGeminiModelId(rawModel: string): string {
  const raw = (rawModel || '').toLowerCase();
  if (raw.includes('1.5') && raw.includes('pro'))   return 'gemini-1.5-pro';
  if (raw.includes('pro'))                           return 'gemini-2.5-pro';
  if (raw.includes('2.0') && raw.includes('flash')) return 'gemini-2.0-flash';
  if (raw.includes('1.5') && raw.includes('flash')) return 'gemini-1.5-flash';
  if (raw.includes('flash'))                         return 'gemini-2.5-flash';
  if (/^gemini-(1\.5|2\.0|2\.5)-/.test(raw))         return rawModel;
  return 'gemini-2.5-flash';
}

function resolveAnthropicModelId(rawModel: string): string {
  const raw = rawModel || 'claude-sonnet-4-6';
  if (raw === 'claude-opus-4-5') return 'claude-opus-4-5';
  return raw;
}

export function useCopilotSuggestions(settings: AppSettings) {
  const [suggestions, setSuggestions] = useState<CopilotSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const generateSuggestions = useCallback(async (reportHtml: string, area: string) => {
    if (!reportHtml || reportHtml.trim().length < 50) return;

    // Cancel previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSuggestions([]);
    setLoadingSuggestions(true);

    try {
      const plainText = reportHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
      const userMessage = `Área: ${area}\n\nLaudo:\n${plainText}`;

      let text = '';

      if (settings.aiProvider === 'gemini') {
        const response = await fetch('/api/gemini', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getIdToken()}`,
            'x-uid': auth.currentUser?.uid || 'anonymous',
            'x-gemini-model': resolveGeminiModelId(settings.geminiModel || ''),
            'x-gemini-stream': 'false',
            'x-api-key': settings.geminiApiKey || ''
          },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
          }),
          signal: controller.signal
        });

        if (!response.ok) return;
        const result = await response.json();
        text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        const response = await fetch('/api/anthropic', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${await getIdToken()}`,
            'x-uid': auth.currentUser?.uid || 'anonymous',
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'x-api-key': settings.anthropicApiKey || ''
          },
          body: JSON.stringify({
            model: resolveAnthropicModelId(settings.anthropicModel || ''),
            max_tokens: 512,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userMessage }],
            temperature: 0.4
          }),
          signal: controller.signal
        });

        if (!response.ok) return;
        const result = await response.json();
        text = result.content?.[0]?.text || '';
      }

      if (!text || controller.signal.aborted) return;

      const parsed = robustJsonParse<CopilotSuggestion[]>(text);
      if (Array.isArray(parsed)) {
        setSuggestions(parsed.slice(0, 3));
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      logger.warn('[CopilotSuggestions] Falha ao gerar sugestões:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [settings.aiProvider, settings.geminiApiKey, settings.anthropicApiKey]);

  const clearSuggestions = useCallback(() => {
    abortRef.current?.abort();
    setSuggestions([]);
  }, []);

  return { suggestions, loadingSuggestions, generateSuggestions, clearSuggestions };
}
