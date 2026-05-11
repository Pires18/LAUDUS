import { ExamArea } from '../types';

export const EXAM_CATALOG: Record<ExamArea, string[]> = {
  'medicina-interna': [
    'Abdome Superior',
    'Abdome Superior com Doppler',
    'Abdome Total',
    'Abdome Total com Doppler',
    'Próstata Via Abdominal',
    'Rins e Vias Urinárias',
    'Rins e Vias Urinárias com Doppler'
  ],
  'ginecologia': [
    'Pélvico Transvaginal',
    'Pélvico Transvaginal com Doppler',
    'Pélvico Abdominal',
    'Pélvico Abdominal com Doppler',
    'Pesquisa de Endometriose',
    'Mamas',
    'Mamas com Doppler',
    'Axilas'
  ],
  'medicina-fetal': [
    'Obstétrica de Primeiro Trimestre',
    'Obstétrica de Segundo / Terceiro Trimestre',
    'Obstétrica de Segundo / Terceiro Trimestre com Doppler',
    'Morfológica do Primeiro Trimestre',
    'Morfológico de Segundo Trimestre',
    'Ecocardiograma Fetal',
    'Neurossonografia Fetal',
    'Cervicometria'
  ],
  'pequenas-partes': [
    'Tireóide',
    'Tireóide com Doppler',
    'Cervical',
    'Cervical com Doppler',
    'Glândulas Salivares',
    'Parede Abdominal',
    'Regiões Inguinais',
    'Bolsa Escrotal',
    'Bolsa Escrotal com Doppler',
    'Partes Moles'
  ],
  'musculoesqueletico': [
    'Muscular',
    'Ombro',
    'Cotovelo',
    'Punho',
    'Mão',
    'Quadril',
    'Joelho',
    'Tornozelo',
    'Pé'
  ],
  'vascular': [
    'Doppler Venoso de Membro Inferior',
    'Doppler Arterial de Membro Inferior',
    'Doppler Venoso de Membro Superior',
    'Doppler Arterial de Membro Superior',
    'Doppler de Carótidas e Vertebrais',
    'Doppler de Artérias Oftálmicas'
  ],
  'reumatologico': [
    'Pesquisa de Artrite Reumatóide',
    'Pesquisa de Espondiloartrites',
    'Pesquisa de Arterites'
  ],
  'pediatria': [
    'Abdome Total',
    'Rins e Vias Urinárias',
    'Coluna Lombossacra',
    'Transfontanela'
  ],
  'procedimentos': [
    'PAAF (Tireóide, Mama, Linfonodos, Cistos, Coleções)',
    'Core Biopsy',
    'Amniocentese',
    'Biópsia de Vilo Corionico',
    'Acesso Vascular',
    'Infiltração',
    'Bloqueio'
  ]
};

// Array plano com todos os exames para casos que não filtram por área
export const ALL_EXAMS: string[] = Object.values(EXAM_CATALOG).flat();
