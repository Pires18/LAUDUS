import { ReportTemplate } from '../../types';

export const INTERNA_TEMPLATES: Partial<ReportTemplate>[] = [
  {
    area: 'medicina-interna',
    name: 'Próstata Via Abdominal',
    description: 'Avaliação prostática via suprapúbica com cálculo de peso/volume.',
    title: 'ULTRASSONOGRAFIA DE PRÓSTATA VIA ABDOMINAL',
    technique: 'Exame realizado com transdutor convexo de baixa frequência via suprapúbica, bexiga com boa repleção.',
    analysisTemplate: `<p><strong>BEXIGA:</strong> Repleta, de paredes finas e regulares, com conteúdo anecóico livre de ecos em suspensão.</p>
<p><strong>PRÓSTATA:</strong> Tópica, de contornos regulares e ecotextura homogênea.</p>
<p>Dimensões: [transverso] x [ap] x [longitudinal] mm.</p>
<p>Volume Estimado: [volumeProstata] cc.</p>
<p>Peso Estimado: [pesoProstata] g.</p>
<p><strong>VESÍCULAS SEMINAIS:</strong> Tópicas, simétricas, de dimensões normais e ecotextura habitual.</p>
<p><strong>RESÍDUO PÓS-MICCIONAL:</strong> Ausente / Fisiológico (Volume: [volumeResiduo] ml).</p>`,
    conclusionTemplate: `<p>Próstata com dimensões e aspecto ecográfico conservados.</p>`,
    recommendationsTemplate: `<p>Correlação clínica e laboratorial (PSA).</p>`,
    aiInstructions: 'Sempre exiba o grau de aumento prostático na conclusão baseado na classificação gerada pela calculadora.',
    formFields: [
      { id: 'prostataCalc', type: 'calculator', label: 'Cálculo de Peso Prostático', calculatorId: 'prostate-weight' },
      { id: 'volumeResiduo', type: 'number', label: 'Volume Resíduo (ml)', required: false }
    ]
  },
  {
    area: 'medicina-interna',
    name: 'Abdome Superior',
    description: 'Avaliação dos órgãos sólidos do abdome superior.',
    title: 'ULTRASSONOGRAFIA DO ABDOME SUPERIOR',
    technique: 'Exame realizado com transdutor convexo de baixa frequência.',
    analysisTemplate: `<p><strong>FÍGADO:</strong> Tópico, de dimensões normais, contornos regulares e ecotextura homogênea. Veias hepáticas e ramos portais com calibres preservados.</p>
<p><strong>VESÍCULA BILIAR:</strong> De dimensões normais, paredes finas e conteúdo anecóico, sem cálculos ou pólipos.</p>
<p><strong>VIAS BILIARES:</strong> Vias biliares intra e extra-hepáticas não dilatadas. Colédoco com calibre de [coledoco] mm.</p>
<p><strong>PÂNCREAS:</strong> Tópico, de dimensões normais e ecotextura preservada (onde a interposição gasosa permite avaliação).</p>
<p><strong>BAÇO:</strong> Tópico, de dimensões e ecotextura conservadas.</p>
<p><strong>AORTA ABDOMINAL e VCI:</strong> De calibres normais.</p>`,
    conclusionTemplate: `<p>Exame ultrassonográfico do abdome superior sem anormalidades significativas.</p>`,
    recommendationsTemplate: `<p>A critério clínico.</p>`,
    formFields: [
      { id: 'esteatose', type: 'select', label: 'Esteatose Hepática', options: [{label:'Ausente',value:'Ausente'},{label:'Grau I (Leve)',value:'Grau I'},{label:'Grau II (Mod)',value:'Grau II'},{label:'Grau III (Acentuada)',value:'Grau III'}], defaultValue: 'Ausente' },
      { id: 'coledoco', type: 'measurement', label: 'Calibre do Colédoco', unit: 'mm', defaultValue: '3' },
      { id: 'calculosVesicula', type: 'textarea', label: 'Cálculos na Vesícula', required: false }
    ]
  },
  {
    area: 'medicina-interna',
    name: 'Rins e Vias Urinárias',
    description: 'Avaliação renal e vesical.',
    title: 'ULTRASSONOGRAFIA DO APARELHO URINÁRIO',
    technique: 'Exame realizado com transdutor convexo de baixa frequência.',
    analysisTemplate: `<p><strong>RINS:</strong> Tópicos, de dimensões, contornos e ecotexturas normais. Boa diferenciação corticomedular. Ausência de cálculos, nódulos ou hidronefrose.</p>
<p>Rim Direito: [compRD] mm.</p>
<p>Rim Esquerdo: [compRE] mm.</p>
<p><strong>BEXIGA:</strong> Repleta, com boa capacidade, paredes finas e conteúdo anecóico.</p>`,
    conclusionTemplate: `<p>Aparelho urinário sem alterações ecográficas.</p>`,
    recommendationsTemplate: `<p>A critério clínico.</p>`,
    formFields: [
      { id: 'compRD', type: 'measurement', label: 'Comprimento Rim Direito', unit: 'mm', required: true },
      { id: 'compRE', type: 'measurement', label: 'Comprimento Rim Esquerdo', unit: 'mm', required: true },
      { id: 'calculosRenais', type: 'textarea', label: 'Cálculos Renais', required: false }
    ]
  },
  {
    area: 'medicina-interna',
    name: 'Abdome Total',
    description: 'Avaliação completa do abdome superior e pelve.',
    title: 'ULTRASSONOGRAFIA DO ABDOME TOTAL',
    technique: 'Exame realizado com transdutor convexo abdominal, bexiga adequadamente repleta.',
    analysisTemplate: `<p><strong>FÍGADO:</strong> Tópico, de dimensões normais, contornos regulares e ecotextura homogênea. Veias hepáticas e ramos portais com calibres preservados.</p>
<p><strong>VESÍCULA BILIAR:</strong> De dimensões normais, paredes finas e conteúdo anecóico, sem cálculos ou pólipos.</p>
<p><strong>VIAS BILIARES:</strong> Vias biliares intra e extra-hepáticas não dilatadas. Colédoco de calibre normal.</p>
<p><strong>PÂNCREAS:</strong> Tópico, de dimensões normais e ecotextura preservada.</p>
<p><strong>BAÇO:</strong> Tópico, de dimensões e ecotextura conservadas.</p>
<p><strong>RINS:</strong> Tópicos, de dimensões, contornos e ecotexturas normais. Boa diferenciação corticomedular. Ausência de cálculos ou hidronefrose.</p>
<p><strong>BEXIGA:</strong> Repleta, paredes finas e regulares, conteúdo anecóico.</p>
<p><strong>AORTA ABDOMINAL e VCI:</strong> De calibres normais.</p>`,
    conclusionTemplate: `<p>Exame ultrassonográfico do abdome total sem anormalidades significativas.</p>`,
    recommendationsTemplate: `<p>A critério clínico.</p>`,
    formFields: [
      { id: 'esteatose', type: 'select', label: 'Esteatose Hepática', options: [{label:'Ausente',value:'Ausente'},{label:'Grau I',value:'Grau I'},{label:'Grau II',value:'Grau II'},{label:'Grau III',value:'Grau III'}], defaultValue: 'Ausente' },
      { id: 'calculos', type: 'textarea', label: 'Cálculos (Vesícula/Renal)', required: false }
    ]
  },
  {
    area: 'medicina-interna',
    name: 'Rins e Vias Urinárias com Doppler',
    description: 'Estudo morfológico renal associado a fluxometria arterial/venosa.',
    title: 'ULTRASSONOGRAFIA DOS RINS E VIAS URINÁRIAS COM DOPPLER',
    technique: 'Exame realizado com transdutor convexo abdominal. Realizado estudo Doppler colorido e espectral dos vasos renais.',
    analysisTemplate: `<p><strong>RINS:</strong> Tópicos, de dimensões e contornos normais. Boa diferenciação corticomedular. Ausência de cálculos, nódulos ou hidronefrose.</p>
<p>Rim Direito: [compRD] mm.</p>
<p>Rim Esquerdo: [compRE] mm.</p>
<p><strong>BEXIGA:</strong> Repleta, paredes finas, conteúdo anecóico.</p>
<p><strong>ESTUDO DOPPLERFLUXOMÉTRICO:</strong></p>
<p>Artérias e Veias Renais principais patentes, com fluxo direcionado adequadamente.</p>
<p>Artéria Renal Direita: IP = [ipRenalDir], Velocidade Sistólica Máxima (VPS) = [vpsRenalDir] cm/s.</p>
<p>Artéria Renal Esquerda: IP = [ipRenalEsq], Velocidade Sistólica Máxima (VPS) = [vpsRenalEsq] cm/s.</p>`,
    conclusionTemplate: `<p>Aparelho urinário com morfologia conservada.</p>
<p>Estudo Dopplerfluxométrico dos vasos renais sem sinais de estenose hemodinamicamente significativa.</p>`,
    recommendationsTemplate: `<p>A critério clínico.</p>`,
    formFields: [
      { id: 'compRD', type: 'measurement', label: 'Comprimento Rim Dir', unit: 'mm', required: true },
      { id: 'compRE', type: 'measurement', label: 'Comprimento Rim Esq', unit: 'mm', required: true },
      { id: 'ipRenalDir', type: 'number', label: 'IP Renal Dir', required: true },
      { id: 'vpsRenalDir', type: 'number', label: 'VPS Renal Dir (cm/s)', required: true },
      { id: 'ipRenalEsq', type: 'number', label: 'IP Renal Esq', required: true },
      { id: 'vpsRenalEsq', type: 'number', label: 'VPS Renal Esq (cm/s)', required: true }
    ]
  }
];

