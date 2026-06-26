import { AppSettings } from '../../../types';
import { generateReport } from '../engine';
import { GenerateReportParams } from '../types';
import { GoldenCase } from './types';
import { GenerateFn, GenerationOutput } from './harness';

// ═══════════════════════════════════════════════════════════════
// GERADOR DE PRODUÇÃO PARA O HARNESS
// ═══════════════════════════════════════════════════════════════
// Conecta o harness ao motor real (generateReport), forçando o motor
// (Lite/Pro) esperado pelo caso-ouro. Assim a avaliação mede exatamente
// o que o usuário receberia em produção.
//
// IMPORTANTE: generateReport valida cota mensal e a incrementa em modo
// 'generation'. Rode o harness com uma conta admin (isenta de cota) para
// não consumir laudos reais durante a avaliação.

/**
 * Cria um GenerateFn que usa o motor de produção, forçando o motor do caso.
 * @param baseSettings settings do usuário (chave de API, modelos configurados)
 */
export function createEngineGenerator(baseSettings: AppSettings): GenerateFn {
  return async (goldenCase: GoldenCase, signal?: AbortSignal): Promise<GenerationOutput> => {
    // Força o motor esperado pelo caso, preservando o resto das configs.
    const settings: AppSettings = {
      ...baseSettings,
      selectedMotor: goldenCase.expectedMotor,
    };

    const params: GenerateReportParams = {
      template: goldenCase.input.template,
      patient: goldenCase.input.patient,
      settings,
      clinicalIndication: goldenCase.input.clinicalIndication,
      requestingPhysician: goldenCase.input.requestingPhysician,
      anamnesis: goldenCase.input.anamnesis,
      signal,
    };

    const t0 = Date.now();
    const report = await generateReport(params);
    const latencyMs = Date.now() - t0;

    return {
      report,
      motorUsed: goldenCase.expectedMotor,
      latencyMs,
    };
  };
}
