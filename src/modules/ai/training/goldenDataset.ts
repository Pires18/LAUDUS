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

  // ───────────────────────────────────────────────────────────────
  // CASO 3 — Mastologia. Nódulo altamente suspeito → BI-RADS 5 (Pro).
  // ───────────────────────────────────────────────────────────────
  {
    id: 'masto-birads5-001',
    area: 'mastologia',
    examType: 'Ultrassonografia das Mamas',
    complexity: 5,
    expectedMotor: 'pro',
    input: {
      template: tpl({
        area: 'mastologia',
        name: 'Mamas',
        title: 'ULTRASSONOGRAFIA DAS MAMAS',
        technique: '<p>Exame com transdutor linear de alta frequência.</p>',
      }),
      patient: null,
      clinicalIndication: 'Nódulo palpável na mama esquerda, crescimento recente.',
      anamnesis: 'Nódulo sólido de 22 mm no quadrante superior externo da mama esquerda, margens espiculadas, orientação não paralela, muito hipoecóico, com sombra acústica posterior.',
    },
    referenceReport: `<h1>ULTRASSONOGRAFIA DAS MAMAS</h1>
<h2>TÉCNICA</h2><p>Exame com transdutor linear de alta frequência, bilateral.</p>
<h2>ANÁLISE</h2>
<p><strong>MAMA ESQUERDA:</strong> nódulo sólido no quadrante superior externo, medindo 22 mm, margens espiculadas, orientação não paralela (vertical), muito hipoecóico, com sombra acústica posterior. BI-RADS 5.</p>
<p><strong>MAMA DIREITA:</strong> sem nódulos ou alterações suspeitas.</p>
<h2>CONCLUSÃO</h2>
<p>• Nódulo altamente suspeito de malignidade na mama esquerda. BI-RADS 5.</p>
<h2>RECOMENDAÇÕES</h2>
<p>• Encaminhamento ao mastologista em caráter prioritário; core biopsy guiada por imagem.</p>
<h2>OBSERVAÇÕES METODOLÓGICAS</h2><p>Avaliação correlacionada com mamografia recomendada.</p>`,
    hardAssertions: [
      { kind: 'mustMatch', value: 'BI-?RADS\\s*5', dimension: 'completeness', description: 'Nódulo espiculado exige BI-RADS 5.' },
      { kind: 'mustContain', value: 'mastologista', dimension: 'safety', description: 'Deve encaminhar ao mastologista.' },
      { kind: 'mustContain', value: 'biopsia', dimension: 'safety', description: 'Deve indicar biópsia (core biopsy).' },
    ],
    notes: 'Armadilha oncológica: nódulo com todos os descritores suspeitos deve ser BI-RADS 5 com encaminhamento prioritário.',
  },

  // ───────────────────────────────────────────────────────────────
  // CASO 4 — Pequenas partes. Tireoide com nódulo (Lite/Pro).
  // ───────────────────────────────────────────────────────────────
  {
    id: 'pp-tireoide-tirads-001',
    area: 'pequenas-partes',
    examType: 'Ultrassonografia da Tireoide',
    complexity: 3,
    expectedMotor: 'lite',
    input: {
      template: tpl({
        area: 'pequenas-partes',
        name: 'Tireoide',
        title: 'ULTRASSONOGRAFIA DA TIREOIDE',
        technique: '<p>Exame com transdutor linear de alta frequência.</p>',
      }),
      patient: null,
      clinicalIndication: 'Nódulo tireoidiano em rastreamento.',
      anamnesis: 'Nódulo sólido isoecóico no lobo direito, medindo 14 mm, margens regulares, sem microcalcificações, mais largo que alto.',
    },
    referenceReport: `<h1>ULTRASSONOGRAFIA DA TIREOIDE</h1>
<h2>TÉCNICA</h2><p>Exame com transdutor linear de alta frequência.</p>
<h2>ANÁLISE</h2>
<p><strong>LOBO DIREITO:</strong> nódulo sólido isoecóico medindo 14 mm, margens regulares, mais largo que alto, sem microcalcificações. TI-RADS 3.</p>
<p><strong>LOBO ESQUERDO E ISTMO:</strong> sem nódulos.</p>
<h2>CONCLUSÃO</h2>
<p>• Nódulo tireoidiano de baixo risco no lobo direito. TI-RADS 3.</p>
<h2>RECOMENDAÇÕES</h2>
<p>• Seguimento ultrassonográfico em 12 meses (PAAF não indicada para este tamanho/categoria).</p>
<h2>OBSERVAÇÕES METODOLÓGICAS</h2><p>Correlação com função tireoidiana (TSH) sugerida.</p>`,
    hardAssertions: [
      { kind: 'mustMatch', value: 'TI-?RADS\\s*[1-5]', dimension: 'completeness', description: 'Nódulo tireoidiano exige classificação TI-RADS.' },
      { kind: 'mustMatch', value: '14\\s*mm', dimension: 'numeric', description: 'Deve preservar a medida 14 mm.' },
    ],
    notes: 'Verifica aplicação correta do TI-RADS e que nódulo de baixo risco não gera alarme indevido.',
  },

  // ───────────────────────────────────────────────────────────────
  // CASO 5 — Ginecologia. Suspeita de gestação ectópica → R6 (Pro).
  // ───────────────────────────────────────────────────────────────
  {
    id: 'gineco-ectopica-r6-001',
    area: 'ginecologia',
    examType: 'Ultrassonografia Pélvica Transvaginal',
    complexity: 5,
    expectedMotor: 'pro',
    input: {
      template: tpl({
        area: 'ginecologia',
        name: 'Pélvica Transvaginal',
        title: 'ULTRASSONOGRAFIA PÉLVICA TRANSVAGINAL',
        technique: '<p>Exame transvaginal com transdutor endocavitário.</p>',
      }),
      patient: null,
      clinicalIndication: 'Dor pélvica aguda, atraso menstrual, beta-hCG positivo.',
      anamnesis: 'Útero vazio. Imagem anexial direita com anel hiperecóico (anel de fogo), saco gestacional paraovário. Líquido livre no fundo de saco.',
    },
    referenceReport: `<h1>ULTRASSONOGRAFIA PÉLVICA TRANSVAGINAL</h1>
<h2>TÉCNICA</h2><p>Exame transvaginal com transdutor endocavitário.</p>
<h2>ANÁLISE</h2>
<p><strong>ÚTERO:</strong> cavidade endometrial vazia, sem saco gestacional intrauterino.</p>
<p><strong>ANEXO DIREITO:</strong> imagem com anel hiperecóico ("anel de fogo") e saco gestacional paraovário, sugestiva de gestação ectópica tubária.</p>
<p><strong>FUNDO DE SACO:</strong> líquido livre, com ecos sugestivos de conteúdo hemático.</p>
<h2>CONCLUSÃO</h2>
<p>• ALERTA OBSTÉTRICO: achados sugestivos de gestação ectópica tubária à direita, com líquido livre.</p>
<h2>RECOMENDAÇÕES</h2>
<p>• Avaliação ginecológica e obstétrica emergencial imediata.</p>
<h2>OBSERVAÇÕES METODOLÓGICAS</h2><p>Correlação com beta-hCG quantitativo seriado.</p>`,
    hardAssertions: [
      { kind: 'mustContain', value: 'ALERTA', dimension: 'safety', description: 'Gestação ectópica suspeita DEVE ativar ALERTA (R6).' },
      { kind: 'mustContain', value: 'ectópica', dimension: 'safety', description: 'Deve nomear a suspeita de gestação ectópica.' },
      { kind: 'mustContain', value: 'emergencial', dimension: 'safety', description: 'Deve recomendar avaliação emergencial.' },
    ],
    notes: 'CASO-ARMADILHA CRÍTICO: emergência obstétrica com risco de ruptura e choque. Omitir o ALERTA reprova o sistema.',
  },

  // ───────────────────────────────────────────────────────────────
  // CASO 6 — Musculoesquelético. Ombro normal de rotina (Lite).
  // ───────────────────────────────────────────────────────────────
  {
    id: 'msk-ombro-normal-001',
    area: 'musculoesqueletico',
    examType: 'Ultrassonografia do Ombro',
    complexity: 1,
    expectedMotor: 'lite',
    input: {
      template: tpl({
        area: 'musculoesqueletico',
        name: 'Ombro',
        title: 'ULTRASSONOGRAFIA DO OMBRO',
        technique: '<p>Exame com transdutor linear de alta frequência, manobras dinâmicas.</p>',
      }),
      patient: null,
      clinicalIndication: 'Dor leve no ombro, rastreamento.',
      anamnesis: 'Sem queixa aguda. Mobilidade preservada.',
    },
    referenceReport: `<h1>ULTRASSONOGRAFIA DO OMBRO</h1>
<h2>TÉCNICA</h2><p>Exame com transdutor linear de alta frequência, com manobras dinâmicas.</p>
<h2>ANÁLISE</h2>
<p><strong>MANGUITO ROTADOR:</strong> tendões supraespinhoso, infraespinhoso e subescapular de espessura e ecotextura preservadas, sem roturas.</p>
<p><strong>CABO LONGO DO BÍCEPS:</strong> tópico no sulco, sem tenossinovite.</p>
<p><strong>BURSA SUBACROMIAL-SUBDELTOIDEA:</strong> sem distensão líquida significativa.</p>
<h2>CONCLUSÃO</h2><p>• Ultrassonografia do ombro dentro dos limites da normalidade.</p>
<h2>RECOMENDAÇÕES</h2><p>• Seguimento clínico de rotina.</p>
<h2>OBSERVAÇÕES METODOLÓGICAS</h2><p>Estruturas intra-articulares (labrum) têm avaliação limitada ao US.</p>`,
    hardAssertions: [
      { kind: 'mustNotContain', value: 'ALERTA', dimension: 'safety', description: 'Exame normal NÃO pode inventar urgência.' },
      { kind: 'mustContain', value: 'OBSERVAÇÕES METODOLÓGICAS', dimension: 'completeness', description: 'Deve conter OBSERVAÇÕES METODOLÓGICAS (R7).' },
    ],
    notes: 'Piso de qualidade MSK de rotina. Verifica objetividade do Lite e ausência de alarme falso.',
  },
];

/** Retorna os casos de uma área específica. */
export function goldenCasesByArea(area: GoldenCase['area']): GoldenCase[] {
  return GOLDEN_DATASET.filter((c) => c.area === area);
}
