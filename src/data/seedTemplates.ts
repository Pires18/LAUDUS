import { ReportTemplate } from '../types';
import { genId } from '../store/db';

const ts = () => Date.now();

export function createSeedTemplates(): ReportTemplate[] {
  const now = ts();

  const templates: ReportTemplate[] = [
    // ─── MEDICINA INTERNA ──────────────────────────────────────────
    {
      id: genId(),
      area: 'medicina-interna',
      name: 'Ultrassom Abdominal Total',
      description: 'Avaliação ultrassonográfica completa do abdome',
      title: 'ULTRASSONOGRAFIA DE ABDOME TOTAL',
      technique:
        'Exame realizado com transdutor convexo de 3,5 a 5,0 MHz, em modo B, com paciente em jejum, em decúbito dorsal e laterais.',
      analysisTemplate: `Fígado de dimensões, contornos e ecotextura habituais, sem lesões focais identificáveis. Veias hepáticas e porta de calibre e fluxo preservados.
Vesícula biliar de paredes finas, conteúdo anecogênico, sem cálculos. Vias biliares intra e extra-hepáticas não dilatadas.
Pâncreas de morfologia e ecogenicidade preservadas, ducto de Wirsung não dilatado.
Baço de dimensões e ecotextura habituais, sem lesões focais.
Rins tópicos, de dimensões, contornos e ecotextura habituais, sem cálculos ou dilatação pielocalicinal.
Bexiga em adequado grau de repleção, paredes finas e regulares, conteúdo anecogênico.
Ausência de líquido livre na cavidade abdominal.`,
      conclusionTemplate: 'Exame ultrassonográfico do abdome total dentro dos limites da normalidade.',
      recommendationsTemplate: 'Correlação clínica e laboratorial.',
      formFields: [
        { id: genId(), type: 'separator', label: 'FÍGADO' },
        { id: genId(), type: 'select', label: 'Dimensões', options: [
          { value: 'normais', label: 'Normais' },
          { value: 'aumentadas', label: 'Aumentadas' },
          { value: 'reduzidas', label: 'Reduzidas' },
        ]},
        { id: genId(), type: 'select', label: 'Ecotextura', options: [
          { value: 'habitual', label: 'Habitual' },
          { value: 'esteatose-leve', label: 'Esteatose leve' },
          { value: 'esteatose-moderada', label: 'Esteatose moderada' },
          { value: 'esteatose-acentuada', label: 'Esteatose acentuada' },
          { value: 'heterogenea', label: 'Heterogênea' },
        ]},
        { id: genId(), type: 'textarea', label: 'Lesões focais hepáticas', placeholder: 'Descrever se houver' },
        { id: genId(), type: 'separator', label: 'VESÍCULA BILIAR' },
        { id: genId(), type: 'select', label: 'Paredes', options: [
          { value: 'finas', label: 'Finas' },
          { value: 'espessadas', label: 'Espessadas' },
        ]},
        { id: genId(), type: 'checkbox', label: 'Cálculos presentes' },
        { id: genId(), type: 'textarea', label: 'Outros achados na vesícula' },
        { id: genId(), type: 'separator', label: 'RINS' },
        { id: genId(), type: 'measurement', label: 'Rim direito - comprimento', unit: 'mm' },
        { id: genId(), type: 'measurement', label: 'Rim esquerdo - comprimento', unit: 'mm' },
        { id: genId(), type: 'checkbox', label: 'Cálculos renais' },
        { id: genId(), type: 'checkbox', label: 'Dilatação pielocalicinal' },
        { id: genId(), type: 'separator', label: 'OUTROS' },
        { id: genId(), type: 'textarea', label: 'Pâncreas / Baço / Bexiga - observações' },
        { id: genId(), type: 'textarea', label: 'Outros achados relevantes' },
      ],
      aiInstructions:
        'Quando houver esteatose, classificar e correlacionar. Em caso de cálculos, descrever número aproximado e tamanho do maior. Sempre mencionar ausência de líquido livre quando não houver achado.',
      createdAt: now,
      updatedAt: now,
    },

    // ─── GINECOLOGIA ──────────────────────────────────────────────
    {
      id: genId(),
      area: 'ginecologia',
      name: 'Ultrassom Pélvico Transvaginal',
      description: 'Avaliação ginecológica por via transvaginal',
      title: 'ULTRASSONOGRAFIA PÉLVICA TRANSVAGINAL',
      technique:
        'Exame realizado por via transvaginal, com transdutor endocavitário de alta frequência, em modo B e Doppler colorido quando indicado.',
      analysisTemplate: `Útero em anteversoflexão, de contornos regulares e ecotextura miometrial homogênea.
Endométrio de aspecto e espessura compatíveis com a fase do ciclo menstrual.
Ovários tópicos, de dimensões e ecotextura habituais, com folículos antrais visíveis.
Ausência de líquido livre em fundo de saco posterior.`,
      conclusionTemplate: 'Exame ultrassonográfico pélvico transvaginal dentro dos limites da normalidade.',
      recommendationsTemplate: 'Correlação clínica.',
      formFields: [
        { id: genId(), type: 'date', label: 'Data da última menstruação (DUM)' },
        { id: genId(), type: 'separator', label: 'ÚTERO' },
        { id: genId(), type: 'select', label: 'Posição', options: [
          { value: 'AVF', label: 'Anteversoflexão (AVF)' },
          { value: 'RVF', label: 'Retroversoflexão (RVF)' },
          { value: 'medio', label: 'Médio' },
        ]},
        { id: genId(), type: 'measurement', label: 'Comprimento longitudinal', unit: 'mm' },
        { id: genId(), type: 'measurement', label: 'Diâmetro AP', unit: 'mm' },
        { id: genId(), type: 'measurement', label: 'Diâmetro transverso', unit: 'mm' },
        { id: genId(), type: 'measurement', label: 'Volume uterino', unit: 'cm³' },
        { id: genId(), type: 'separator', label: 'ENDOMÉTRIO' },
        { id: genId(), type: 'measurement', label: 'Espessura endometrial', unit: 'mm' },
        { id: genId(), type: 'select', label: 'Aspecto endometrial', options: [
          { value: 'proliferativo', label: 'Proliferativo' },
          { value: 'secretor', label: 'Secretor' },
          { value: 'menstrual', label: 'Menstrual' },
          { value: 'atrofico', label: 'Atrófico' },
          { value: 'heterogeneo', label: 'Heterogêneo' },
        ]},
        { id: genId(), type: 'separator', label: 'MIOMETRIO / MIOMAS' },
        { id: genId(), type: 'checkbox', label: 'Presença de miomas' },
        { id: genId(), type: 'textarea', label: 'Descrição dos miomas (localização, dimensões, classificação FIGO)' },
        { id: genId(), type: 'separator', label: 'OVÁRIOS' },
        { id: genId(), type: 'measurement', label: 'Volume ovário direito', unit: 'cm³' },
        { id: genId(), type: 'measurement', label: 'Volume ovário esquerdo', unit: 'cm³' },
        { id: genId(), type: 'textarea', label: 'Cistos / lesões ovarianas' },
        { id: genId(), type: 'separator', label: 'OUTROS' },
        { id: genId(), type: 'checkbox', label: 'Líquido livre em fundo de saco' },
        { id: genId(), type: 'textarea', label: 'Outras observações' },
      ],
      createdAt: now,
      updatedAt: now,
    },

    // ─── MEDICINA FETAL ────────────────────────────────────────────
    {
      id: genId(),
      area: 'medicina-fetal',
      name: 'Ultrassom Obstétrico Morfológico - 2º Trimestre',
      description: 'Morfológico de segundo trimestre (20-24 semanas)',
      title: 'ULTRASSONOGRAFIA OBSTÉTRICA MORFOLÓGICA DE SEGUNDO TRIMESTRE',
      technique:
        'Exame realizado com transdutor convexo de 3,5 a 5,0 MHz, em modo B, Doppler colorido e pulsátil. Avaliação morfológica fetal sistemática segundo recomendações da SBUS/ISUOG.',
      analysisTemplate: `Gestação tópica, única, com feto em apresentação cefálica.
Atividade cardíaca presente e rítmica.
Movimentação fetal presente.
Biometria fetal compatível com idade gestacional.
Avaliação morfológica fetal sem alterações significativas identificadas (cabeça, face, coluna, tórax, coração, abdome, membros).
Placenta de inserção e maturação habituais para a idade gestacional.
Líquido amniótico em quantidade adequada.`,
      conclusionTemplate:
        'Gestação tópica única, em evolução, com feto vivo, biometria compatível com idade gestacional e avaliação morfológica sem alterações significativas no momento do exame.',
      classificationTemplate:
        'Classificação de risco morfológico: BAIXO RISCO. Marcadores de cromossomopatia: ausentes.',
      recommendationsTemplate:
        'Manter acompanhamento pré-natal. Reavaliação ultrassonográfica conforme rotina obstétrica.',
      formFields: [
        { id: genId(), type: 'date', label: 'DUM' },
        { id: genId(), type: 'text', label: 'IG por DUM (sem+dias)', placeholder: '22s4d' },
        { id: genId(), type: 'text', label: 'IG ultrassonográfica', placeholder: '22s2d' },
        { id: genId(), type: 'separator', label: 'BIOMETRIA FETAL' },
        { id: genId(), type: 'measurement', label: 'DBP', unit: 'mm' },
        { id: genId(), type: 'measurement', label: 'CC', unit: 'mm' },
        { id: genId(), type: 'measurement', label: 'CA', unit: 'mm' },
        { id: genId(), type: 'measurement', label: 'CF', unit: 'mm' },
        { id: genId(), type: 'measurement', label: 'Peso fetal estimado', unit: 'g' },
        { id: genId(), type: 'text', label: 'Percentil do peso' },
        { id: genId(), type: 'separator', label: 'VITALIDADE' },
        { id: genId(), type: 'measurement', label: 'FCF', unit: 'bpm' },
        { id: genId(), type: 'select', label: 'Movimentação fetal', options: [
          { value: 'presente', label: 'Presente' },
          { value: 'reduzida', label: 'Reduzida' },
        ]},
        { id: genId(), type: 'separator', label: 'PLACENTA / LA' },
        { id: genId(), type: 'select', label: 'Localização placentária', options: [
          { value: 'anterior', label: 'Anterior' },
          { value: 'posterior', label: 'Posterior' },
          { value: 'fundica', label: 'Fúndica' },
          { value: 'lateral-d', label: 'Lateral direita' },
          { value: 'lateral-e', label: 'Lateral esquerda' },
          { value: 'previa', label: 'Prévia' },
        ]},
        { id: genId(), type: 'select', label: 'Grau placentário', options: [
          { value: '0', label: 'Grau 0' },
          { value: '1', label: 'Grau I' },
          { value: '2', label: 'Grau II' },
          { value: '3', label: 'Grau III' },
        ]},
        { id: genId(), type: 'measurement', label: 'ILA', unit: 'cm' },
        { id: genId(), type: 'measurement', label: 'Maior bolsão', unit: 'cm' },
        { id: genId(), type: 'separator', label: 'MORFOLOGIA' },
        { id: genId(), type: 'textarea', label: 'SNC / Crânio' },
        { id: genId(), type: 'textarea', label: 'Face / Pescoço' },
        { id: genId(), type: 'textarea', label: 'Tórax / Coração' },
        { id: genId(), type: 'textarea', label: 'Abdome' },
        { id: genId(), type: 'textarea', label: 'Coluna / Membros' },
        { id: genId(), type: 'textarea', label: 'Marcadores e outros achados' },
      ],
      aiInstructions:
        'Sempre incluir biometria detalhada quando preenchida. Quando houver marcadores ou achados morfológicos, descrever de forma estruturada e classificar o risco adequadamente. Manter linguagem técnica obstétrica padrão.',
      createdAt: now,
      updatedAt: now,
    },

    // ─── PEQUENAS PARTES ──────────────────────────────────────────
    {
      id: genId(),
      area: 'pequenas-partes',
      name: 'Ultrassom de Tireoide',
      description: 'Avaliação tireoidiana com classificação TI-RADS',
      title: 'ULTRASSONOGRAFIA DE TIREOIDE',
      technique:
        'Exame realizado com transdutor linear de alta frequência (7,5 a 12 MHz), em modo B e Doppler colorido.',
      analysisTemplate: `Tireoide tópica, de contornos regulares, ecotextura habitual e dimensões dentro da normalidade. Vascularização ao Doppler preservada. Ausência de nódulos. Linfonodos cervicais sem alterações.`,
      conclusionTemplate: 'Ultrassonografia de tireoide dentro dos limites da normalidade.',
      classificationTemplate: 'TI-RADS — quando houver nódulo.',
      recommendationsTemplate: 'Correlação clínica e laboratorial.',
      formFields: [
        { id: genId(), type: 'separator', label: 'LOBO DIREITO' },
        { id: genId(), type: 'measurement', label: 'Comprimento (LD)', unit: 'mm' },
        { id: genId(), type: 'measurement', label: 'Largura (LD)', unit: 'mm' },
        { id: genId(), type: 'measurement', label: 'Espessura (LD)', unit: 'mm' },
        { id: genId(), type: 'measurement', label: 'Volume LD', unit: 'cm³' },
        { id: genId(), type: 'separator', label: 'LOBO ESQUERDO' },
        { id: genId(), type: 'measurement', label: 'Comprimento (LE)', unit: 'mm' },
        { id: genId(), type: 'measurement', label: 'Largura (LE)', unit: 'mm' },
        { id: genId(), type: 'measurement', label: 'Espessura (LE)', unit: 'mm' },
        { id: genId(), type: 'measurement', label: 'Volume LE', unit: 'cm³' },
        { id: genId(), type: 'measurement', label: 'Volume total', unit: 'cm³' },
        { id: genId(), type: 'separator', label: 'NÓDULOS' },
        { id: genId(), type: 'checkbox', label: 'Presença de nódulos' },
        { id: genId(), type: 'textarea', label: 'Descrição dos nódulos (localização, dimensões, características)' },
        { id: genId(), type: 'select', label: 'TI-RADS', options: [
          { value: '', label: 'Não aplicável' },
          { value: 'TR1', label: 'TR1 - Benigno' },
          { value: 'TR2', label: 'TR2 - Não suspeito' },
          { value: 'TR3', label: 'TR3 - Levemente suspeito' },
          { value: 'TR4', label: 'TR4 - Moderadamente suspeito' },
          { value: 'TR5', label: 'TR5 - Altamente suspeito' },
        ]},
        { id: genId(), type: 'separator', label: 'OUTROS' },
        { id: genId(), type: 'textarea', label: 'Linfonodos cervicais' },
        { id: genId(), type: 'textarea', label: 'Outras observações' },
      ],
      createdAt: now,
      updatedAt: now,
    },

    // ─── MUSCULOESQUELÉTICO ───────────────────────────────────────
    {
      id: genId(),
      area: 'musculoesqueletico',
      name: 'Ultrassom de Ombro',
      description: 'Avaliação musculoesquelética do ombro',
      title: 'ULTRASSONOGRAFIA DO OMBRO',
      technique:
        'Exame realizado com transdutor linear de alta frequência (7,5 a 14 MHz), em modo B e Doppler colorido, com manobras dinâmicas.',
      analysisTemplate: `Tendão do supraespinhal de espessura, ecotextura e inserção habituais.
Tendão do infraespinhal de aspecto preservado.
Tendão do subescapular sem alterações.
Cabeça longa do bíceps tópica, sem subluxação ou tendinopatia.
Bursa subacromial-subdeltoidea sem distensão líquida.
Articulação acromioclavicular sem alterações significativas.
Ausência de derrame articular gleno-umeral.`,
      conclusionTemplate: 'Ultrassonografia do ombro dentro dos limites da normalidade.',
      recommendationsTemplate: 'Correlação clínica.',
      formFields: [
        { id: genId(), type: 'select', label: 'Lado examinado', options: [
          { value: 'D', label: 'Direito' },
          { value: 'E', label: 'Esquerdo' },
          { value: 'B', label: 'Bilateral' },
        ]},
        { id: genId(), type: 'separator', label: 'MANGUITO ROTADOR' },
        { id: genId(), type: 'select', label: 'Supraespinhal', options: [
          { value: 'normal', label: 'Normal' },
          { value: 'tendinopatia', label: 'Tendinopatia' },
          { value: 'rotura-parcial', label: 'Rotura parcial' },
          { value: 'rotura-total', label: 'Rotura total' },
        ]},
        { id: genId(), type: 'select', label: 'Infraespinhal', options: [
          { value: 'normal', label: 'Normal' },
          { value: 'tendinopatia', label: 'Tendinopatia' },
          { value: 'rotura-parcial', label: 'Rotura parcial' },
          { value: 'rotura-total', label: 'Rotura total' },
        ]},
        { id: genId(), type: 'select', label: 'Subescapular', options: [
          { value: 'normal', label: 'Normal' },
          { value: 'tendinopatia', label: 'Tendinopatia' },
          { value: 'rotura-parcial', label: 'Rotura parcial' },
          { value: 'rotura-total', label: 'Rotura total' },
        ]},
        { id: genId(), type: 'separator', label: 'BÍCEPS / BURSA / OUTROS' },
        { id: genId(), type: 'select', label: 'Cabeça longa do bíceps', options: [
          { value: 'normal', label: 'Normal' },
          { value: 'tenossinovite', label: 'Tenossinovite' },
          { value: 'subluxacao', label: 'Subluxação' },
          { value: 'rotura', label: 'Rotura' },
        ]},
        { id: genId(), type: 'select', label: 'Bursa subacromial-subdeltoidea', options: [
          { value: 'sem-alteracoes', label: 'Sem alterações' },
          { value: 'bursite', label: 'Bursite' },
        ]},
        { id: genId(), type: 'textarea', label: 'Articulação acromioclavicular' },
        { id: genId(), type: 'textarea', label: 'Outros achados' },
      ],
      createdAt: now,
      updatedAt: now,
    },

    // ─── VASCULAR ─────────────────────────────────────────────────
    {
      id: genId(),
      area: 'vascular',
      name: 'Doppler Venoso de MMII',
      description: 'Doppler venoso dos membros inferiores - investigação de TVP',
      title: 'ULTRASSONOGRAFIA COM DOPPLER VENOSO DOS MEMBROS INFERIORES',
      technique:
        'Exame realizado com transdutores linear e convexo, em modo B, Doppler colorido, espectral e pulsátil. Manobras de compressão venosa, Valsalva e compressão distal foram realizadas.',
      analysisTemplate: `Sistema venoso profundo dos membros inferiores patente, compressível, com fluxo fásico, espontâneo, modulado pela respiração e adequada augmentação distal. Ausência de trombos endoluminais. Veias safenas magna e parva pérvias e competentes.`,
      conclusionTemplate:
        'Ausência de sinais de trombose venosa profunda nos segmentos avaliados em ambos os membros inferiores.',
      recommendationsTemplate: 'Correlação clínica.',
      formFields: [
        { id: genId(), type: 'select', label: 'Lado examinado', options: [
          { value: 'B', label: 'Bilateral' },
          { value: 'D', label: 'Direito' },
          { value: 'E', label: 'Esquerdo' },
        ]},
        { id: genId(), type: 'separator', label: 'SISTEMA PROFUNDO' },
        { id: genId(), type: 'select', label: 'Veia femoral comum (D)', options: [
          { value: 'patente', label: 'Patente' },
          { value: 'trombose-aguda', label: 'Trombose aguda' },
          { value: 'trombose-cronica', label: 'Trombose crônica' },
        ]},
        { id: genId(), type: 'select', label: 'Veia femoral comum (E)', options: [
          { value: 'patente', label: 'Patente' },
          { value: 'trombose-aguda', label: 'Trombose aguda' },
          { value: 'trombose-cronica', label: 'Trombose crônica' },
        ]},
        { id: genId(), type: 'select', label: 'Veia poplítea (D)', options: [
          { value: 'patente', label: 'Patente' },
          { value: 'trombose-aguda', label: 'Trombose aguda' },
          { value: 'trombose-cronica', label: 'Trombose crônica' },
        ]},
        { id: genId(), type: 'select', label: 'Veia poplítea (E)', options: [
          { value: 'patente', label: 'Patente' },
          { value: 'trombose-aguda', label: 'Trombose aguda' },
          { value: 'trombose-cronica', label: 'Trombose crônica' },
        ]},
        { id: genId(), type: 'separator', label: 'SISTEMA SUPERFICIAL' },
        { id: genId(), type: 'checkbox', label: 'Insuficiência da safena magna' },
        { id: genId(), type: 'checkbox', label: 'Insuficiência da safena parva' },
        { id: genId(), type: 'textarea', label: 'Veias varicosas / outras alterações' },
        { id: genId(), type: 'textarea', label: 'Observações' },
      ],
      aiInstructions:
        'Em casos de TVP, sempre especificar nível, extensão e cronicidade. Avaliar sempre sistema profundo e superficial. Reportar competência valvar quando relevante.',
      createdAt: now,
      updatedAt: now,
    },

    // ─── PROCEDIMENTOS ────────────────────────────────────────────
    {
      id: genId(),
      area: 'procedimentos',
      name: 'Punção/Biópsia Guiada por US',
      description: 'Procedimento guiado por ultrassom',
      title: 'PROCEDIMENTO GUIADO POR ULTRASSONOGRAFIA',
      technique:
        'Procedimento realizado em ambiente adequado, sob assepsia e antissepsia rigorosas, com anestesia local quando indicada, sob orientação ultrassonográfica em tempo real.',
      analysisTemplate: `Após consentimento informado, paciente posicionado adequadamente. Realizada antissepsia do sítio com clorexidina alcoólica e colocação de campos estéreis. Sob orientação ultrassonográfica em tempo real, foi puncionada a lesão-alvo.`,
      conclusionTemplate: 'Procedimento realizado sem intercorrências imediatas.',
      recommendationsTemplate:
        'Orientações pós-procedimento fornecidas ao paciente. Material encaminhado para análise. Retorno conforme orientação clínica.',
      formFields: [
        { id: genId(), type: 'select', label: 'Tipo de procedimento', options: [
          { value: 'paaf', label: 'PAAF (punção aspirativa)' },
          { value: 'biopsia-core', label: 'Biópsia por agulha grossa (core)' },
          { value: 'drenagem', label: 'Drenagem' },
          { value: 'infiltracao', label: 'Infiltração' },
          { value: 'marcacao', label: 'Marcação pré-operatória' },
        ]},
        { id: genId(), type: 'text', label: 'Sítio anatômico' },
        { id: genId(), type: 'textarea', label: 'Descrição da lesão-alvo' },
        { id: genId(), type: 'text', label: 'Calibre da agulha', placeholder: 'ex: 22G' },
        { id: genId(), type: 'number', label: 'Número de passagens' },
        { id: genId(), type: 'select', label: 'Anestesia', options: [
          { value: 'sem', label: 'Sem anestesia' },
          { value: 'lidocaina-1', label: 'Lidocaína 1%' },
          { value: 'lidocaina-2', label: 'Lidocaína 2%' },
        ]},
        { id: genId(), type: 'checkbox', label: 'Material adequado para análise' },
        { id: genId(), type: 'textarea', label: 'Intercorrências' },
        { id: genId(), type: 'textarea', label: 'Orientações pós-procedimento adicionais' },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];

  return templates;
}
