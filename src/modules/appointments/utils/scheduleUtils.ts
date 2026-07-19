import { Appointment, Clinic } from '../../../types';

export interface Shift {
  id: string;
  name: string;
  start: string;
  end: string;
  slotDurationMinutes: number;
}

export interface WeekdayShiftConfig {
  day: number;
  active: boolean;
  shifts: Shift[];
}

export const DEFAULT_WEEKDAY_SHIFTS: WeekdayShiftConfig[] = [
  { day: 0, active: false, shifts: [] }, // Sunday
  { 
    day: 1, 
    active: true, 
    shifts: [
      { id: '1-manha', name: 'Manhã', start: '08:00', end: '12:00', slotDurationMinutes: 20 },
      { id: '1-tarde', name: 'Tarde', start: '13:00', end: '18:00', slotDurationMinutes: 20 }
    ] 
  }, // Monday
  { 
    day: 2, 
    active: true, 
    shifts: [
      { id: '2-manha', name: 'Manhã', start: '08:00', end: '12:00', slotDurationMinutes: 20 },
      { id: '2-tarde', name: 'Tarde', start: '13:00', end: '18:00', slotDurationMinutes: 20 }
    ] 
  }, // Tuesday
  { 
    day: 3, 
    active: true, 
    shifts: [
      { id: '3-manha', name: 'Manhã', start: '08:00', end: '12:00', slotDurationMinutes: 20 },
      { id: '3-tarde', name: 'Tarde', start: '13:00', end: '18:00', slotDurationMinutes: 20 }
    ] 
  }, // Wednesday
  { 
    day: 4, 
    active: true, 
    shifts: [
      { id: '4-manha', name: 'Manhã', start: '08:00', end: '12:00', slotDurationMinutes: 20 },
      { id: '4-tarde', name: 'Tarde', start: '13:00', end: '18:00', slotDurationMinutes: 20 }
    ] 
  }, // Thursday
  { 
    day: 5, 
    active: true, 
    shifts: [
      { id: '5-manha', name: 'Manhã', start: '08:00', end: '12:00', slotDurationMinutes: 20 },
      { id: '5-tarde', name: 'Tarde', start: '13:00', end: '18:00', slotDurationMinutes: 20 }
    ] 
  }, // Friday
  { day: 6, active: false, shifts: [] }, // Saturday
];

