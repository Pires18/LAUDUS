import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * INVARIANTES DAS RECOMENDAÇÕES DE MEDICINA FETAL (Camada 3 — deploy JSON).
 *
 * Trava dois requisitos de produto do aprimoramento de Jul/2026:
 *  1. Toda recomendação de próximo exame traz FAIXA DE DATA ("entre (…) e (…)").
 *  2. A ecocardiografia fetal DE ROTINA (complemento do rastreio) só é recomendada
 *     no MORFOLÓGICO DE SEGUNDO TRIMESTRE — nunca nas demais máscaras.
 */

interface MaskRecord {
  id: string;
  area: string;
  name: string;
  recommendationsTemplate?: string;
}

function loadFetal(file: string): MaskRecord[] {
  const raw = readFileSync(resolve(process.cwd(), file), 'utf8');
  const all = JSON.parse(raw) as MaskRecord[];
  return all.filter((t) => t.area === 'medicina-fetal');
}

const FILES = ['scripts/laudia-deploy-unified.json', 'scripts/laudia-deploy-unified.REFINED.json'];
// Frase EXATA da recomendação de rotina de eco (complemento do rastreio).
const ROUTINE_ECO = 'ecocardiografia fetal como complemento do rastreio';

describe.each(FILES)('recomendações fetais — %s', (file) => {
  const masks = loadFetal(file);

  it('há 9 máscaras de medicina fetal', () => {
    expect(masks.length).toBe(9);
  });

  it('toda recomendação traz faixa de data ("entre (…) e (…)")', () => {
    const semData = masks
      .filter((m) => !(m.recommendationsTemplate || '').includes('entre (…) e (…)'))
      .map((m) => m.name);
    expect(semData, `máscaras sem faixa de data: ${semData.join(', ')}`).toEqual([]);
  });

  it('eco de rotina só aparece no MORFOLÓGICO DE SEGUNDO TRIMESTRE', () => {
    const comEcoRotina = masks
      .filter((m) => (m.recommendationsTemplate || '').includes(ROUTINE_ECO))
      .map((m) => m.name);
    expect(comEcoRotina).toEqual(['MORFOLÓGICO DE SEGUNDO TRIMESTRE']);
  });

  it('a MORFOLÓGICA 1T não recomenda ecocardiografia de rotina', () => {
    const m1t = masks.find((m) => m.name === 'MORFOLÓGICA DO PRIMEIRO TRIMESTRE');
    expect(m1t).toBeTruthy();
    expect((m1t!.recommendationsTemplate || '').toLowerCase()).not.toContain('ecocardiografia fetal');
  });
});