export const VASCULAR_TEMPLATES: Partial<ReportTemplate>[] = [
  {
    area: 'vascular',
    name: 'Doppler de Carótidas e Vertebrais',
    description: 'Estudo Doppler vascular cervical com cálculo de IMT (ELSA-Brasil).',
    title: 'ULTRASSONOGRAFIA COM DOPPLER DE CARÓTIDAS E VERTEBRAIS',
    technique: 'Exame realizado com transdutor linear de alta frequência, nos modos B, Color e Doppler Pulsado.',
    analysisTemplate: `<p><strong>SISTEMA CAROTÍDEO DIREITO:</strong></p>
<p>Artéria Carótida Comum (ACC): Calibre preservado, fluxo laminar. Espessura Íntima-Média (IMT): [imtDir] mm.</p>
<p>Artéria Carótida Interna (ACI): Sem placas estenosantes significativas.</p>
<p>Artéria Carótida Externa (ACE): Padrão de fluxo de alta resistência fisiológico.</p>
<p><strong>SISTEMA CAROTÍDEO ESQUERDO:</strong></p>
<p>Artéria Carótida Comum (ACC): Calibre preservado, fluxo laminar. Espessura Íntima-Média (IMT): [imtEsq] mm.</p>
<p>Artéria Carótida Interna (ACI): Sem placas estenosantes significativas.</p>
<p>Artéria Carótida Externa (ACE): Padrão de fluxo de alta resistência fisiológico.</p>
<p><strong>ARTÉRIAS VERTEBRAIS:</strong></p>
<p>Fluxo anterógrado, de baixa resistência, simétricas.</p>`,
    conclusionTemplate: `<p>Exame Doppler das artérias carótidas e vertebrais dentro dos limites da normalidade.</p>`,
    recommendationsTemplate: `<p>Acompanhamento clínico.</p>`,
    aiInstructions: 'Considere a referência IMT fornecida pela calculadora para concluir se há ou não espessamento médio-intimal para a idade e sexo do paciente.',
    formFields: [
      { id: 'imtCalc', type: 'calculator', label: 'Cálculo IMT (ELSA-Brasil)', calculatorId: 'imt-elsa-br' },
      { id: 'placasDir', type: 'textarea', label: 'Placas / Estenose (Direita)', required: false },
      { id: 'placasEsq', type: 'textarea', label: 'Placas / Estenose (Esquerda)', required: false }
    ]
  }
];
