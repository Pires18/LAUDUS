import { ReportTemplate } from '../../types';

export const GINECOLOGIA_TEMPLATES: Partial<ReportTemplate>[] = [
  {
    area: 'ginecologia',
    name: 'Pélvico Transvaginal',
    description: 'Avaliação padrão do útero e anexos via endovaginal.',
    title: 'ULTRASSONOGRAFIA PÉLVICA TRANSVAGINAL',
    technique: 'Exame realizado com transdutor endocavitário multifrequencial, após esvaziamento vesical.',
    analysisTemplate: `<p><strong>ÚTERO:</strong> Em anteversoflexão, de contornos regulares e ecotextura miometrial homogênea.</p>
<p>Volume uterino: [volumeUterino] cc.</p>
<p><strong>ENDOMÉTRIO:</strong> Centrado, regular, com espessura de [espessuraEndometrio] mm.</p>
<p><strong>OVÁRIO DIREITO:</strong> Tópico, de dimensões normais, contornos regulares e ecotextura habitual.</p>
<p>Volume: [volumeOvarioDireito] cc.</p>
<p><strong>OVÁRIO ESQUERDO:</strong> Tópico, de dimensões normais, contornos regulares e ecotextura habitual.</p>
<p>Volume: [volumeOvarioEsquerdo] cc.</p>
<p><strong>FUNDO DE SACO DE DOUGLAS:</strong> Livre de líquido.</p>`,
    conclusionTemplate: `<p>Exame ultrassonográfico pélvico transvaginal sem anormalidades significativas.</p>`,
    recommendationsTemplate: `<p>A critério clínico.</p>`,
    aiInstructions: 'Sempre que o volume ovariano for citado, adicione se está dentro dos padrões de normalidade para a faixa etária.',
    formFields: [
      { id: 'volumeUterino', type: 'measurement', label: 'Volume Uterino', unit: 'cc', required: true, defaultValue: '' },
      { id: 'espessuraEndometrio', type: 'measurement', label: 'Espessura Endometrial', unit: 'mm', required: true, defaultValue: '' },
      { id: 'volumeOvarioDireito', type: 'measurement', label: 'Volume Ovário Direito', unit: 'cc', required: true, defaultValue: '' },
      { id: 'volumeOvarioEsquerdo', type: 'measurement', label: 'Volume Ovário Esquerdo', unit: 'cc', required: true, defaultValue: '' },
      { id: 'miomas', type: 'textarea', label: 'Miomas (Descrever)', placeholder: 'Localização, tamanho, tipo...', required: false },
      { id: 'figo-calc', type: 'calculator', label: 'Classificação FIGO', calculatorId: 'figo-myoma' },
      { id: 'cistos', type: 'textarea', label: 'Cistos Ovarianos', required: false },
      { id: 'orads-calc', type: 'calculator', label: 'O-RADS (Risco Anexial)', calculatorId: 'orads-us-2022' }
    ]
  },
  {
    area: 'ginecologia',
    name: 'Pélvico Transvaginal com Doppler',
    description: 'Avaliação ginecológica + fluxometria doppler de útero/anexos.',
    title: 'ULTRASSONOGRAFIA PÉLVICA TRANSVAGINAL COM DOPPLER COLORIDO',
    technique: 'Exame realizado com transdutor endocavitário multifrequencial, com estudo Doppler colorido e pulsado.',
    analysisTemplate: `<p><strong>ÚTERO:</strong> Em anteversoflexão, de contornos regulares e ecotextura miometrial homogênea.</p>
<p>Volume uterino: [volumeUterino] cc.</p>
<p><strong>ENDOMÉTRIO:</strong> Centrado, regular, com espessura de [espessuraEndometrio] mm.</p>
<p><strong>OVÁRIO DIREITO:</strong> Tópico, de dimensões normais, contornos regulares e ecotextura habitual.</p>
<p>Volume: [volumeOvarioDireito] cc.</p>
<p><strong>OVÁRIO ESQUERDO:</strong> Tópico, de dimensões normais, contornos regulares e ecotextura habitual.</p>
<p>Volume: [volumeOvarioEsquerdo] cc.</p>
<p><strong>FUNDO DE SACO DE DOUGLAS:</strong> Livre de líquido.</p>
<p><strong>ESTUDO DOPPLER:</strong></p>
<p>Artérias Uterinas apresentando padrão espectral de alta resistência, fisiológico.</p>
<p>Artéria Uterina Direita: IP = [ipUterinaDireita], IR = [irUterinaDireita].</p>
<p>Artéria Uterina Esquerda: IP = [ipUterinaEsquerda], IR = [irUterinaEsquerda].</p>`,
    conclusionTemplate: `<p>Exame ultrassonográfico pélvico transvaginal e estudo Doppler sem anormalidades significativas.</p>`,
    recommendationsTemplate: `<p>A critério clínico.</p>`,
    formFields: [
      { id: 'volumeUterino', type: 'measurement', label: 'Volume Uterino', unit: 'cc', required: true, defaultValue: '' },
      { id: 'espessuraEndometrio', type: 'measurement', label: 'Espessura Endometrial', unit: 'mm', required: true, defaultValue: '' },
      { id: 'volumeOvarioDireito', type: 'measurement', label: 'Volume Ovário Direito', unit: 'cc', required: true, defaultValue: '' },
      { id: 'volumeOvarioEsquerdo', type: 'measurement', label: 'Volume Ovário Esquerdo', unit: 'cc', required: true, defaultValue: '' },
      { id: 'ipUterinaDireita', type: 'number', label: 'IP Uterina Dir', required: true, defaultValue: '' },
      { id: 'irUterinaDireita', type: 'number', label: 'IR Uterina Dir', required: true, defaultValue: '' },
      { id: 'ipUterinaEsquerda', type: 'number', label: 'IP Uterina Esq', required: true, defaultValue: '' },
      { id: 'irUterinaEsquerda', type: 'number', label: 'IR Uterina Esq', required: true, defaultValue: '' }
    ]
  },
  {
    area: 'ginecologia',
    name: 'Mamas',
    description: 'USG Mamária padrão.',
    title: 'ULTRASSONOGRAFIA DAS MAMAS',
    technique: 'Exame realizado com transdutor linear de alta frequência.',
    analysisTemplate: `<p>Pele e tecido celular subcutâneo de aspecto normal.</p>
<p>Tecido fibroglandular predominante, de ecotextura homogênea e ecogenicidade preservada.</p>
<p>Ausência de nódulos sólidos ou formações císticas ecograficamente detectáveis.</p>
<p>Ausência de distorções arquiteturais ou espessamentos cutâneos.</p>
<p>Regiões axilares livres de linfonodomegalias atípicas.</p>`,
    conclusionTemplate: `<p>Exame ultrassonográfico das mamas sem anormalidades significativas.</p>`,
    classificationTemplate: `<p><strong>BI-RADS® US: Categoria [biradsCategoria]</strong> - [biradsConduta]</p>`,
    recommendationsTemplate: `<p>Correlação com mamografia e rastreamento clínico anual.</p>`,
    formFields: [
      { id: 'birads', type: 'calculator', label: 'Classificação BI-RADS', calculatorId: 'birads-us-2013' },
      { id: 'nodulosDireita', type: 'textarea', label: 'Nódulos Mama Direita' },
      { id: 'nodulosEsquerda', type: 'textarea', label: 'Nódulos Mama Esquerda' }
    ]
  },
  {
    area: 'ginecologia',
    name: 'Pélvico Abdominal',
    description: 'Avaliação do útero e anexos via suprapúbica.',
    title: 'ULTRASSONOGRAFIA PÉLVICA VIA ABDOMINAL',
    technique: 'Exame realizado com transdutor convexo, via suprapúbica, com bexiga adequadamente repleta.',
    analysisTemplate: `<p><strong>BEXIGA:</strong> Repleta, de paredes finas e regulares, conteúdo anecóico.</p>
<p><strong>ÚTERO:</strong> Em anteversoflexão, de contornos regulares e ecotextura miometrial homogênea.</p>
<p>Volume uterino: [volumeUterino] cc.</p>
<p><strong>ENDOMÉTRIO:</strong> Centrado, com espessura de [espessuraEndometrio] mm.</p>
<p><strong>OVÁRIO DIREITO:</strong> Tópico, de dimensões normais, contornos regulares e ecotextura habitual.</p>
<p>Volume: [volumeOvarioDireito] cc.</p>
<p><strong>OVÁRIO ESQUERDO:</strong> Tópico, de dimensões normais, contornos regulares e ecotextura habitual.</p>
<p>Volume: [volumeOvarioEsquerdo] cc.</p>
<p><strong>FUNDO DE SACO DE DOUGLAS:</strong> Livre de líquido.</p>`,
    conclusionTemplate: `<p>Exame ultrassonográfico pélvico via abdominal sem anormalidades significativas.</p>`,
    recommendationsTemplate: `<p>A critério clínico.</p>`,
    formFields: [
      { id: 'volumeUterino', type: 'measurement', label: 'Volume Uterino', unit: 'cc', required: true, defaultValue: '' },
      { id: 'espessuraEndometrio', type: 'measurement', label: 'Espessura Endometrial', unit: 'mm', required: true, defaultValue: '' },
      { id: 'volumeOvarioDireito', type: 'measurement', label: 'Volume Ovário Direito', unit: 'cc', required: true, defaultValue: '' },
      { id: 'volumeOvarioEsquerdo', type: 'measurement', label: 'Volume Ovário Esquerdo', unit: 'cc', required: true, defaultValue: '' }
    ]
  },
  {
    area: 'ginecologia',
    name: 'Mamas com Doppler',
    description: 'USG Mamária com mapeamento de fluxo.',
    title: 'ULTRASSONOGRAFIA DAS MAMAS COM DOPPLER COLORIDO',
    technique: 'Exame realizado com transdutor linear de alta frequência, associado ao Doppler colorido.',
    analysisTemplate: `<p>Pele e tecido celular subcutâneo de aspecto normal.</p>
<p>Tecido fibroglandular predominante, de ecotextura homogênea e ecogenicidade preservada.</p>
<p>Ausência de nódulos sólidos ou formações císticas ecograficamente detectáveis.</p>
<p>Ao estudo Doppler, ausência de vascularização anômala ou assimetria de fluxo.</p>
<p>Regiões axilares livres de linfonodomegalias atípicas.</p>`,
    conclusionTemplate: `<p>Exame ultrassonográfico das mamas com estudo Doppler sem anormalidades significativas.</p>`,
    classificationTemplate: `<p><strong>BI-RADS® US: Categoria [biradsCategoria]</strong> - [biradsConduta]</p>`,
    recommendationsTemplate: `<p>Correlação com mamografia e rastreamento clínico anual.</p>`,
    formFields: [
      { id: 'birads', type: 'calculator', label: 'Classificação BI-RADS', calculatorId: 'birads-us-2013' },
      { id: 'vascularizacao', type: 'textarea', label: 'Vascularização ao Doppler' }
    ]
  }
];
