import { VolumeCalculator } from './components/VolumeCalculator';
import { TiradsCalculator } from './components/TiradsCalculator';
import { BiradsCalculator } from './components/BiradsCalculator';
import { OradsCalculator } from './components/OradsCalculator';
import { FigoCalculator } from './components/FigoCalculator';
import { GestationalAgeCalculator } from './components/GestationalAgeCalculator';
import { MsdCalculator } from './components/MsdCalculator';
import { CrlCalculator } from './components/CrlCalculator';
import { WhoFetalBiometryCalculator } from './components/WhoFetalBiometryCalculator';
import { DopplerCalculator } from './components/DopplerCalculator';
import { BarcelonaFetalGrowthCalculator } from './components/BarcelonaFetalGrowthCalculator';
import { ProstateWeightCalculator } from './components/ProstateWeightCalculator';
import { ImtCalculator } from './components/ImtCalculator';
import { AmnioticFluidCalculator } from './components/AmnioticFluidCalculator';
import { VascularRatiosCalculator } from './components/VascularRatiosCalculator';
import { PleuralEffusionCalculator } from './components/PleuralEffusionCalculator';
import { OrganReferenceCalculator } from './components/OrganReferenceCalculator';
import { IvcIndexCalculator } from './components/IvcIndexCalculator';
import { VenousCartographyCalculator } from './components/VenousCartographyCalculator';
import { TrisomyRiskCalculator } from './components/TrisomyRiskCalculator';
import { PreeclampsiaRiskCalculator } from './components/PreeclampsiaRiskCalculator';

import { ExamArea } from '../../types';

export interface CalculatorProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (val: any) => void;
  examDateMs?: number;
}

export interface CalculatorDef {
  id: string;
  name: string;
  description: string;
  component: React.FC<CalculatorProps>;
  areas: ExamArea[];
  reference?: {
    text: string;
    link?: string;
  };
}