export function getLocalDateStr(dateOrTimestamp: Date | number | string): string {
  if (typeof dateOrTimestamp === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOrTimestamp)) {
    return dateOrTimestamp;
  }
  const d = typeof dateOrTimestamp === 'string'
    ? new Date(dateOrTimestamp.includes('T') ? dateOrTimestamp : `${dateOrTimestamp}T00:00:00`)
    : new Date(dateOrTimestamp);
  
  if (isNaN(d.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Situação da agenda de uma clínica numa data exata. */
export interface AgendaDayStatus {
  open: boolean;
  /**
   * aberta        — dia disponível para agendamento
   * bloqueada     — data exata bloqueada (feriado/recesso)
   * fora-da-janela — existe(m) janela(s) de abertura e a data está fora delas
   * sem-expediente — dia da semana sem turnos ativos
   */
  reason: 'aberta' | 'bloqueada' | 'fora-da-janela' | 'sem-expediente';
  /** Detalhe exibível (motivo do bloqueio ou rótulo da janela mais próxima) */
  label?: string;
}

/**
 * Verifica se a agenda da clínica está aberta na data. Ordem de precedência:
 * data bloqueada > fora de janela de abertura > dia sem expediente.
 */
export function getAgendaDayStatus(clinic: Clinic | null | undefined, dateStr: string): AgendaDayStatus {
  const config = clinic?.schedulingConfig;

  const blocked = config?.blockedDates?.find(b => b.date === dateStr);
  if (blocked) {
    return { open: false, reason: 'bloqueada', label: blocked.reason || 'Data bloqueada' };
  }

  const windows = config?.agendaWindows || [];
  if (windows.length > 0) {
    const inWindow = windows.some(w => w.start && w.end && dateStr >= w.start && dateStr <= w.end);
    if (!inWindow) {
      return { open: false, reason: 'fora-da-janela', label: 'Agenda não aberta para esta data' };
    }
  }

  const dayOfWeek = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`).getDay();
  const shiftsConfig = config?.weekdayShifts || DEFAULT_WEEKDAY_SHIFTS;
  const daySetting = shiftsConfig.find(bh => bh.day === dayOfWeek);
  if (!daySetting || !daySetting.active || !daySetting.shifts || daySetting.shifts.length === 0) {
    return { open: false, reason: 'sem-expediente', label: 'Sem expediente neste dia da semana' };
  }

  return { open: true, reason: 'aberta' };
}

export function findNextAvailableDate(clinic: Clinic, startingFromStr: string, appointments: Appointment[]): string {
  const date = new Date(startingFromStr.includes('T') ? startingFromStr : `${startingFromStr}T00:00:00`);

  for (let i = 0; i < 60; i++) {
    const dateStr = getLocalDateStr(date);

    if (getAgendaDayStatus(clinic, dateStr).open) {
      const slots = generateSlotsForDay(clinic, dateStr, appointments);
      if (slots.some(s => !s.booked)) {
        return dateStr;
      }
    }
    date.setDate(date.getDate() + 1);
  }

  return startingFromStr;
}

export function countDayAppointments(appointments: Appointment[], dateStr: string, clinicId?: string) {
  let dayApps = appointments.filter(app => getLocalDateStr(app.scheduledAt) === dateStr);
  if (clinicId) {
    dayApps = dayApps.filter(app => app.clinicId === clinicId);
  }
  
  return {
    total: dayApps.filter(app => app.status !== 'cancelado').length,
    agendado: dayApps.filter(app => app.status === 'agendado').length,
    confirmado: dayApps.filter(app => app.status === 'confirmado').length,
    cancelado: dayApps.filter(app => app.status === 'cancelado').length,
  };
}

export function generateSlotsForDay(
  clinic: Clinic,
  dateStr: string,
  appointments: Appointment[]
): { time: string; booked: boolean; shiftName: string; bookedBy?: string; appointmentId?: string }[] {
  // Janela de abertura / data bloqueada / dia sem expediente ⇒ sem slots.
  if (!getAgendaDayStatus(clinic, dateStr).open) return [];

  const dayOfWeek = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`).getDay();
  const config = clinic.schedulingConfig;
  const shiftsConfig = config?.weekdayShifts || DEFAULT_WEEKDAY_SHIFTS;

  const daySetting = shiftsConfig.find(bh => bh.day === dayOfWeek);
  if (!daySetting || !daySetting.active || !daySetting.shifts || daySetting.shifts.length === 0) return [];

  // Mapear consultas agendadas por horário
  const bookedMap: Record<string, { patientName: string; id: string }> = {};
  appointments
    .filter(app => {
      if (app.clinicId !== clinic.id || app.status === 'cancelado') return false;
      return getLocalDateStr(app.scheduledAt) === dateStr;
    })
    .forEach(app => {
      const appDate = new Date(app.scheduledAt);
      const h = String(appDate.getHours()).padStart(2, '0');
      const m = String(appDate.getMinutes()).padStart(2, '0');
      bookedMap[`${h}:${m}`] = { patientName: app.patientName, id: app.id };
    });

  const slots: { time: string; booked: boolean; shiftName: string; bookedBy?: string; appointmentId?: string }[] = [];

  daySetting.shifts.forEach(shift => {
    const [startH, startM] = shift.start.split(':').map(Number);
    const [endH, endM] = shift.end.split(':').map(Number);

    let currentMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const duration = shift.slotDurationMinutes || 20;

    while (currentMinutes + duration <= endMinutes) {
      const h = String(Math.floor(currentMinutes / 60)).padStart(2, '0');
      const m = String(currentMinutes % 60).padStart(2, '0');
      const timeStr = `${h}:${m}`;
      const bookedData = bookedMap[timeStr];

      slots.push({
        time: timeStr,
        booked: !!bookedData,
        shiftName: shift.name,
        bookedBy: bookedData?.patientName,
        appointmentId: bookedData?.id,
      });

      currentMinutes += duration;
    }
  });

  return slots.sort((a, b) => a.time.localeCompare(b.time));
}

export function isSlotAvailable(
  clinicId: string,
  dateStr: string,
  timeStr: string,
  appointments: Appointment[],
  excludeAppointmentId?: string
): { available: boolean; bookedBy?: string } {
  const app = appointments.find(app => {
    if (app.clinicId !== clinicId || app.status === 'cancelado') return false;
    if (excludeAppointmentId && app.id === excludeAppointmentId) return false;
    if (getLocalDateStr(app.scheduledAt) !== dateStr) return false;
    const appDate = new Date(app.scheduledAt);
    const h = String(appDate.getHours()).padStart(2, '0');
    const m = String(appDate.getMinutes()).padStart(2, '0');
    return `${h}:${m}` === timeStr;
  });

  if (app) {
    return { available: false, bookedBy: app.patientName };
  }
  return { available: true };
}
