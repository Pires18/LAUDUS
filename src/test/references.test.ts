import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { CLASSIFICATION_REFS, FORBIDDEN_REF_STRINGS } from '../modules/ai/prompts/references';

/** Camadas de prompt/código que citam referências de classificação. */
const FILES = [
  'src/modules/ai/prompts/areaPrompts.ts',
  'src/modules/ai/prompts/general.ts',
  'src/modules/ai/motorProfiles.ts',
  'src/modules/calculators/registry.tsx',
  'src/modules/editor/structured/scoring.ts',
].map((f) => ({ f, src: readFileSync(resolve(process.cwd(), f), 'utf8') }));

describe('referências — fonte única e versões canônicas', () => {
  it('nenhuma string de referência proibida em qualquer camada', () => {
    for (const { f, src } of FILES) {
      for (const bad of FORBIDDEN_REF_STRINGS) {
        expect(src.includes(bad), `${bad} encontrado em ${f}`).toBe(false);
      }
      // 'LI-RADS v2024' é inexistente (o canônico de US é 2017); 'BI-RADS v2025' É válido.
      expect(/LI-?RADS[^.]*v2024/i.test(src), `LI-RADS v2024 em ${f}`).toBe(false);
    }
  });

  it('CLASSIFICATION_REFS expõe as versões canônicas corretas', () => {
    // BI-RADS® v2025: manual ilustrado real do ACR (extensão da 5ª ed.).
    expect(CLASSIFICATION_REFS.birads.cite).toContain('v2025');
    expect(CLASSIFICATION_REFS.tirads.cite).toBe('ACR TI-RADS (2017)');
    expect(CLASSIFICATION_REFS.orads.cite).toBe('ACR O-RADS US (v2022)');
    expect(CLASSIFICATION_REFS.bosniak.cite).toBe('Bosniak (2019)');
    expect(CLASSIFICATION_REFS.lirads.cite).toContain('2017');
  });

  it('prompts de área citam as edições canônicas de BI-RADS/TI-RADS/O-RADS', () => {
    const area = FILES.find((x) => x.f.includes('areaPrompts'))!.src;
    expect(area).toMatch(/BI-RADS® v2025/);
    expect(area).toMatch(/TI-RADS \(?ACR ?2017\)?|ACR TI-RADS 2017/);
    expect(area).toMatch(/O-RADS/);
  });

  it('mastologia mantém "microlobulada" como margem de US (fusão é só mamográfica)', () => {
    const area = FILES.find((x) => x.f.includes('areaPrompts'))!.src;
    // O léxico de US deve preservar o descritor microlobulada.
    expect(/microlobulada/i.test(area)).toBe(true);
    // v2025 adicionou a forma "lobulada" ao US.
    expect(/lobulada/i.test(area)).toBe(true);
  });
});
