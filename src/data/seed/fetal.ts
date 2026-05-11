import { ReportTemplate } from '../../types';

export const FETAL_TEMPLATES: Partial<ReportTemplate>[] = [
  {
    area: 'medicina-fetal',
    name: 'Obstétrica de Primeiro Trimestre',
    description: 'Avaliação inicial da gestação (antes de 11 semanas).',
    title: 'ULTRASSONOGRAFIA OBSTÉTRICA DO PRIMEIRO TRIMESTRE',
    technique: 'Exame realizado com transdutor endovaginal e/ou convexo abdominal, conforme apropriado.',
    analysisTemplate: `<p>Útero aumentado de volume, contendo saco gestacional tópico, de contornos regulares.</p>
<p>DMSG (Diâmetro Médio do Saco Gestacional): [dmsg] mm.</p>
<p>Vesícula vitelínica presente, com diâmetro regular e aspecto fisiológico.</p>
<p>Embrião único, com batimentos cardíacos rítmicos presentes ([bcf] bpm).</p>
<p>CCN (Comprimento Cabeça-Nádega): [ccn] mm.</p>
<p>Trofloblasto com espessura habitual, sem sinais de descolamento.</p>
<p>Anexos maternos sem alterações ecográficas.</p>`,
    conclusionTemplate: `<p>Gestação tópica simples, viável.</p>
<p>Idade Gestacional estimada pelo CCN: [idadeGestacionalCcn].</p>`,
    recommendationsTemplate: `<p>Acompanhamento pré-natal de rotina.</p>
<p>Sugere-se ultrassonografia morfológica de primeiro trimestre entre 11 e 13 semanas e 6 dias.</p>`,
    formFields: [
      { id: 'dum', type: 'date', label: 'Data da Última Menstruação (DUM)' },
      { id: 'dmsgCalc', type: 'calculator', label: 'Cálculo por Saco Gestacional (DMSG)', calculatorId: 'msd-dmsg' },
      { id: 'ccnCalc', type: 'calculator', label: 'Cálculo por Embrião (CCN)', calculatorId: 'crl-ccn' },
      { id: 'bcf', type: 'number', label: 'Batimentos Cardíacos (bpm)' },
      { id: 'descolamento', type: 'textarea', label: 'Descolamento (se houver)' }
    ]
  },
  {
    area: 'medicina-fetal',
    name: 'Obstétrica de Segundo / Terceiro Trimestre com Doppler',
    description: 'Avaliação do crescimento fetal + estudo Doppler completo (inclui calculadora Barcelona).',
    title: 'ULTRASSONOGRAFIA OBSTÉTRICA COM DOPPLER',
    technique: 'Exame realizado com transdutor convexo abdominal, estudo Doppler colorido e pulsado.',
    analysisTemplate: `<p>Situação [situacao], apresentação [apresentacao], dorso à [dorso].</p>
<p>Batimentos cardíacos fetais rítmicos: [bcf] bpm.</p>
<p>Movimentos fetais corporais e respiratórios presentes e normais.</p>
<p><strong>BIOMETRIA FETAL:</strong></p>
<p>DBP: [dbp] mm | CC: [cc] mm | CA: [ca] mm | CF: [cf] mm</p>
<p>Peso Fetal Estimado (Hadlock): [pesoFetal] g ([percentilPeso]).</p>
<p><strong>ANEXOS:</strong></p>
<p>Placenta com inserção [insercaoPlacenta], grau [grauPlacenta] de Grannum, espessura normal.</p>
<p>Líquido amniótico em volume normal (ILA: [ila] cm / Maior Bolsão: [mbv] cm).</p>
<p><strong>ESTUDO DOPPLERFLUXOMÉTRICO:</strong></p>
<p>Artéria Umbilical: IP = [ipUmbilical] (Percentil [percUmbilical]).</p>
<p>Artéria Cerebral Média: IP = [ipAcm] (Percentil [percAcm]).</p>
<p>Relação Cérebro-Placentária (CPR): [cpr] (Percentil [percCpr]).</p>
<p>Artérias Uterinas Maternas: IP Médio = [ipUterinas] (Percentil [percUterinas]).</p>`,
    conclusionTemplate: `<p>Gestação tópica de evolução ecográfica [evolucao].</p>
<p>Crescimento Fetal: [percentilPeso].</p>
<p>Estudo Dopplerfluxométrico: [statusDoppler].</p>`,
    recommendationsTemplate: `<p>Acompanhamento pré-natal obstétrico.</p>`,
    aiInstructions: 'Sempre exiba os resultados do Doppler com base na classificação de Barcelona preenchida na calculadora. Se a calculadora indicar RCF (Restrição de Crescimento) ou PIG, destaque isso fortemente na conclusão.',
    formFields: [
      { id: 'barcelonaCalc', type: 'calculator', label: 'Avaliação Fetal Completa (Barcelona / Biometria)', calculatorId: 'barcelona-fetal-growth' },
      { id: 'situacao', type: 'select', label: 'Situação', options: [{label:'Longitudinal',value:'longitudinal'},{label:'Transversa',value:'transversa'},{label:'Oblíqua',value:'obliqua'}], defaultValue: 'longitudinal' },
      { id: 'apresentacao', type: 'select', label: 'Apresentação', options: [{label:'Cefálica',value:'cefalica'},{label:'Pélvica',value:'pelvica'},{label:'Córmica',value:'cormica'}], defaultValue: 'cefalica' },
      { id: 'dorso', type: 'select', label: 'Dorso', options: [{label:'Direita',value:'direita'},{label:'Esquerda',value:'esquerda'},{label:'Anterior',value:'anterior'},{label:'Posterior',value:'posterior'}], defaultValue: 'esquerda' },
      { id: 'bcf', type: 'number', label: 'BCF (bpm)' },
      { id: 'insercaoPlacenta', type: 'select', label: 'Inserção Placentária', options: [{label:'Anterior',value:'anterior'},{label:'Posterior',value:'posterior'},{label:'Fúndica',value:'fundica'},{label:'Prévia',value:'previa'}] },
      { id: 'grauPlacenta', type: 'select', label: 'Grau Placentário', options: [{label:'0',value:'0'},{label:'I',value:'I'},{label:'II',value:'II'},{label:'III',value:'III'}], defaultValue: 'I' }
    ]
  },
  {
    area: 'medicina-fetal',
    name: 'Obstétrica de Segundo / Terceiro Trimestre',
    description: 'Avaliação do crescimento fetal (sem Doppler).',
    title: 'ULTRASSONOGRAFIA OBSTÉTRICA',
    technique: 'Exame realizado com transdutor convexo abdominal.',
    analysisTemplate: `<p>Situação [situacao], apresentação [apresentacao], dorso à [dorso].</p>
<p>Batimentos cardíacos fetais rítmicos: [bcf] bpm.</p>
<p>Movimentos fetais corporais e respiratórios presentes e normais.</p>
<p><strong>BIOMETRIA FETAL:</strong></p>
<p>DBP: [dbp] mm | CC: [cc] mm | CA: [ca] mm | CF: [cf] mm</p>
<p>Peso Fetal Estimado (Hadlock): [pesoFetal] g ([percentilPeso]).</p>
<p><strong>ANEXOS:</strong></p>
<p>Placenta com inserção [insercaoPlacenta], grau [grauPlacenta] de Grannum, espessura normal.</p>
<p>Líquido amniótico em volume normal (ILA: [ila] cm / Maior Bolsão: [mbv] cm).</p>`,
    conclusionTemplate: `<p>Gestação tópica de evolução ecográfica compatível com [idadeGestacional] semanas e [dias] dias.</p>
<p>Crescimento Fetal: [percentilPeso].</p>`,
    recommendationsTemplate: `<p>Acompanhamento pré-natal obstétrico.</p>`,
    formFields: [
      { id: 'biometriaCalc', type: 'calculator', label: 'Biometria Fetal (Hadlock)', calculatorId: 'fetal-biometry' },
      { id: 'amnioticoCalc', type: 'calculator', label: 'Cálculo de Líquido Amniótico', calculatorId: 'amniotic-fluid' },
      { id: 'situacao', type: 'select', label: 'Situação', options: [{label:'Longitudinal',value:'longitudinal'},{label:'Transversa',value:'transversa'},{label:'Oblíqua',value:'obliqua'}], defaultValue: 'longitudinal' },
      { id: 'apresentacao', type: 'select', label: 'Apresentação', options: [{label:'Cefálica',value:'cefalica'},{label:'Pélvica',value:'pelvica'},{label:'Córmica',value:'cormica'}], defaultValue: 'cefalica' },
      { id: 'dorso', type: 'select', label: 'Dorso', options: [{label:'Direita',value:'direita'},{label:'Esquerda',value:'esquerda'},{label:'Anterior',value:'anterior'},{label:'Posterior',value:'posterior'}], defaultValue: 'esquerda' },
      { id: 'bcf', type: 'number', label: 'BCF (bpm)' },
      { id: 'insercaoPlacenta', type: 'select', label: 'Inserção Placentária', options: [{label:'Anterior',value:'anterior'},{label:'Posterior',value:'posterior'},{label:'Fúndica',value:'fundica'},{label:'Prévia',value:'previa'}] },
      { id: 'grauPlacenta', type: 'select', label: 'Grau Placentário', options: [{label:'0',value:'0'},{label:'I',value:'I'},{label:'II',value:'II'},{label:'III',value:'III'}], defaultValue: 'I' }
    ]
  },
  {
    area: 'medicina-fetal',
    name: 'Morfológico de Segundo Trimestre',
    description: 'Avaliação detalhada da anatomia fetal (20-24 semanas).',
    title: 'ULTRASSONOGRAFIA MORFOLÓGICA DO SEGUNDO TRIMESTRE',
    technique: 'Exame realizado com transdutor convexo abdominal, varredura morfológica detalhada.',
    analysisTemplate: `<p><strong>CRÂNIO E SISTEMA NERVOSO CENTRAL:</strong> Calota craniana íntegra. Foice do cérebro centrada. Cavum do septo pelúcido presente. Ventrículos laterais normais (Atrium: [atrio] mm). Cerebelo (Diâmetro transverso: [cerebelo] mm) e cisterna magna (Diâmetro: [cisternaMagna] mm) com aspectos anatômicos.</p>
<p><strong>FACE:</strong> Perfil fetal normal. Osso nasal presente ([ossoNasal] mm). Lábio superior íntegro.</p>
<p><strong>PESCOÇO:</strong> Ausência de massas ou higroma cístico. Prega nucal: [pregaNucal] mm.</p>
<p><strong>TÓRAX E CORAÇÃO:</strong> Pulmões homogêneos. Coração tópico, situs solitus, eixo cardíaco preservado. Ritmo cardíaco regular ([bcf] bpm). Corte de 4 câmaras e vias de saída de VD e VE anatômicos.</p>
<p><strong>ABDOME:</strong> Parede abdominal anterior fechada. Estômago presente e bem posicionado. Vesícula biliar visualizada. Intestino de ecogenicidade habitual.</p>
<p><strong>SISTEMA GENITURINÁRIO:</strong> Ambos os rins presentes e de dimensões normais. Bexiga urinária visualizada e com enchimento normal.</p>
<p><strong>COLUNA VERTEBRAL:</strong> Íntegra nos planos longitudinal e transversal, sem sinais de disrafismos.</p>
<p><strong>MEMBROS:</strong> Quatro extremidades presentes, com 3 segmentos ósseos identificáveis em cada.</p>
<p><strong>BIOMETRIA E ANEXOS:</strong> Peso Estimado: [pesoFetal] g ([percentilPeso]). Placenta [insercaoPlacenta], grau [grauPlacenta]. ILA: [ila] cm.</p>`,
    conclusionTemplate: `<p>Estudo morfológico fetal sem evidências de anomalias estruturais grosseiras.</p>
<p>Crescimento fetal no percentil [percentilPeso].</p>`,
    recommendationsTemplate: `<p>Acompanhamento pré-natal de rotina.</p>`,
    formFields: [
      { id: 'biometriaCalc', type: 'calculator', label: 'Biometria Fetal (Hadlock)', calculatorId: 'fetal-biometry' },
      { id: 'atrio', type: 'number', label: 'Átrio Ventricular (mm)', defaultValue: '6' },
      { id: 'cerebelo', type: 'number', label: 'Cerebelo (mm)' },
      { id: 'cisternaMagna', type: 'number', label: 'Cisterna Magna (mm)', defaultValue: '5' },
      { id: 'ossoNasal', type: 'number', label: 'Osso Nasal (mm)' },
      { id: 'pregaNucal', type: 'number', label: 'Prega Nucal (mm)' },
      { id: 'bcf', type: 'number', label: 'BCF (bpm)' },
      { id: 'insercaoPlacenta', type: 'select', label: 'Inserção Placentária', options: [{label:'Anterior',value:'anterior'},{label:'Posterior',value:'posterior'},{label:'Fúndica',value:'fundica'},{label:'Prévia',value:'previa'}] },
      { id: 'grauPlacenta', type: 'select', label: 'Grau Placentário', options: [{label:'0',value:'0'},{label:'I',value:'I'},{label:'II',value:'II'},{label:'III',value:'III'}], defaultValue: '0' }
    ]
  }
];
