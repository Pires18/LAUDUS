import { ReportTemplate } from '../../types';

export const PEQUENAS_PARTES_TEMPLATES: Partial<ReportTemplate>[] = [
  {
    area: 'pequenas-partes',
    name: 'Tireóide',
    description: 'Avaliação morfológica da glândula tireoide, com classificação TI-RADS.',
    title: 'ULTRASSONOGRAFIA DA TIREOIDE',
    technique: 'Exame realizado com transdutor linear de alta frequência (modo B).',
    analysisTemplate: `<p><strong>TIREOIDE:</strong> Tópica, de dimensões normais, contornos regulares e ecotextura finamente granular e homogênea.</p>
<p>Lobo Direito: [loboDirVol] cc.</p>
<p>Lobo Esquerdo: [loboEsqVol] cc.</p>
<p>Istmo: [istmo] mm.</p>
<p>Volume Total Estimado: [volumeTotal] cc.</p>
<p>Ausência de nódulos ou formações císticas ecograficamente detectáveis.</p>
<p><strong>CADEIAS LINFONODAIS CERVICAIS:</strong> Ausência de linfonodomegalias atípicas nas cadeias cervicais exploradas.</p>`,
    conclusionTemplate: `<p>Glândula tireoide de aspecto ultrassonográfico dentro da normalidade.</p>`,
    classificationTemplate: `<p><strong>ACR TI-RADS®:</strong> Categoria [tiradsCategoria]</p>`,
    recommendationsTemplate: `<p>A critério clínico.</p>`,
    aiInstructions: 'Se houver descrição de nódulos preenchida no campo "Nódulos", incorpore a classificação TI-RADS na conclusão rigorosamente.',
    formFields: [
      { id: 'loboDirVol', type: 'measurement', label: 'Volume Lobo Direito', unit: 'cc', required: true },
      { id: 'loboEsqVol', type: 'measurement', label: 'Volume Lobo Esquerdo', unit: 'cc', required: true },
      { id: 'istmo', type: 'measurement', label: 'Espessura Istmo', unit: 'mm' },
      { id: 'volumeTotal', type: 'measurement', label: 'Volume Total', unit: 'cc' },
      { id: 'tiradsCalc', type: 'calculator', label: 'Calculadora TI-RADS', calculatorId: 'tirads-2017' },
      { id: 'nodulos', type: 'textarea', label: 'Descrição de Nódulos' }
    ]
  },
  {
    area: 'pequenas-partes',
    name: 'Bolsa Escrotal',
    description: 'Avaliação dos testículos e epidídimos.',
    title: 'ULTRASSONOGRAFIA DA BOLSA ESCROTAL',
    technique: 'Exame realizado com transdutor linear de alta frequência.',
    analysisTemplate: `<p>Bolsa escrotal de aspecto anatômico, com espessura da parede conservada.</p>
<p><strong>TESTÍCULOS:</strong> Tópicos, de dimensões normais, contornos regulares e ecotextura homogênea.</p>
<p>Testículo Direito: [volTestDir] cc.</p>
<p>Testículo Esquerdo: [volTestEsq] cc.</p>
<p><strong>EPIDÍDIMOS:</strong> Tópicos, de dimensões e ecotextura normais.</p>
<p>Ausência de coleções líquidas intraescrotais significativas (hidrocele).</p>
<p>Ausência de ectasia do plexo pampiniforme (varicocele).</p>`,
    conclusionTemplate: `<p>Exame ultrassonográfico da bolsa escrotal dentro dos limites da normalidade.</p>`,
    recommendationsTemplate: `<p>A critério clínico.</p>`,
    formFields: [
      { id: 'volTestDir', type: 'measurement', label: 'Volume Testículo Direito', unit: 'cc', required: true },
      { id: 'volTestEsq', type: 'measurement', label: 'Volume Testículo Esquerdo', unit: 'cc', required: true },
      { id: 'hidrocele', type: 'select', label: 'Hidrocele', options: [{label:'Ausente',value:'Ausente'},{label:'Pequena',value:'Pequena'},{label:'Moderada',value:'Moderada'},{label:'Volumosa',value:'Volumosa'}], defaultValue: 'Ausente' },
      { id: 'varicocele', type: 'select', label: 'Varicocele', options: [{label:'Ausente',value:'Ausente'},{label:'Grau I',value:'Grau I'},{label:'Grau II',value:'Grau II'},{label:'Grau III',value:'Grau III'}], defaultValue: 'Ausente' }
    ]
  }
];
