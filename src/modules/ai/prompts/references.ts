/**
 * FONTE ÚNICA DE REFERÊNCIAS — edições/versões CANÔNICAS das diretrizes de
 * classificação usadas em todo o sistema (doutrina, prompts de área, máscaras,
 * calculadoras, escores inline). Padroniza a citação e evita drift entre camadas.
 *
 * Regra: nenhuma camada deve inventar versão. Ao citar uma classificação, usar
 * a string `.cite` correspondente. Um teste (references.test.ts) garante que os
 * prompts de área/doutrina contêm estas strings e NÃO contêm versões inexistentes.
 */
export interface GuidelineRef {
  /** Sigla curta (ex.: 'TI-RADS'). */
  short: string;
  /** Citação canônica versionada (ex.: 'ACR TI-RADS (2017)'). */
  cite: string;
  /** Link oficial, quando houver. */
  link?: string;
}

export const CLASSIFICATION_REFS = {
  tirads: { short: 'TI-RADS', cite: 'ACR TI-RADS (2017)', link: 'https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Thyroid-Imaging-Reporting-and-Data-System' },
  birads: { short: 'BI-RADS', cite: 'ACR BI-RADS 5ª ed. (2013)', link: 'https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Bi-Rads' },
  orads: { short: 'O-RADS', cite: 'ACR O-RADS US (v2022)', link: 'https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/O-Rads' },
  bosniak: { short: 'Bosniak', cite: 'Bosniak (2019)', link: 'https://pubmed.ncbi.nlm.nih.gov/31063396/' },
  lirads: { short: 'LI-RADS', cite: 'ACR LI-RADS US (2017)', link: 'https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/LI-RADS' },
  carotid: { short: 'SRU', cite: 'Consenso SRU (2003) — critérios NASCET', link: 'https://pubmed.ncbi.nlm.nih.gov/14657561/' },
  ceap: { short: 'CEAP', cite: 'Classificação CEAP (2020)', link: 'https://pubmed.ncbi.nlm.nih.gov/32113854/' },
  imt: { short: 'EIM/ELSA', cite: 'ELSA-Brasil (Santos et al., 2016)' },
  fetalBiometry: { short: 'OMS/Kiserud', cite: 'OMS Fetal Growth Charts (Kiserud, 2017)', link: 'https://www.who.int/tools/fetal-growth-charts' },
  fetalEfw: { short: 'Hadlock', cite: 'Hadlock IV (1985)' },
  fetalDoppler: { short: 'ISUOG', cite: 'ISUOG Practice Guidelines (Doppler)' },
  fetalScreening: { short: 'FMF', cite: 'Fetal Medicine Foundation (FMF)' },
  omeract: { short: 'EULAR-OMERACT', cite: 'EULAR-OMERACT (sinovite/PDUS)', link: 'https://www.eular.org/' },
  asas: { short: 'ASAS', cite: 'ASAS (sacroileíte)' },
  graf: { short: 'Graf', cite: 'Método de Graf (quadril infantil)' },
  sfu: { short: 'SFU', cite: 'Society for Fetal Urology (hidronefrose)' },
  figo: { short: 'FIGO', cite: 'FIGO PALM-COEIN (miomas)' },
} as const;

export type ClassificationKey = keyof typeof CLASSIFICATION_REFS;

/** Versões inventadas/incorretas que NÃO devem aparecer em nenhuma camada. */
export const FORBIDDEN_REF_STRINGS = ['BI-RADS v2025', 'BI-RADS (ACR v2025)', 'LI-RADS v2024'];
