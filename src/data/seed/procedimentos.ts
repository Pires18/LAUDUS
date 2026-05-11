import { ReportTemplate } from '../../types';

export const PROCEDIMENTOS_TEMPLATES: Partial<ReportTemplate>[] = [
  {
    area: 'procedimentos',
    name: 'PAAF',
    description: 'Punção Aspirativa por Agulha Fina guiada por US.',
    title: 'PUNÇÃO ASPIRATIVA POR AGULHA FINA (PAAF) GUIADA POR ULTRASSONOGRAFIA',
    technique: 'Após antissepsia local e anestesia, procedeu-se a punção aspirativa por agulha fina (PAAF) sob visão ultrassonográfica direta e contínua.',
    analysisTemplate: `<p><strong>SÍTIO DA PUNÇÃO:</strong> [sitio].</p>
<p><strong>NÚMERO DE PASSAGENS:</strong> [passagens].</p>
<p><strong>ASPECTO DO MATERIAL:</strong> [aspectoMaterial].</p>
<p><strong>INTERCORRÊNCIAS:</strong> Ausentes. Procedimento bem tolerado.</p>`,
    conclusionTemplate: `<p>Procedimento realizado com sucesso, sem complicações imediatas.</p>
<p>Material encaminhado para estudo citopatológico.</p>`,
    recommendationsTemplate: `<p>Aguardar resultado anatomopatológico.</p>`,
    formFields: [
      { id: 'sitio', type: 'text', label: 'Local da Punção', required: true },
      { id: 'passagens', type: 'number', label: 'Número de Punções', defaultValue: '3' },
      { id: 'aspectoMaterial', type: 'text', label: 'Aspecto do Material', defaultValue: 'Sanguinolento' }
    ]
  }
];

export const REUMATO_TEMPLATES: Partial<ReportTemplate>[] = [
  {
    area: 'reumatologico',
    name: 'Mãos e Punhos',
    description: 'Avaliação articular focada em pesquisa de artrite/sinovite.',
    title: 'ULTRASSONOGRAFIA ARTICULAR (MÃOS E PUNHOS)',
    technique: 'Exame realizado com transdutor linear de alta frequência (Modo B e Doppler de Potência/Color).',
    analysisTemplate: `<p><strong>ARTICULAÇÕES RADIOCÁRPICAS E MÉDIO-CÁRPICAS:</strong> Ausência de derrame articular ou proliferação sinovial significativa.</p>
<p><strong>ARTICULAÇÕES METACARPOFALANGEANAS E INTERFALANGEANAS:</strong> Ausência de derrame ou espessamento sinovial.</p>
<p><strong>TENDÕES FLEXORES E EXTENSORES:</strong> Tópicos, de espessura conservada, sem líquido peritendíneo.</p>
<p><strong>SINAL DOPPLER:</strong> Ausência de hiperemia sinovial ao Doppler de potência.</p>`,
    conclusionTemplate: `<p>Exame ultrassonográfico sem evidências de processo inflamatório articular ativo no momento do exame.</p>`,
    recommendationsTemplate: `<p>Correlação clínica.</p>`,
    formFields: [
      { id: 'sinovite', type: 'select', label: 'Sinovite', options: [{label:'Ausente',value:'Ausente'},{label:'Leve',value:'Leve'},{label:'Moderada',value:'Moderada'},{label:'Acentuada',value:'Acentuada'}], defaultValue: 'Ausente' },
      { id: 'sinalDoppler', type: 'select', label: 'Doppler Articular', options: [{label:'Negativo',value:'Negativo'},{label:'Grau 1',value:'Grau 1'},{label:'Grau 2',value:'Grau 2'},{label:'Grau 3',value:'Grau 3'}], defaultValue: 'Negativo' }
    ]
  }
];
