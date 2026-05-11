import { VolumeCalculator } from './components/VolumeCalculator';
import { TiradsCalculator } from './components/TiradsCalculator';
import { BiradsCalculator } from './components/BiradsCalculator';
import { OradsCalculator } from './components/OradsCalculator';
import { FigoCalculator } from './components/FigoCalculator';
import { GestationalAgeCalculator } from './components/GestationalAgeCalculator';
import { MsdCalculator } from './components/MsdCalculator';
import { CrlCalculator } from './components/CrlCalculator';
import { FetalBiometryCalculator } from './components/FetalBiometryCalculator';
import { DopplerCalculator } from './components/DopplerCalculator';
import { BarcelonaFetalGrowthCalculator } from './components/BarcelonaFetalGrowthCalculator';
import { ProstateWeightCalculator } from './components/ProstateWeightCalculator';
import { ImtCalculator } from './components/ImtCalculator';
import { AmnioticFluidCalculator } from './components/AmnioticFluidCalculator';

export interface CalculatorProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (val: any) => void;
}

export interface CalculatorDef {
  id: string;
  name: string;
  description: string;
  component: React.FC<CalculatorProps>;
}

export const CALCULATORS: CalculatorDef[] = [
  { id: 'volume-elipsoide', name: 'Cálculo de Volume (Elipsoide)', description: 'Calcula o volume baseado em 3 diâmetros (C × L × A × 0.523).', component: VolumeCalculator },
  { id: 'tirads-2017', name: 'ACR TI-RADS (Tireoide)', description: 'Calculadora oficial do ACR (2017) para nódulos tireoidianos.', component: TiradsCalculator },
  { id: 'birads-us-2013', name: 'ACR BI-RADS (Mama)', description: 'Léxico e classificação BI-RADS para ultrassonografia mamária.', component: BiradsCalculator },
  { id: 'orads-us-2022', name: 'ACR O-RADS (Anexos)', description: 'Classificação de risco para lesões anexiais baseada em US.', component: OradsCalculator },
  { id: 'figo-myoma', name: 'Classificação FIGO (Miomas)', description: 'Sistema de classificação para leiomiomas uterinos (0 a 8).', component: FigoCalculator },
  { id: 'gestational-age', name: 'Idade Gestacional (DUM/USG)', description: 'Calcula a IG atual e DDP baseada na DUM ou USG anterior.', component: GestationalAgeCalculator },
  { id: 'msd-dmsg', name: 'DMSG (Saco Gestacional)', description: 'Calcula o diâmetro médio do saco gestacional e IG aproximada.', component: MsdCalculator },
  { id: 'crl-ccn', name: 'Idade Gestacional (CCN)', description: 'Calcula IG e DDP pelo CCN (Hadlock 1992).', component: CrlCalculator },
  { id: 'fetal-biometry', name: 'Biometria Fetal (Peso/Percentil)', description: 'Peso fetal estimado (Hadlock IV) e percentil de crescimento.', component: FetalBiometryCalculator },
  { id: 'doppler-barcelona', name: 'Doppler Barcelona (Gratacós)', description: 'Doppler fetal e staging de restrição de crescimento (Barcelona).', component: DopplerCalculator },
  { id: 'barcelona-fetal-growth', name: 'Barcelona Fetal Growth & Doppler', description: 'Calculadora completa passo-a-passo: peso, Doppler e estadiamento RCF.', component: BarcelonaFetalGrowthCalculator },
  { id: 'prostate-weight', name: 'Peso Prostático', description: 'Volume e peso estimado da próstata com classificação por grau de aumento.', component: ProstateWeightCalculator },
  { id: 'imt-elsa-br', name: 'IMT Carótidas (ELSA-Brasil)', description: 'Espessura médio-intimal com referência ELSA-Brasil por idade e sexo.', component: ImtCalculator },
  { id: 'amniotic-fluid', name: 'Líquido Amniótico (MBV/ILA)', description: 'Avaliação do volume de LA por MBV (maior bolsão) ou ILA (4 quadrantes).', component: AmnioticFluidCalculator },
];
