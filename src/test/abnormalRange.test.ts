import { describe, it, expect } from 'vitest';
import {
  parseNormalRange, isValueAbnormal, fieldValueAbnormal, fieldDefAbnormal,
  sectionHasAbnormalValue, effectiveSectionState, isAutoAltered,
} from '../modules/editor/structured/abnormalRange';
import { StructuredFieldDef } from '../types';
import { StructuredSection } from '../types';
import { normalKey } from '../modules/editor/structured/structuredKeys';

describe('parseNormalRange — interpreta faixas dos cards', () => {
  it('operadores unilaterais', () => {
    expect(parseNormalRange('≤ 3,5 mm')).toMatchObject({ max: 3.5, maxIncl: true });
    expect(parseNormalRange('< 140 mmHg')).toMatchObject({ max: 140, maxIncl: false });
    expect(parseNormalRange('≥ 25 mm')).toMatchObject({ min: 25, minIncl: true });
    expect(parseNormalRange('> 0,65')).toMatchObject({ min: 0.65, minIncl: false });
  });
  it('faixas e ±', () => {
    expect(parseNormalRange('110–160 bpm')).toMatchObject({ min: 110, max: 160 });
    expect(parseNormalRange('2–10 mm')).toMatchObject({ min: 2, max: 10 });
    expect(parseNormalRange('45° ± 20°')).toMatchObject({ min: 25, max: 65 });
  });
  it('aproximado (≈) não é auto-classificado', () => {
    expect(parseNormalRange('≈ 1,0 MoM')).toBeNull();
    expect(parseNormalRange('≈ 0,3')).toBeNull();
  });
});

describe('isValueAbnormal', () => {
  it('TN ≤ 3,5', () => {
    expect(isValueAbnormal(2.0, '≤ 3,5 mm')).toBe(false);
    expect(isValueAbnormal(3.5, '≤ 3,5 mm')).toBe(false);
    expect(isValueAbnormal(3.8, '≤ 3,5 mm')).toBe(true);
  });
  it('colo ≥ 25', () => {
    expect(isValueAbnormal(30, '≥ 25 mm')).toBe(false);
    expect(isValueAbnormal(20, '≥ 25 mm')).toBe(true);
  });
  it('BCF 110–160', () => {
    expect(isValueAbnormal(140, '110–160 bpm')).toBe(false);
    expect(isValueAbnormal(105, '110–160 bpm')).toBe(true);
    expect(isValueAbnormal(170, '110–160 bpm')).toBe(true);
  });
  it('PA < 140 (limite exclusivo)', () => {
    expect(isValueAbnormal(139, '< 140 mmHg')).toBe(false);
    expect(isValueAbnormal(140, '< 140 mmHg')).toBe(true);
  });
  it('faixa aproximada → nunca alterado (só o médico decide)', () => {
    expect(isValueAbnormal(2.0, '≈ 1,0 MoM')).toBe(false);
  });
  it('pt-BR: vírgula decimal no valor', () => {
    expect(fieldValueAbnormal('3,8', '≤ 3,5 mm')).toBe(true);
    expect(fieldValueAbnormal('3,0', '≤ 3,5 mm')).toBe(false);
    expect(fieldValueAbnormal('', '≤ 3,5 mm')).toBe(false); // sem valor
  });
});

describe('alterado por SELECT clínico (normalOption)', () => {
  const on: StructuredFieldDef = { id: 'on', label: 'Osso nasal', kind: 'select', options: ['presente', 'ausente', 'hipoplásico'], normalOption: 'presente' };
  const dv: StructuredFieldDef = { id: 'dv', label: 'Ducto venoso', kind: 'select', options: ['positiva', 'ausente', 'reversa'], normalOption: 'positiva' };
  const tri: StructuredFieldDef = { id: 'tri', label: 'Tricúspide', kind: 'select', options: ['ausente', 'presente'], normalOption: 'ausente' };
  it('opção normal → não alterado; outra opção → alterado', () => {
    expect(fieldDefAbnormal(on, 'presente')).toBe(false);
    expect(fieldDefAbnormal(on, 'ausente')).toBe(true);
    expect(fieldDefAbnormal(on, 'hipoplásico')).toBe(true);
    expect(fieldDefAbnormal(dv, 'positiva')).toBe(false);
    expect(fieldDefAbnormal(dv, 'reversa')).toBe(true);
    expect(fieldDefAbnormal(tri, 'ausente')).toBe(false);
    expect(fieldDefAbnormal(tri, 'presente')).toBe(true);
  });
  it('vazio → não alterado', () => {
    expect(fieldDefAbnormal(on, '')).toBe(false);
    expect(fieldDefAbnormal(on, undefined)).toBe(false);
  });
  it('faixa numérica continua funcionando via fieldDefAbnormal', () => {
    const nt: StructuredFieldDef = { id: 'nt', label: 'TN', kind: 'measure', normal: '≤ 3,5 mm' };
    expect(fieldDefAbnormal(nt, '4,0')).toBe(true);
    expect(fieldDefAbnormal(nt, '2,0')).toBe(false);
  });
  it('seção vira alterada por osso nasal ausente', () => {
    const sec = { id: 'marc', label: 'Marcadores', normalable: true, fields: [on, dv, tri] };
    expect(sectionHasAbnormalValue(sec, { on: 'ausente' })).toBe(true);
    expect(effectiveSectionState(sec, { on: 'presente', dv: 'positiva', tri: 'ausente' })).toBe('normal');
    expect(effectiveSectionState(sec, { on: 'ausente' })).toBe('altered');
    expect(isAutoAltered(sec, { on: 'ausente' })).toBe(true);
  });
});

describe('estado efetivo da seção (auto-alterado)', () => {
  const section: StructuredSection = {
    id: 'marcadores', label: 'Marcadores', normalable: true, normalText: 'TN normal',
    fields: [{ id: 'nt', label: 'TN', kind: 'measure', unit: 'mm', normal: '≤ 3,5 mm' }],
  };

  it('valor normal → seção normal', () => {
    expect(effectiveSectionState(section, { nt: '2,0' })).toBe('normal');
    expect(isAutoAltered(section, { nt: '2,0' })).toBe(false);
  });
  it('valor fora da faixa → seção vira alterado sozinha', () => {
    expect(effectiveSectionState(section, { nt: '4,2' })).toBe('altered');
    expect(isAutoAltered(section, { nt: '4,2' })).toBe(true);
    expect(sectionHasAbnormalValue(section, { nt: '4,2' })).toBe(true);
  });
  it('médico marca Normal manualmente → override vence (fica normal mesmo com valor alto)', () => {
    const v = { nt: '4,2', [normalKey('marcadores')]: 'normal' };
    expect(effectiveSectionState(section, v)).toBe('normal');
    expect(isAutoAltered(section, v)).toBe(false); // não é auto (há escolha manual)
  });
  it('médico marca Alterado → alterado', () => {
    expect(effectiveSectionState(section, { [normalKey('marcadores')]: 'altered' })).toBe('altered');
  });
});
