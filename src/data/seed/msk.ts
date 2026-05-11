import { ReportTemplate } from '../../types';

export const MSK_TEMPLATES: Partial<ReportTemplate>[] = [
  {
    area: 'musculoesqueletico',
    name: 'Ombro',
    description: 'Avaliação articular do ombro (manguito rotador).',
    title: 'ULTRASSONOGRAFIA DO OMBRO',
    technique: 'Exame realizado com transdutor linear de alta frequência.',
    analysisTemplate: `<p><strong>TENDÃO DO CABO LONGO DO BÍCEPS:</strong> Tópico, de espessura e ecotextura normais, sem líquido na bainha sinovial.</p>
<p><strong>TENDÃO SUBESCAPULAR:</strong> De espessura e ecotextura normais, sem rupturas ou calcificações.</p>
<p><strong>TENDÃO SUPRAESPINHAL:</strong> De espessura e ecotextura normais, sem rupturas ou calcificações. Ausência de sinais de impacto subacromial.</p>
<p><strong>TENDÃO INFRAESPINHAL:</strong> De espessura e ecotextura normais.</p>
<p><strong>BURSAS:</strong> Bursas subacromial-subdeltoidea e subcoracoide sem espessamentos ou coleções líquidas.</p>
<p><strong>ARTICULAÇÃO ACROMIOCLAVICULAR:</strong> De aspecto normal, sem derrames ou irregularidades corticais significativas.</p>
<p><strong>VENTRES MUSCULARES:</strong> Ecotrofismo conservado.</p>`,
    conclusionTemplate: `<p>Exame ultrassonográfico do ombro dentro dos limites da normalidade.</p>`,
    recommendationsTemplate: `<p>A critério clínico.</p>`,
    formFields: [
      { id: 'supraespinhal', type: 'select', label: 'Tendão Supraespinhal', options: [{label:'Normal',value:'Normal'},{label:'Tendinopatia',value:'Tendinopatia'},{label:'Ruptura Parcial',value:'Ruptura Parcial'},{label:'Ruptura Transfixante',value:'Ruptura Transfixante'}], defaultValue: 'Normal' },
      { id: 'bursite', type: 'select', label: 'Bursite Subacromial', options: [{label:'Ausente',value:'Ausente'},{label:'Presente',value:'Presente'}], defaultValue: 'Ausente' },
      { id: 'derrame', type: 'select', label: 'Derrame Articular', options: [{label:'Ausente',value:'Ausente'},{label:'Presente',value:'Presente'}], defaultValue: 'Ausente' }
    ]
  },
  {
    area: 'musculoesqueletico',
    name: 'Joelho',
    description: 'Avaliação articular do joelho.',
    title: 'ULTRASSONOGRAFIA DO JOELHO',
    technique: 'Exame realizado com transdutor linear de alta frequência.',
    analysisTemplate: `<p><strong>TENDÃO QUADRICIPITAL:</strong> Tópico, de espessura e ecotextura normais.</p>
<p><strong>TENDÃO PATELAR:</strong> Tópico, de espessura e ecotextura normais.</p>
<p><strong>LIGAMENTOS COLATERAIS:</strong> Ligamentos colaterais medial e lateral de espessura e ecotextura normais.</p>
<p><strong>MENISCOS:</strong> Cornos anteriores e posteriores dos meniscos medial e lateral sem sinais ecográficos de rupturas grosseiras periféricas.</p>
<p><strong>ESPAÇO ARTICULAR:</strong> Ausência de derrame articular significativo ou proliferação sinovial.</p>
<p><strong>FOSSA POPLÍTEA:</strong> Ausência de cisto de Baker ou outras coleções.</p>`,
    conclusionTemplate: `<p>Exame ultrassonográfico do joelho sem anormalidades significativas.</p>`,
    recommendationsTemplate: `<p>A critério clínico.</p>`,
    formFields: [
      { id: 'cistoBaker', type: 'select', label: 'Cisto de Baker', options: [{label:'Ausente',value:'Ausente'},{label:'Presente',value:'Presente'}], defaultValue: 'Ausente' },
      { id: 'derrameArticular', type: 'select', label: 'Derrame Articular', options: [{label:'Ausente',value:'Ausente'},{label:'Pequeno',value:'Pequeno'},{label:'Moderado',value:'Moderado'},{label:'Volumoso',value:'Volumoso'}], defaultValue: 'Ausente' },
      { id: 'tendinopatiaPatelar', type: 'select', label: 'Tendinopatia Patelar', options: [{label:'Ausente',value:'Ausente'},{label:'Presente',value:'Presente'}], defaultValue: 'Ausente' }
    ]
  }
];
