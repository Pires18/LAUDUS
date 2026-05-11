import { ReportTemplate } from '../../types';

export const PEDIATRIA_TEMPLATES: Partial<ReportTemplate>[] = [
  {
    area: 'pediatria',
    name: 'Transfontanela',
    description: 'Avaliação encefálica neonatal via fontanela anterior.',
    title: 'ULTRASSONOGRAFIA TRANSFONTANELAR',
    technique: 'Exame realizado com transdutor microconvexo e linear de alta frequência através da fontanela anterior.',
    analysisTemplate: `<p>Sistema ventricular de dimensões, morfologia e simetria conservadas, sem sinais de dilatação.</p>
<p>Ausência de assimetrias ou desvios das estruturas da linha média.</p>
<p>Plexos coroides homogêneos e ecogênicos, sem coleções císticas.</p>
<p>Sulcos e giros corticais com aspecto preservado e adequado para a idade cronológica.</p>
<p>Parênquima cerebral e cerebelar com ecogenicidade fisiológica, sem lesões focais ou áreas de alteração ecotextural.</p>
<p>Fissura inter-hemisférica e espaço subaracnóideo de amplitudes normais.</p>`,
    conclusionTemplate: `<p>Exame ultrassonográfico transfontanelar dentro dos limites da normalidade.</p>`,
    recommendationsTemplate: `<p>A critério clínico pediátrico.</p>`,
    formFields: [
      { id: 'espacoSubaracnoideo', type: 'select', label: 'Espaço Subaracnoideo', options: [{label:'Normal',value:'Normal'},{label:'Aumentado',value:'Aumentado'}], defaultValue: 'Normal' },
      { id: 'ventriculos', type: 'select', label: 'Ventrículos Laterais', options: [{label:'Normais',value:'Normais'},{label:'Dilatados',value:'Dilatados'}], defaultValue: 'Normais' }
    ]
  }
];
