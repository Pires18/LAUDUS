// ═══════════════════════════════════════════════════════════════
// LAUD.IA TRAINING & EXCELLENCE — Fase 1: Harness de Avaliação
// ═══════════════════════════════════════════════════════════════
// Camada de medição paralela ao motor de geração. Não altera o fluxo
// de produção — mede a qualidade dos laudos contra um conjunto-ouro,
// permitindo evoluir os prompts com método (testes de regressão).
//
// Uso típico (conta admin, isenta de cota):
//
//   import { runHarness, createEngineGenerator, GOLDEN_DATASET } from './training';
//   const generate = createEngineGenerator(settings);
//   const run = await runHarness(GOLDEN_DATASET, generate, settings, {
//     promptVersion: 'v2.1.0',
//     onProgress: (done, total, r) => console.log(`${done}/${total}`, r.weightedScore),
//   });
//   console.log('Score geral:', run.overallScore, 'Segurança:', run.safetyPassRate + '%');

export * from './types';
export * from './anonymize';
export * from './evaluator';
export * from './harness';
export * from './engineGenerator';
export * from './goldenDataset';

// Fase 3 — Aprendizado: corpus, retrieval semântico, loop de feedback
export * from './embeddings';
export * from './excellenceCorpus';
export * from './retrieval';
export * from './feedback';

// Fase 4 — Evolução contínua: versionamento, experimentação, métricas
export * from './promptRegistry';
export * from './experiment';
export * from './qualityMetrics';
export * from './feedbackStore';
export * from './backfill';

// Fase 2 — peças de produção reexportadas para conveniência
export { verifyReport } from '../verification';
export type { VerificationReport, VerificationIssue, VerificationContext } from '../verification';
export { routeMotor } from '../router';
export type { RouterInput, RouterDecision } from '../router';
export { getMotorProfile, LITE_PROFILE, PRO_PROFILE } from '../motorProfiles';
export type { Motor } from '../motorProfiles';
