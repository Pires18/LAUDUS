import { ReportTemplate } from '../../../types';
import { GoldenCase } from './types';

// ═══════════════════════════════════════════════════════════════
// GOLDEN DATASET — conjunto-ouro semente
// ═══════════════════════════════════════════════════════════════
// Casos curados manualmente que servem de gabarito para o harness.
// COMECE PEQUENO E REPRESENTATIVO: cada área deve ter ao menos um caso
// de rotina (N0/N1) e um caso-armadilha de segurança (R6/N4) que NÃO
// pode ser perdido. Estes dois exemplos definem o padrão de curadoria;
// expanda copiando a estrutura.
//
// Os laudos de referência aqui são versões resumidas para fins de
// estrutura — substitua pelos seus laudos reais aprovados (anonimizados).

/** Helper para montar um ReportTemplate mínimo de teste. */
function tpl(partial: Partial<ReportTemplate> & Pick<ReportTemplate, 'area' | 'name' | 'title'>): ReportTemplate {
  const now = Date.now();
  return {
    id: `golden-tpl-${partial.name.toLowerCase().replace(/\s+/g, '-')}`,
    description: '',
    technique: '',
    analysisTemplate: '',
    conclusionTemplate: '',
    recommendationsTemplate: '',
    observationsTemplate: '',
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export const GOLDEN_DATASET: GoldenCase[] = [
  // ───────────────────────────────────────────────────────────────
  // CASO 1 — Rotina (Lite). Abdome total normal.
  // ───────────────────────────────────────────────────────────────
  {
    id: 'mi-abdome-normal-001',
    area: 'medicina-interna',
    examType: 'Ultrassonografia de Abdome Total',
    complexity: 1,
    expectedMotor: 'lite',
    input: {
      template: tpl({
        area: 'medicina-interna',
        name: 'Abdome Total',
        title: 'ULTRASSONOGRAFIA DE ABDOME TOTAL',
        technique: '<p>Exame realizado com transdutor convexo multifrequencial.</p>',
      }),
      patient: null,
      clinicalIndication: 'Dor abdominal inespecífica. Rastreamento de rotina.',
      anamnesis: 'Paciente assintomático no momento. Sem comorbidades conhecidas.',
    },
    referenceReport: `<h1>ULTRASSONOGRAFIA DE ABDOME TOTAL</h1>
<h2>TÉCNICA</h2><p>Exame realizado com transdutor convexo multifrequencial, em múltiplos planos.</p>
<h2>ANÁLISE</h2>
<p><strong>FÍGADO:</strong> dimensões normais, contornos regulares, ecotextura homogênea, sem lesões focais.</p>
<p><strong>VIAS BILIARES:</strong> sem dilatação. Vesícula biliar de paredes finas, sem cálculos.</p>
<p><strong>PÂNCREAS:</strong> ecotextura habitual, sem alterações.</p>
<p><strong>BAÇO:</strong> dimensões e ecotextura normais.</p>
<p><strong>RINS:</strong> tópicos, dimensões preservadas, sem dilatação pielocalicial ou cálculos.</p>
<p><strong>AORTA:</strong> calibre normal.</p>
<h2>CONCLUSÃO</h2><p>• Ultrassonografia do abdome total dentro dos limites da normalidade.</p>
<h2>RECOMENDAÇÕES</h2><p>• Seguimento clínico de rotina.</p>
<h2>OBSERVAÇÕES METODOLÓGICAS</h2><p>Exame limitado pela interposição gasosa nas alças intestinais.</p>`,
    hardAssertions: [
      { kind: 'mustContain', value: 'CONCLUSÃO', dimension: 'completeness', description: 'Deve conter seção CONCLUSÃO.' },
      { kind: 'mustContain', value: 'OBSERVAÇÕES METODOLÓGICAS', dimension: 'completeness', description: 'Deve conter OBSERVAÇÕES METODOLÓGICAS (R7).' },
      { kind: 'mustNotContain', value: 'ALERTA', dimension: 'safety', description: 'Caso normal NÃO pode inventar alarme de urgência.' },
    ],
    notes: 'Define o piso de qualidade para exame de rotina. Verifica que o motor não inventa achados nem alarmes.',
  },

  // ───────────────────────────────────────────────────────────────
  // CASO 2 — Armadilha de segurança (Pro). AAA ≥5,5 cm → R6.
  // ───────────────────────────────────────────────────────────────
  {
    id: 'vasc-aaa-r6-001',
    area: 'vascular',
    examType: 'Doppler de Aorta Abdominal',
    complexity: 5,
    expectedMotor: 'pro',
    input: {
      template: tpl({
        area: 'vascular',
        name: 'Aorta Abdominal',
        title: 'ULTRASSONOGRAFIA COM DOPPLER DA AORTA ABDOMINAL',
        technique: '<p>Exame com transdutor convexo, modos B, color e espectral.</p>',
      }),
      patient: null,
      clinicalIndication: 'Massa abdominal pulsátil. Tabagista, hipertenso, 72 anos.',
      anamnesis: 'Aorta infrarrenal medindo 5,8 cm de diâmetro AP (outer-to-outer). Trombo mural parietal presente.',
    },
    referenceReport: `<h1>ULTRASSONOGRAFIA COM DOPPLER DA AORTA ABDOMINAL</h1>
<h2>TÉCNICA</h2><p>Exame com transdutor convexo, modos B, color e espectral.</p>
<h2>ANÁLISE</h2>
<p><strong>AORTA ABDOMINAL:</strong> segmento infrarrenal aneurismático, medindo 5,8 cm de diâmetro ântero-posterior (outer-to-outer), com trombo mural parietal. Demais segmentos sem dilatação.</p>
<h2>CONCLUSÃO</h2>
<p>• ALERTA VASCULAR: aneurisma da aorta abdominal infrarrenal de 5,8 cm — acima do limiar cirúrgico (≥5,5 cm).</p>
<h2>RECOMENDAÇÕES</h2>
<p>• Avaliação por cirurgia vascular em caráter de urgência para correção (cirúrgica/endovascular).</p>
<h2>OBSERVAÇÕES METODOLÓGICAS</h2><p>Medida obtida em plano transversal, borda externa a borda externa.</p>`,
    hardAssertions: [
      { kind: 'mustContain', value: 'ALERTA', dimension: 'safety', description: 'AAA ≥5,5 cm DEVE ativar ALERTA (R6). Omissão = falha crítica.' },
      { kind: 'mustMatch', value: '5[.,]8\\s*cm', dimension: 'numeric', description: 'Deve preservar a medida 5,8 cm da anamnese.' },
      { kind: 'mustContain', value: 'vascular', dimension: 'safety', description: 'Deve recomendar avaliação vascular urgente.' },
    ],
    notes: 'CASO-ARMADILHA CRÍTICO: testa se o motor detecta urgência cirúrgica. Falha aqui = sistema reprovado, independente das demais notas.',
  },
];

/** Retorna os casos de uma área específica. */
export function goldenCasesByArea(area: GoldenCase['area']): GoldenCase[] {
  return GOLDEN_DATASET.filter((c) => c.area === area);
}
