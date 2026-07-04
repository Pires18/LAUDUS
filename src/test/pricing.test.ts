import { describe, it, expect } from 'vitest';
import { mapAddonKey, resolveAddon, periodEndFrom, ADDON_DEFAULTS } from '../../api/_pricing';

/** Catálogo de preços compartilhado entre checkout e webhook — dinheiro, então testado. */
describe('mapAddonKey', () => {
  it('mapeia chaves snake_case da API para camelCase do Firestore', () => {
    expect(mapAddonKey('token_lite')).toBe('tokenLite');
    expect(mapAddonKey('token_pro')).toBe('tokenPro');
    expect(mapAddonKey('extra_reports')).toBe('extraReport');
    expect(mapAddonKey('extra_clinic')).toBe('extraClinic');
  });

  it('mantém chaves já iguais e faz passthrough de desconhecidas', () => {
    expect(mapAddonKey('pacs')).toBe('pacs');
    expect(mapAddonKey('calculators')).toBe('calculators');
    expect(mapAddonKey('chave_inexistente')).toBe('chave_inexistente');
  });
});

describe('resolveAddon', () => {
  it('usa os defaults quando não há metadata do Firestore', () => {
    const r = resolveAddon('token_lite', null);
    expect(r.priceBrl).toBe(ADDON_DEFAULTS.token_lite.price); // 9.90
    expect(r.priceCents).toBe(990);
    expect(r.bundleSize).toBe(50);
  });

  it('converte preço para centavos com arredondamento correto', () => {
    expect(resolveAddon('extra_reports', null).priceCents).toBe(150); // 1.50 → 150
    expect(resolveAddon('token_pro', null).priceCents).toBe(2490);   // 24.90 → 2490
  });

  it('prioriza o metadata do Firestore sobre os defaults', () => {
    const r = resolveAddon('token_lite', { price: 12.5, bundleSize: 100 });
    expect(r.priceBrl).toBe(12.5);
    expect(r.priceCents).toBe(1250);
    expect(r.bundleSize).toBe(100);
  });

  it('ignora campos de metadata com tipo inválido', () => {
    const r = resolveAddon('token_lite', { price: 'grátis', bundleSize: null });
    expect(r.priceBrl).toBe(9.90); // cai no default
    expect(r.bundleSize).toBe(50);
  });

  it('add-on desconhecido → preço 0, bundle 1', () => {
    const r = resolveAddon('desconhecido', null);
    expect(r.priceCents).toBe(0);
    expect(r.bundleSize).toBe(1);
  });
});

describe('periodEndFrom', () => {
  const start = 1_700_000_000_000;
  const DAY = 24 * 60 * 60 * 1000;

  it('mensal (default/undefined) → +30 dias', () => {
    expect(periodEndFrom(start)).toBe(start + 30 * DAY);
    expect(periodEndFrom(start, 'month')).toBe(start + 30 * DAY);
  });

  it('anual → +365 dias', () => {
    expect(periodEndFrom(start, 'year')).toBe(start + 365 * DAY);
  });
});
