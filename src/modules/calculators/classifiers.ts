// ═══════════════════════════════════════════════════════════════
// CLASSIFICADORES CLÍNICOS PUROS — decisão testável (sem React)
// ═══════════════════════════════════════════════════════════════
// Extraído dos componentes para cobertura de testes. Reproduz EXATAMENTE a
// lógica de classificação clínica (ACR TI-RADS 2017, ACR BI-RADS 2013).

/** ACR TI-RADS: categoria e conduta a partir da pontuação total. */
export function tiradsCategory(total: number): { tr: string; rec: string } {
  if (total === 0) return { tr: 'TR1', rec: 'Benigno. PAAF não recomendada.' };
  if (total <= 2) return { tr: 'TR2', rec: 'Não suspeito. PAAF não recomendada.' };
  if (total === 3) return { tr: 'TR3', rec: 'Levemente suspeito. PAAF se ≥ 2,5 cm. Seguimento se ≥ 1,5 cm.' };
  if (total <= 6) return { tr: 'TR4', rec: 'Moderadamente suspeito. PAAF se ≥ 1,5 cm. Seguimento se ≥ 1,0 cm.' };
  return { tr: 'TR5', rec: 'Altamente suspeito. PAAF se ≥ 1,0 cm. Seguimento se ≥ 0,5 cm.' };
}

export interface BiradsInput {
  shape: string | null;
  orientation: string | null;
  margin: string | null;
  echoPattern: string | null;
  posteriorFeatures?: string | null;
  calcifications?: string | null;
}

/** ACR BI-RADS (mama): categoria e conduta por contagem de features suspeitas. */
export function classifyBirads(l: BiradsInput): { cat: string; rec: string } {
  if (!l.shape || !l.margin || !l.orientation || !l.echoPattern) {
    return { cat: '0', rec: 'Avaliação Incompleta — preencha todos os campos.' };
  }

  // Cisto simples = BI-RADS 2 (benigno definitivo)
  if (
    l.echoPattern === 'Anecóico' &&
    l.margin === 'Circunscrita' &&
    (l.shape === 'Oval' || l.shape === 'Redondo') &&
    l.orientation === 'Paralelo'
  ) {
    return { cat: '2', rec: 'Benigno. Cisto simples clássico. Nenhum acompanhamento necessário.' };
  }

  // Contagem de features suspeitas per ACR BI-RADS 2013
  let suspiciousCount = 0;
  const suspiciousFeatures: string[] = [];

  if (l.shape === 'Irregular') {
    suspiciousCount++;
    suspiciousFeatures.push('forma irregular');
  }
  if (l.orientation === 'Não-paralelo') {
    suspiciousCount++;
    suspiciousFeatures.push('orientação não-paralela');
  }
  if (l.margin && ['Indistinta', 'Angular', 'Microlobulada', 'Espiculada'].includes(l.margin)) {
    suspiciousCount++;
    suspiciousFeatures.push(`margem ${l.margin.toLowerCase()}`);
  }
  if (l.echoPattern === 'Hipoecóico') {
    suspiciousCount++;
    suspiciousFeatures.push('padrão hipoecóico');
  }
  if (l.posteriorFeatures === 'Sombra Acústica') {
    suspiciousCount++;
    suspiciousFeatures.push('sombra acústica posterior');
  }
  if (l.calcifications === 'Microcalcificações') {
    suspiciousCount++;
    suspiciousFeatures.push('microcalcificações');
  }

  const isClassicMalignant =
    l.shape === 'Irregular' &&
    l.margin === 'Espiculada' &&
    l.orientation === 'Não-paralelo';

  if (isClassicMalignant || suspiciousCount >= 4) {
    return {
      cat: '5',
      rec: `Altamente suspeito (> 95% risco). Biópsia obrigatória independente do tamanho. Features: ${suspiciousFeatures.join(', ')}.`,
    };
  }
  if (suspiciousCount === 3) {
    return {
      cat: '4C',
      rec: `Suspeita alta (50-95% risco). Biópsia obrigatória. Features: ${suspiciousFeatures.join(', ')}.`,
    };
  }
  if (suspiciousCount === 2) {
    return {
      cat: '4B',
      rec: `Suspeita moderada (10-50% risco). Biópsia recomendada. Features: ${suspiciousFeatures.join(', ')}.`,
    };
  }
  if (suspiciousCount === 1) {
    return {
      cat: '4A',
      rec: `Suspeita baixa (2-10% risco). Biópsia recomendada. Feature: ${suspiciousFeatures.join(', ')}.`,
    };
  }
  if (
    (l.shape === 'Oval' || l.shape === 'Redondo') &&
    l.orientation === 'Paralelo' &&
    l.margin === 'Circunscrita'
  ) {
    return {
      cat: '3',
      rec: 'Provavelmente benigno (< 2% risco). Provável fibroadenoma. Controle por imagem em 6, 12 e 24 meses.',
    };
  }

  return {
    cat: '3',
    rec: 'Provavelmente benigno (< 2% risco). Controle por imagem em 6-12 meses.',
  };
}

export interface OradsInput {
  type: string | null;
  colorScore: number;
  innerWall: string | null;
  ascites: boolean;
  /** Maior dimensão da lesão em mm. */
  maxDim: number;
}

/** ACR O-RADS US (massa anexial): categoria de risco e conduta. */
export function classifyOrads(l: OradsInput): { cat: string; rec: string } {
  if (l.ascites) {
    return { cat: '5', rec: 'Alto risco (≥50%). Presença de ascite ou nódulos peritoneais.' };
  }
  if (l.type === 'Lesão Sólida') {
    if (l.colorScore === 4 || l.innerWall === 'Irregular') {
      return { cat: '5', rec: 'Alto risco (≥50%). Lesão sólida suspeita.' };
    }
    return { cat: '4', rec: 'Risco intermediário (10-50%).' };
  }
  if (l.type === 'Cisto com Componente Sólido') {
    return { cat: '4', rec: 'Risco intermediário (10-50%).' };
  }
  if (l.type === 'Cisto Multilocular') {
    if (l.maxDim >= 100 || l.colorScore === 4) {
      return { cat: '4', rec: 'Risco intermediário (10-50%). Cisto multilocular grande ou vascularizado.' };
    }
    return { cat: '3', rec: 'Baixo risco (1-10%).' };
  }
  if (l.type === 'Cisto Unilocular Simples') {
    if (l.maxDim >= 100) {
      return { cat: '3', rec: 'Baixo risco (1-10%). Cisto unilocular ≥ 10cm.' };
    }
    return { cat: '2', rec: 'Quase certamente benigno (<1%). Cisto unilocular < 10cm.' };
  }
  return { cat: '0', rec: 'Avaliação Incompleta' };
}
