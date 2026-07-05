/**
 * Catálogo único de preços/quotas de add-ons — fonte de verdade compartilhada
 * entre o checkout e o webhook. Os valores aqui são apenas fallbacks; quando
 * `global_config/addons_config` existe no Firestore, ele tem prioridade.
 */

/**
 * Deriva a lista de add-ons de um plano a partir das flags `includesX`.
 * Fonte única usada pelo webhook (concessão) e testável isoladamente.
 */
export function planToAddons(plan: {
  includesCalculators?: boolean;
  includesPacs?: boolean;
  includesAppointments?: boolean;
  includesClinics?: boolean;
} | null | undefined): string[] {
  const addons: string[] = [];
  if (!plan) return addons;
  if (plan.includesCalculators) addons.push('calculators');
  if (plan.includesPacs) addons.push('pacs');
  if (plan.includesAppointments) addons.push('appointments');
  if (plan.includesClinics) addons.push('clinics');
  return addons;
}

/** Mapeia a chave de add-on da API (snake_case) para a chave do Firestore (camelCase). */
export function mapAddonKey(addon: string): string {
  const mapping: Record<string, string> = {
    calculators: 'calculators',
    pacs: 'pacs',
    appointments: 'appointments',
    clinics: 'clinics',
    token_lite: 'tokenLite',
    token_pro: 'tokenPro',
    extra_reports: 'extraReport',
    extra_clinic: 'extraClinic',
  };
  return mapping[addon] || addon;
}

export const ADDON_NAMES: Record<string, string> = {
  calculators: 'Add-on Calculadoras Clínicas',
  pacs: 'Add-on PACS / DICOM Sync',
  appointments: 'Add-on Módulo de Agendamentos',
  clinics: 'Add-on Módulo de Clínicas',
  token_lite: 'Pacote Laudos Lite',
  token_pro: 'Pacote Laudos Pro',
  extra_reports: 'Laudos Extras',
  extra_clinic: 'Clínica Extra',
};

/** Fallbacks de preço (R$) e tamanho de pacote por add-on. */
export const ADDON_DEFAULTS: Record<string, { price: number; bundleSize: number }> = {
  calculators:   { price: 49,    bundleSize: 1  },
  pacs:          { price: 0,     bundleSize: 1  },
  appointments:  { price: 39,    bundleSize: 1  },
  clinics:       { price: 49,    bundleSize: 1  },
  token_lite:    { price: 9.90,  bundleSize: 50 },
  token_pro:     { price: 24.90, bundleSize: 20 },
  extra_reports: { price: 1.50,  bundleSize: 1  },
  extra_clinic:  { price: 29,    bundleSize: 1  },
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calcula o fim do período de cobrança respeitando o intervalo do plano. */
export function periodEndFrom(start: number, interval?: string): number {
  const days = interval === 'year' ? 365 : 30;
  return start + days * DAY_MS;
}

/**
 * Resolve preço (em centavos) e bundleSize de um add-on, priorizando o
 * metadata do Firestore e caindo para os defaults acima.
 */
export function resolveAddon(
  addon: string,
  firestoreMeta: any | null,
): { priceCents: number; priceBrl: number; bundleSize: number } {
  const def = ADDON_DEFAULTS[addon] || { price: 0, bundleSize: 1 };
  let priceBrl = def.price;
  let bundleSize = def.bundleSize;
  if (firestoreMeta) {
    if (typeof firestoreMeta.price === 'number') priceBrl = firestoreMeta.price;
    if (typeof firestoreMeta.bundleSize === 'number') bundleSize = firestoreMeta.bundleSize;
  }
  return { priceCents: Math.round(priceBrl * 100), priceBrl, bundleSize };
}