export const CALCULATORS: CalculatorDef[] = [
  // --- GERAL / MEDICINA INTERNA ---
  { 
    id: 'volume-elipsoide', 
    name: 'Cálculo de Volume', 
    description: 'Cálculo universal de volume para estruturas (C × L × A × 0.523).', 
    component: VolumeCalculator,
    areas: ['medicina-interna', 'ginecologia', 'pequenas-partes', 'medicina-fetal', 'vascular', 'musculoesqueletico', 'pediatria', 'procedimentos'],
    reference: {
      text: 'Fórmula do Elipsoide Prolado (Comprimento × Largura × Altura × 0.523). Modelo físico universal padrão-ouro na ultrassonografia clínica volumétrica.',
      link: 'https://pubmed.ncbi.nlm.nih.gov/'
    }
  },
  { 
    id: 'organ-refs', 
    name: 'Valores de Referência', 
    description: 'Guia rápido de dimensões normais para Fígado, Baço, Rins e Vesícula.', 
    component: OrganReferenceCalculator,
    areas: ['medicina-interna', 'pediatria'],
    reference: {
      text: 'Diretrizes e Tabelas Anatômicas de Dimensões Orgânicas Normais do Colégio Brasileiro de Radiologia e Diagnóstico por Imagem (CBR).',
      link: 'https://cbr.org.br/'
    }
  },
  { 
    id: 'pleural-effusion', 
    name: 'Derrame Pleural (Balik)', 
    description: 'Estimativa de volume de derrame pleural pela espessura da lâmina líquida.', 
    component: PleuralEffusionCalculator,
    areas: ['medicina-interna', 'procedimentos'],
    reference: {
      text: 'Fórmula de Balik: Volume Estimado (mL) = Espessura Máxima da Lâmina Líquida (mm) × 20. Validada clinicamente com pacientes em decúbito dorsal.',
      link: 'https://pubmed.ncbi.nlm.nih.gov/12951478/'
    }
  },
  { 
    id: 'ivc-index', 
    name: 'Índice da Veia Cava', 
    description: 'Cálculo de colapsabilidade da VCI para avaliação de status volêmico.', 
    component: IvcIndexCalculator,
    areas: ['medicina-interna', 'vascular'],
    reference: {
      text: 'Consenso da American Society of Echocardiography (ASE) para avaliação não invasiva da hemodinâmica e pressão atrial direita a partir do índice de colapsabilidade da Veia Cava Inferior.',
      link: 'https://www.asecho.org/'
    }
  },
  { 
    id: 'prostate-weight', 
    name: 'Peso Prostático', 
    description: 'Volume e peso estimado da próstata com classificação por grau de aumento.', 
    component: ProstateWeightCalculator,
    areas: ['medicina-interna'],
    reference: {
      text: 'Fórmula de Volume do Elipsoide Prostático (C × L × A × 0.523) com pareamento densimétrico de 1.05g/mL e classificação clínica de aumento de Weyman (1998).',
      link: 'https://pubmed.ncbi.nlm.nih.gov/'
    }
  },

  // --- PEQUENAS PARTES ---
  { 
    id: 'tirads-2017', 
    name: 'ACR TI-RADS (Tireoide)', 
    description: 'Calculadora oficial do ACR (2017) para nódulos tireoidianos.', 
    component: TiradsCalculator,
    areas: ['pequenas-partes'],
    reference: {
      text: 'Tessler FN, et al. ACR Thyroid Imaging, Reporting and Data System (TI-RADS): White Paper of the ACR TI-RADS Committee. J Am Coll Radiol 2017.',
      link: 'https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Thyroid-Imaging-Reporting-and-Data-System'
    }
  },
  { 
    id: 'birads-us-2013', 
    name: 'ACR BI-RADS (Mama)', 
    description: 'Léxico e classificação BI-RADS para ultrassonografia mamária.', 
    component: BiradsCalculator,
    areas: ['pequenas-partes', 'ginecologia', 'mastologia'],
    reference: {
      text: 'American College of Radiology (ACR) Breast Imaging Reporting and Data System (BI-RADS) US Atlas 2013. Léxico oficial de lesões mamárias.',
      link: 'https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Bi-Rads'
    }
  },

  // --- GINECOLOGIA ---
  { 
    id: 'orads-us-2022', 
    name: 'ACR O-RADS (Anexos)', 
    description: 'Classificação de risco para lesões anexiais baseada em US.', 
    component: OradsCalculator,
    areas: ['ginecologia'],
    reference: {
      text: 'Andreotti RF, et al. ACR Ovarian-Adnexal Reporting and Data System (O-RADS) Ultrasound Risk Stratification and Management Consensus Guidelines 2022.',
      link: 'https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/O-Rads'
    }
  },
  { 
    id: 'figo-myoma', 
    name: 'Classificação FIGO (Miomas)', 
    description: 'Sistema de classificação para leiomiomas uterinos (0 a 8).', 
    component: FigoCalculator,
    areas: ['ginecologia'],
    reference: {
      text: 'Munro MG, et al. FIGO classification system (PALM-COEIN) for causes of abnormal uterine bleeding in nongravid women of reproductive age. Int J Gynaecol Obstet 2011/2018.',
      link: 'https://www.figo.org/'
    }
  },

  // --- MEDICINA FETAL ---
  { 
    id: 'barcelona-fetal-growth', 
    name: 'Crescimento Fetal (OMS + Doppler)', 
    description: 'Calculadora completa passo-a-passo: biometria (OMS), peso e Doppler (Barcelona).', 
    component: BarcelonaFetalGrowthCalculator,
    areas: ['medicina-fetal'],
    reference: {
      text: 'Biometria pela OMS (Kiserud, 2017) e Doppler/Estadiamento pelo Consenso de Barcelona Fetal Medicine (Gratacós, 2014).',
      link: 'https://www.medicinafetalbarcelona.org/'
    }
  },
  { 
    id: 'gestational-age', 
    name: 'Idade Gestacional (DUM/USG)', 
    description: 'Calcula a IG atual e DPP baseada na DUM ou USG anterior.', 
    component: GestationalAgeCalculator,
    areas: ['medicina-fetal'],
    reference: {
      text: 'ACOG Committee Opinion No. 700: Methods for Estimating the Due Date. American College of Obstetricians and Gynecologists, Obstetrics & Gynecology 2017.',
      link: 'https://www.acog.org/'
    }
  },
  { 
    id: 'who-fetal-biometry', 
    name: 'Biometria Fetal (Peso/Percentil)', 
    description: 'Peso fetal estimado (Hadlock IV) com percentil da OMS (WHO Fetal Growth).', 
    component: WhoFetalBiometryCalculator,
    areas: ['medicina-fetal'],
    reference: {
      text: 'Kiserud T, et al. The World Health Organization Fetal Growth Charts: A Multinational Longitudinal Study of Ultrasound Biometric Measurements and Estimated Fetal Weight.',
      link: 'https://www.who.int/tools/fetal-growth-charts'
    }
  },
  { 
    id: 'doppler-fetal', 
    name: 'Doppler Fetal (Percentis)', 
    description: 'Cálculo de percentis para AU, ACM, UtA e Ducto Venoso.', 
    component: DopplerCalculator,
    areas: ['medicina-fetal'],
    reference: {
      text: 'Arduini D, Rizzo G. Normal values of pulsatility index from fetal vessels. J Perinat Med 1990; Baschat AA. Doppler fetal normograms. Am J Obstet Gynecol 2003.',
      link: 'https://pubmed.ncbi.nlm.nih.gov/'
    }
  },
  { 
    id: 'amniotic-fluid', 
    name: 'Líquido Amniótico (MBV/ILA)', 
    description: 'Avaliação do volume de LA por MBV (maior bolsão) ou ILA (4 quadrantes).', 
    component: AmnioticFluidCalculator,
    areas: ['medicina-fetal'],
    reference: {
      text: 'Phelan JP, et al. Amniotic fluid volume assessment using the four-quadrant technique (ILA). Chamberlain PF, et al. Single deepest pocket technique (MBV) assessment.',
      link: 'https://pubmed.ncbi.nlm.nih.gov/'
    }
  },
  { 
    id: 'crl-ccn', 
    name: 'Idade Gestacional (CCN)', 
    description: 'Calcula IG e DPP pelo CCN (Hadlock 1992).', 
    component: CrlCalculator,
    areas: ['medicina-fetal'],
    reference: {
      text: 'Hadlock FP, et al. Fetal crown-rump length: relation to gestational age. Radiology 1992. Curva normativa oficial de primeiro trimestre.',
      link: 'https://pubmed.ncbi.nlm.nih.gov/1549421/'
    }
  },
  { 
    id: 'msd-dmsg', 
    name: 'DMSG (Saco Gestacional)', 
    description: 'Calcula o diâmetro médio do saco gestacional e IG aproximada.', 
    component: MsdCalculator,
    areas: ['medicina-fetal'],
    reference: {
      text: 'Hadlock FP, et al. Estimation of gestational age from mean gestational sac diameter (MSD). Radiology 1984.',
      link: 'https://pubmed.ncbi.nlm.nih.gov/'
    }
  },
  {
    id: 'fmf-trisomy-risk',
    name: 'Risco de Cromossomopatia (EM VALIDAÇÃO)',
    description: 'Rastreamento combinado de 1º trimestre para T21/18/13 (idade, TN, bioquímica e marcadores). Coeficientes em validação.',
    component: TrisomyRiskCalculator,
    areas: ['medicina-fetal'],
    reference: {
      text: 'EM VALIDAÇÃO — apoio à decisão baseado em modelos publicados (Snijders/Nicolaides; Kagan et al., UOG 2008). NÃO é a calculadora oficial da Fetal Medicine Foundation; não usar para decisão clínica.',
      link: 'https://obgyn.onlinelibrary.wiley.com/doi/10.1002/uog.5331'
    }
  },
  {
    id: 'fmf-preeclampsia-risk',
    name: 'Risco de Pré-eclâmpsia (EM VALIDAÇÃO)',
    description: 'Rastreamento de 1º trimestre por fatores maternos + MAP, IP uterinas e PlGF (modelo de riscos competitivos). Biomarcadores em validação.',
    component: PreeclampsiaRiskCalculator,
    areas: ['medicina-fetal'],
    reference: {
      text: 'EM VALIDAÇÃO — fatores maternos por Wright D et al. (AJOG 2015); biomarcadores por Tan et al. (UOG 2018); conduta AAS por ASPRE (Rolnik et al., NEJM 2017). NÃO é a calculadora oficial da FMF; não usar para decisão clínica.',
      link: 'https://pubmed.ncbi.nlm.nih.gov/25724400/'
    }
  },

  // --- VASCULAR ---
  { 
    id: 'venous-cartography', 
    name: 'Cartografia Venosa (Membros Inf.)', 
    description: 'Mapeamento venoso de safenas, sistema profundo e perfurantes.', 
    component: VenousCartographyCalculator,
    areas: ['vascular'],
    reference: {
      text: 'Protocolo de Mapeamento Venoso para Varizes (Cartografia). Diretrizes de Ultrassonografia Vascular.',
    }
  },
  { 
    id: 'vascular-ratios', 
    name: 'Índices Hemodinâmicos', 
    description: 'Cálculo universal de IR (Resistência), IP (Pulsatilidade) e Relação S/D.', 
    component: VascularRatiosCalculator,
    areas: ['vascular', 'medicina-interna'],
    reference: {
      text: 'Pourcelot L. (Índice de Resistência, 1974), Wladimiroff JW. (Índice de Pulsatilidade, 1984) e Stuart B. (Relação Sistólica/Diastólica) para análises espectrais Doppler.',
      link: 'https://pubmed.ncbi.nlm.nih.gov/'
    }
  },
  { 
    id: 'imt-elsa-br', 
    name: 'IMT Carótidas (ELSA-Brasil)', 
    description: 'Espessura médio-intimal com referência ELSA-Brasil por idade e sexo.', 
    component: ImtCalculator,
    areas: ['vascular'],
    reference: {
      text: 'Santos IS, et al. Carotid Intima-Media Thickness and Reference Values: Estudo Longitudinal de Saúde do Adulto (ELSA-Brasil). Arq Bras Cardiol 2016.',
      link: 'https://www.scielo.br/j/abc/a/v8x6QRL9P6q7XbJcQz7KxQf/?lang=pt'
    }
  },
];
