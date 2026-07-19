import { describe, it, expect } from 'vitest';
import {
  getAgendaDayStatus,
  generateSlotsForDay,
  findNextAvailableDate,
  DEFAULT_WEEKDAY_SHIFTS,
} from '../modules/appointments/utils/scheduleUtils';
import { computeBMI, classifyBMI } from '../modules/patients/utils/clinicalRecords';
import { Clinic } from '../types';

/**
 * Abertura/fechamento de agenda por datas exatas (janelas + bloqueios).
 * Invariantes: sem janelas = agenda sempre aberta (comportamento legado);
 * com janelas, só se agenda dentro delas; data bloqueada vence janela aberta;
 * dias fechados nunca geram slots nem são sugeridos como próxima data.
 */

function makeClinic(overrides?: Partial<NonNullable<Clinic['schedulingConfig']>>): Clinic {
  return {
    id: 'clinic-1',
    name: 'Clínica Teste',
    active: true,
    createdAt: 0,
    updatedAt: 0,
    schedulingConfig: {
      weekdayShifts: DEFAULT_WEEKDAY_SHIFTS,
      ...overrides,
    },
  };
}

// 2026-08-03 é uma segunda-feira (dia útil no DEFAULT_WEEKDAY_SHIFTS)
const MONDAY = '2026-08-03';
const SUNDAY = '2026-08-02';

describe('getAgendaDayStatus', () => {
  it('sem janelas cadastradas, dia útil fica aberto (comportamento legado)', () => {
    const status = getAgendaDayStatus(makeClinic(), MONDAY);
    expect(status.open).toBe(true);
    expect(status.reason).toBe('aberta');
  });

  it('domingo sem turnos ativos fica sem-expediente', () => {
    const status = getAgendaDayStatus(makeClinic(), SUNDAY);
    expect(status.open).toBe(false);
    expect(status.reason).toBe('sem-expediente');
  });

  it('com janela cadastrada, data dentro da janela abre e fora fecha', () => {
    const clinic = makeClinic({
      agendaWindows: [{ id: 'w1', start: '2026-08-01', end: '2026-08-31', label: 'Agosto/2026' }],
    });
    expect(getAgendaDayStatus(clinic, MONDAY).open).toBe(true);
    // 2026-09-01 é terça (dia útil), mas está fora da janela
    const fora = getAgendaDayStatus(clinic, '2026-09-01');
    expect(fora.open).toBe(false);
    expect(fora.reason).toBe('fora-da-janela');
  });

  it('limites da janela são inclusivos (abre exatamente no start e no end)', () => {
    const clinic = makeClinic({
      // 2026-08-04 (ter) a 2026-08-07 (sex)
      agendaWindows: [{ id: 'w1', start: '2026-08-04', end: '2026-08-07' }],
    });
    expect(getAgendaDayStatus(clinic, '2026-08-04').open).toBe(true);
    expect(getAgendaDayStatus(clinic, '2026-08-07').open).toBe(true);
    expect(getAgendaDayStatus(clinic, '2026-08-03').open).toBe(false);
    expect(getAgendaDayStatus(clinic, '2026-08-10').open).toBe(false);
  });

  it('múltiplas janelas: qualquer uma que contenha a data abre a agenda', () => {
    const clinic = makeClinic({
      agendaWindows: [
        { id: 'w1', start: '2026-08-01', end: '2026-08-15' },
        { id: 'w2', start: '2026-09-01', end: '2026-09-30' },
      ],
    });
    expect(getAgendaDayStatus(clinic, '2026-08-10').open).toBe(true);
    expect(getAgendaDayStatus(clinic, '2026-09-15').open).toBe(true);
    expect(getAgendaDayStatus(clinic, '2026-08-20').open).toBe(false);
  });

  it('data bloqueada fecha o dia mesmo dentro de janela aberta, com o motivo', () => {
    const clinic = makeClinic({
      agendaWindows: [{ id: 'w1', start: '2026-08-01', end: '2026-08-31' }],
      blockedDates: [{ date: MONDAY, reason: 'Feriado municipal' }],
    });
    const status = getAgendaDayStatus(clinic, MONDAY);
    expect(status.open).toBe(false);
    expect(status.reason).toBe('bloqueada');
    expect(status.label).toBe('Feriado municipal');
  });

  it('clínica nula cai no padrão legado (dia útil aberto)', () => {
    expect(getAgendaDayStatus(null, MONDAY).open).toBe(true);
    expect(getAgendaDayStatus(undefined, SUNDAY).open).toBe(false);
  });
});

describe('generateSlotsForDay com janelas/bloqueios', () => {
  it('dia fechado por janela não gera nenhum slot', () => {
    const clinic = makeClinic({
      agendaWindows: [{ id: 'w1', start: '2026-09-01', end: '2026-09-30' }],
    });
    expect(generateSlotsForDay(clinic, MONDAY, [])).toEqual([]);
  });

  it('data bloqueada não gera nenhum slot', () => {
    const clinic = makeClinic({
      blockedDates: [{ date: MONDAY, reason: 'Recesso' }],
    });
    expect(generateSlotsForDay(clinic, MONDAY, [])).toEqual([]);
  });

  it('dia aberto dentro da janela gera os slots dos turnos normalmente', () => {
    const clinic = makeClinic({
      agendaWindows: [{ id: 'w1', start: '2026-08-01', end: '2026-08-31' }],
    });
    const slots = generateSlotsForDay(clinic, MONDAY, []);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].time).toBe('08:00');
  });
});

describe('findNextAvailableDate com janelas/bloqueios', () => {
  it('pula datas bloqueadas e sugere o próximo dia aberto', () => {
    const clinic = makeClinic({
      blockedDates: [{ date: MONDAY, reason: 'Feriado' }],
    });
    // Partindo da segunda bloqueada, deve sugerir a terça (2026-08-04)
    expect(findNextAvailableDate(clinic, MONDAY, [])).toBe('2026-08-04');
  });

  it('partindo antes da janela, sugere o primeiro dia útil dentro dela', () => {
    const clinic = makeClinic({
      // Janela abre em 2026-08-10 (segunda)
      agendaWindows: [{ id: 'w1', start: '2026-08-10', end: '2026-08-31' }],
    });
    expect(findNextAvailableDate(clinic, MONDAY, [])).toBe('2026-08-10');
  });
});

describe('computeBMI / classifyBMI (prontuário — exame físico)', () => {
  it('calcula IMC com 1 casa decimal', () => {
    expect(computeBMI(70, 175)).toBe(22.9);
    expect(computeBMI(90, 180)).toBe(27.8);
  });

  it('retorna null para dados ausentes ou inválidos', () => {
    expect(computeBMI(undefined, 170)).toBeNull();
    expect(computeBMI(70, undefined)).toBeNull();
    expect(computeBMI(0, 170)).toBeNull();
    expect(computeBMI(70, 0)).toBeNull();
  });

  it('classificação OMS nos limiares', () => {
    expect(classifyBMI(18.4)).toBe('Baixo peso');
    expect(classifyBMI(18.5)).toBe('Eutrófico');
    expect(classifyBMI(24.9)).toBe('Eutrófico');
    expect(classifyBMI(25)).toBe('Sobrepeso');
    expect(classifyBMI(30)).toBe('Obesidade grau I');
    expect(classifyBMI(35)).toBe('Obesidade grau II');
    expect(classifyBMI(40)).toBe('Obesidade grau III');
  });
});
