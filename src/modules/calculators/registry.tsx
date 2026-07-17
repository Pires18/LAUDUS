import { VolumeCalculator } from './components/VolumeCalculator';
import { TiradsCalculator } from './components/TiradsCalculator';
import { BiradsCalculator } from './components/BiradsCalculator';
import { OradsCalculator } from './components/OradsCalculator';
import { FigoCalculator } from './components/FigoCalculator';
import { GestationalAgeCalculator } from './components/GestationalAgeCalculator';
import { MsdCalculator } from './components/MsdCalculator';
import { WhoFetalBiometryCalculator } from './components/WhoFetalBiometryCalculator';
import { DopplerCalculator } from './components/DopplerCalculator';
import { BarcelonaFetalGrowthCalculator } from './components/BarcelonaFetalGrowthCalculator';
import { GrowthVelocityCalculator } from './components/GrowthVelocityCalculator';
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
    // universal: qualquer área que meça uma estrutura em 3 eixos
    areas: ['medicina-interna', 'ginecologia', 'pequenas-partes', 'medicina-fetal', 'vascular', 'musculoesqueletico', 'pediatria', 'procedimentos', 'mastologia', 'reumatologico'],
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
    // procedimentos: a PAAF TIREOIDE herda os descritores e a categoria do alvo
    areas: ['pequenas-partes', 'procedimentos'],
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
    // procedimentos: a PAAF MAMA herda o léxico e a categoria da lesão-alvo
    areas: ['pequenas-partes', 'ginecologia', 'mastologia', 'procedimentos'],
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
    name: 'Crescimento Fetal (Biometria + Doppler)',
    description: 'Calculadora completa passo-a-passo: biometria e peso por curva selecionável (Hadlock, INTERGROWTH-21st ou OMS) e Doppler/estadiamento de Barcelona.',
    component: BarcelonaFetalGrowthCalculator,
    areas: ['medicina-fetal'],
    reference: {
      text: 'Biometria/peso por Hadlock (Radiology 1984;152:497 e 1991;181:129), INTERGROWTH-21st (Papageorghiou, Lancet 2014; Stirnemann, UOG 2017) ou OMS (Kiserud, 2017) — a curva usada é exibida junto do percentil. Doppler/estadiamento pelo Consenso de Barcelona Fetal Medicine (Gratacós, 2014).',
      link: 'https://www.medicinafetalbarcelona.org/'
    }
  },
  {
    id: 'growth-velocity',
    name: 'Velocidade de Crescimento Fetal',
    description: 'Compara dois exames: Δz-score de EPF por semana e projeção no mesmo percentil (desaceleração < −0,13/semana).',
    component: GrowthVelocityCalculator,
    areas: ['medicina-fetal'],
    reference: {
      text: 'Hugh O, Gardosi J. Fetal weight projection model to define growth velocity and validation against pregnancy outcome. Ultrasound Obstet Gynecol 2022. Z-score de EPF pela curva OMS/Kiserud (2017); limiar de desaceleração −0,13 z/semana.',
      link: 'https://perinatal.org.uk/growthvelocity'
    }
  },
  {
    id: 'gestational-age',
    name: 'Idade Gestacional (DUM / USG / Biometria)',
    description: 'IG de referência e DPP por DUM, USG anterior ou biometria — CCN (1ºT), DBP (2ºT) ou CC (3ºT) — com comparação entre os métodos.', 
    component: GestationalAgeCalculator,
    // procedimentos: a IG no dia do procedimento define a janela da BVC/amnio
    areas: ['medicina-fetal', 'procedimentos'],
    reference: {
      text: 'ACOG Committee Opinion No. 700: Methods for Estimating the Due Date. American College of Obstetricians and Gynecologists, Obstetrics & Gynecology 2017.',
      link: 'https://www.acog.org/'
    }
  },
  { 
    id: 'who-fetal-biometry',
    name: 'Biometria Fetal (Peso/Percentil)',
    description: 'Peso fetal estimado (Hadlock IV ou INTERGROWTH) e percentis da biometria por curva selecionável: Hadlock (padrão), INTERGROWTH-21st ou OMS.',
    component: WhoFetalBiometryCalculator,
    areas: ['medicina-fetal'],
    reference: {
      text: 'Hadlock FP, et al. Radiology 1984;152:497 (biometria) e 1991;181:129 (peso). Papageorghiou AT, et al. Lancet 2014;384:869 e Stirnemann J, et al. UOG 2017;49:478 (INTERGROWTH-21st). Kiserud T, et al. WHO Fetal Growth Charts (2017). A curva usada é exibida junto de cada percentil.',
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
    // procedimentos: BVC e amniocentese avaliam o LA antes de puncionar
    areas: ['medicina-fetal', 'procedimentos'],
    reference: {
      text: 'Phelan JP, et al. Amniotic fluid volume assessment using the four-quadrant technique (ILA). Chamberlain PF, et al. Single deepest pocket technique (MBV) assessment.',
      link: 'https://pubmed.ncbi.nlm.nih.gov/'
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
    description: 'Rastreamento combinado de 1º trimestre para T21/18/13 (idade, TN, bioquímica e marcadores). Implementação auditada; validação de saída pendente.',
    component: TrisomyRiskCalculator,
    areas: ['medicina-fetal'],
    reference: {
      text: 'Implementação AUDITADA e fiel aos modelos publicados (Snijders/Nicolaides 1999; Wright 2008; Kagan et al., UOG 2008), com testes de referência ponta-a-ponta. Validação de saída contra a calculadora OFICIAL da FMF ainda pendente — apoio à decisão; não substitui a calculadora oficial nem o julgamento clínico.',
      link: 'https://obgyn.onlinelibrary.wiley.com/doi/10.1002/uog.5331'
    }
  },
  {
    id: 'fmf-preeclampsia-risk',
    name: 'Risco de Pré-eclâmpsia (EM VALIDAÇÃO)',
    description: 'Rastreamento de 1º trimestre por fatores maternos + MAP, IP uterinas e PlGF (modelo de riscos competitivos). Implementação auditada; validação de saída pendente.',
    component: PreeclampsiaRiskCalculator,
    areas: ['medicina-fetal'],
    reference: {
      text: 'Implementação AUDITADA e fiel aos modelos publicados (fatores maternos Wright D et al., AJOG 2015; riscos competitivos O\'Gorman 2016; medianas Tan et al., UOG 2018; PSV oftálmico Gana 2022; conduta AAS por ASPRE, Rolnik et al., NEJM 2017), com testes de referência ponta-a-ponta. Validação de saída contra a calculadora OFICIAL da FMF ainda pendente — apoio à decisão; não substitui a calculadora oficial nem o julgamento clínico.',
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
    // pediatria: IR da cerebral anterior (transfontanelar) e IR renal
    areas: ['vascular', 'medicina-interna', 'pediatria'],
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
