import { useState, useCallback, useRef } from 'react';
import { AppSettings } from '../../../types';
import { auth } from '../../../lib/firebase';
import { getIdToken } from '../../../lib/authToken';
import { robustJsonParse } from '../../ai/json';
import { resolveGeminiModel, getFallbackModel } from '../../ai/engine';
import { withRetry } from '../../ai/retry';
import { logger } from '../../../utils/logger';

export interface CopilotSuggestion {
  label: string;
  text: string;
}

const SYSTEM_PROMPT = `Você é um assistente de radiologia. Analise o laudo ultrassonográfico e sugira 3 perguntas curtas e diretas que o médico pode querer perguntar ao copiloto de IA para refinar ou complementar o laudo. Foque em achados específicos do laudo, não sugestões genéricas.

Retorne APENAS um JSON array com o formato:
[{"label": "Texto curto do chip (max 8 palavras)", "text": "Pergunta completa para o copiloto"}]`;


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

      // Sugestões são latency-sensitive: apenas 1 retry em 429/503.
      const primaryModel = resolveGeminiModel(settings.geminiModel || '', settings.selectedMotor);
      const doFetch = (model: string) => withRetry(async () => fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getIdToken()}`,
          'x-uid': auth.currentUser?.uid || 'anonymous',
          'x-gemini-model': model,
          'x-gemini-stream': 'false',
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
        }),
        signal: controller.signal
      }), 1);

      // Em 503/404 (modelo sobrecarregado/indisponível), tenta o GA de contingência.
      let response = await doFetch(primaryModel);
      if (!response.ok && (response.status === 503 || response.status === 404)) {
        const fb = getFallbackModel(primaryModel);
        if (fb) {
          response.body?.cancel().catch(() => {});
          response = await doFetch(fb);
        }
      }

      if (!response.ok) return;
      const result = await response.json();
      const text: string = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

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
  }, [settings.geminiApiKey, settings.geminiModel, settings.selectedMotor]);

  const clearSuggestions = useCallback(() => {
    abortRef.current?.abort();
    setSuggestions([]);
  }, []);

  return { suggestions, loadingSuggestions, generateSuggestions, clearSuggestions };
}
