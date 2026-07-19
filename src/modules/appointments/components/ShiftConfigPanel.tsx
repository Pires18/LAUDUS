import { useState, useEffect } from 'react';
import { Clinic } from '../../../types';
import { Sliders, Plus, Trash2, Loader2, CalendarRange, CalendarOff, LockOpen } from 'lucide-react';
import { Shift, WeekdayShiftConfig, DEFAULT_WEEKDAY_SHIFTS } from '../utils/scheduleUtils';

export type SchedulingConfig = NonNullable<Clinic['schedulingConfig']>;
type AgendaWindow = NonNullable<SchedulingConfig['agendaWindows']>[number];
type BlockedDate = NonNullable<SchedulingConfig['blockedDates']>[number];

interface ShiftConfigPanelProps {
  clinics: Clinic[];
  configClinicId: string;
  onClinicChange: (id: string) => void;
  onSave: (clinicId: string, config: SchedulingConfig) => Promise<void>;
  onCancel: () => void;
}

const MONTH_LABELS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function formatBrDate(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function ShiftConfigPanel({
  clinics,
  configClinicId,
  onClinicChange,
  onSave,
  onCancel,
}: ShiftConfigPanelProps) {
  const [loading, setLoading] = useState(false);
  const [weekdayShifts, setWeekdayShifts] = useState<WeekdayShiftConfig[]>(DEFAULT_WEEKDAY_SHIFTS);
  const [agendaWindows, setAgendaWindows] = useState<AgendaWindow[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [monthToOpen, setMonthToOpen] = useState('');
  const [newBlockDate, setNewBlockDate] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');

  useEffect(() => {
    const clinic = clinics.find(c => c.id === configClinicId);
    if (clinic) {
      setWeekdayShifts(clinic.schedulingConfig?.weekdayShifts || DEFAULT_WEEKDAY_SHIFTS);
      setAgendaWindows(clinic.schedulingConfig?.agendaWindows || []);
      setBlockedDates(clinic.schedulingConfig?.blockedDates || []);
    }
  }, [configClinicId, clinics]);

  const handleOpenMonth = () => {
    if (!/^\d{4}-\d{2}$/.test(monthToOpen)) return;
    const [year, month] = monthToOpen.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const start = `${monthToOpen}-01`;
    const end = `${monthToOpen}-${String(lastDay).padStart(2, '0')}`;
    if (agendaWindows.some(w => w.start === start && w.end === end)) return;
    setAgendaWindows(prev => [...prev, {
      id: Math.random().toString(36).substring(2, 9),
      start,
      end,
      label: `${MONTH_LABELS[month - 1]}/${year}`,
    }].sort((a, b) => a.start.localeCompare(b.start)));
    setMonthToOpen('');
  };

  const handleAddCustomWindow = () => {
    setAgendaWindows(prev => [...prev, {
      id: Math.random().toString(36).substring(2, 9),
      start: '',
      end: '',
      label: '',
    }]);
  };

  const handleWindowChange = (id: string, field: 'start' | 'end' | 'label', value: string) => {
    setAgendaWindows(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w));
  };

  const handleRemoveWindow = (id: string) => {
    setAgendaWindows(prev => prev.filter(w => w.id !== id));
  };

  const handleAddBlockedDate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newBlockDate)) return;
    if (blockedDates.some(b => b.date === newBlockDate)) return;
    setBlockedDates(prev => [...prev, { date: newBlockDate, reason: newBlockReason.trim() || undefined }]
      .sort((a, b) => a.date.localeCompare(b.date)));
    setNewBlockDate('');
    setNewBlockReason('');
  };

  const handleRemoveBlockedDate = (date: string) => {
    setBlockedDates(prev => prev.filter(b => b.date !== date));
  };

  const handleWeekdayConfigActiveChange = (day: number, active: boolean) => {
    setWeekdayShifts(prev =>
      prev.map(bh => {
        if (bh.day === day) {
          return {
            ...bh,
            active,
            shifts: active && bh.shifts.length === 0
              ? [{ id: Math.random().toString(36).substring(2, 9), name: 'Manhã', start: '08:00', end: '12:00', slotDurationMinutes: 20 }]
              : bh.shifts
          };
        }
        return bh;
      })
    );
  };

  const handleAddShift = (day: number) => {
    setWeekdayShifts(prev =>
      prev.map(bh => {
        if (bh.day === day) {
          const newShift: Shift = {
            id: Math.random().toString(36).substring(2, 9),
            name: bh.shifts.length === 0 ? 'Manhã' : bh.shifts.length === 1 ? 'Tarde' : 'Noite',
            start: bh.shifts.length === 0 ? '08:00' : bh.shifts.length === 1 ? '13:00' : '18:00',
            end: bh.shifts.length === 0 ? '12:00' : bh.shifts.length === 1 ? '18:00' : '22:00',
            slotDurationMinutes: 20
          };
          return { ...bh, shifts: [...bh.shifts, newShift] };
        }
        return bh;
      })
    );
  };

  const handleRemoveShift = (day: number, shiftId: string) => {
    setWeekdayShifts(prev =>
      prev.map(bh => bh.day === day ? { ...bh, shifts: bh.shifts.filter(s => s.id !== shiftId) } : bh)
    );
  };

  const handleShiftValueChange = (day: number, shiftId: string, field: keyof Shift, value: any) => {
    setWeekdayShifts(prev =>
      prev.map(bh => bh.day === day ? {
        ...bh,
        shifts: bh.shifts.map(s => s.id === shiftId ? { ...s, [field]: value } : s)
      } : bh)
    );
  };

  const handleSave = async () => {
    // Descarta janelas incompletas (sem data inicial/final) antes de salvar.
    const validWindows = agendaWindows
      .filter(w => /^\d{4}-\d{2}-\d{2}$/.test(w.start) && /^\d{4}-\d{2}-\d{2}$/.test(w.end) && w.start <= w.end)
      .map(w => ({ ...w, label: w.label?.trim() || undefined }));
    setLoading(true);
    try {
      await onSave(configClinicId, {
        weekdayShifts,
        agendaWindows: validWindows,
        blockedDates,
      });
    } finally {
      setLoading(false);
    }
  };

  const weekdaysLabels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  return (
    <div className="bg-white border border-ink-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 border-b border-ink-100 pb-4">
        <Sliders className="text-ink-800" size={22} />
        <div>
          <h3 className="font-black text-ink-900 text-lg leading-tight">Configurações de Agenda & Turnos</h3>
          <p className="text-xs text-ink-500">Defina múltiplos turnos de trabalho (Manhã, Tarde, Noite...) por dia e parametrize a duração do exame de cada um.</p>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black text-ink-500 uppercase tracking-widest block mb-2">Unidade / Clínica</label>
        <select
          value={configClinicId}
          onChange={(e) => onClinicChange(e.target.value)}
          className="w-full max-w-sm h-12 px-3 bg-ink-50 border border-ink-200 rounded-xl font-bold text-xs text-ink-900 focus:border-ink-400 outline-none cursor-pointer"
        >
          {clinics.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        <h4 className="text-[10px] font-black text-ink-500 uppercase tracking-widest ml-1 mb-2">Turnos por Dia da Semana</h4>
        
        <div className="space-y-6">
          {weekdayShifts.map((bh) => (
            <div key={bh.day} className="p-5 rounded-2xl bg-ink-50 border border-ink-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-ink-200">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`active-day-${bh.day}`}
                    checked={bh.active}
                    onChange={(e) => handleWeekdayConfigActiveChange(bh.day, e.target.checked)}
                    className="w-4 h-4 rounded text-ink-900 focus:ring-ink-900/20 cursor-pointer"
                  />
                  <label htmlFor={`active-day-${bh.day}`} className="font-black text-ink-900 text-sm cursor-pointer select-none">
                    {weekdaysLabels[bh.day]}
                  </label>
                </div>
                
                {bh.active && (
                  <button
                    type="button"
                    onClick={() => handleAddShift(bh.day)}
                    className="px-3 py-1.5 rounded-lg bg-ink-900 hover:bg-ink-800 text-white font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all"
                  >
                    <Plus size={12} />
                    Adicionar Turno
                  </button>
                )}
              </div>

              {bh.active ? (
                bh.shifts.length === 0 ? (
                  <p className="text-xs text-ink-400 italic">Nenhum turno configurado. Adicione um turno para este dia.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bh.shifts.map((shift) => (
                      <div key={shift.id} className="p-4 rounded-xl bg-white border border-ink-200/60 shadow-sm space-y-3 relative group">
                        <button
                          type="button"
                          onClick={() => handleRemoveShift(bh.day, shift.id)}
                          className="absolute top-3 right-3 p-1.5 text-ink-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
                          title="Excluir Turno"
                        >
                          <Trash2 size={14} />
                        </button>

                        <div>
                          <label className="text-[9px] font-black text-ink-400 uppercase tracking-widest block mb-1">Nome do Turno</label>
                          <input
                            type="text"
                            value={shift.name}
                            onChange={(e) => handleShiftValueChange(bh.day, shift.id, 'name', e.target.value)}
                            className="w-full h-9 px-2 bg-ink-50 border border-ink-200 rounded-lg text-xs font-bold text-ink-900 focus:border-ink-400 outline-none"
                            placeholder="Ex: Manhã, Tarde, Noturno"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[9px] font-black text-ink-400 uppercase tracking-widest block mb-1">Início</label>
                            <input
                              type="time"
                              value={shift.start}
                              onChange={(e) => handleShiftValueChange(bh.day, shift.id, 'start', e.target.value)}
                              className="w-full h-9 px-2 bg-ink-50 border border-ink-200 rounded-lg text-xs font-bold text-ink-900 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-ink-400 uppercase tracking-widest block mb-1">Fim</label>
                            <input
                              type="time"
                              value={shift.end}
                              onChange={(e) => handleShiftValueChange(bh.day, shift.id, 'end', e.target.value)}
                              className="w-full h-9 px-2 bg-ink-50 border border-ink-200 rounded-lg text-xs font-bold text-ink-900 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-ink-400 uppercase tracking-widest block mb-1">Tempo de Exame</label>
                            <select
                              value={shift.slotDurationMinutes || 20}
                              onChange={(e) => handleShiftValueChange(bh.day, shift.id, 'slotDurationMinutes', Number(e.target.value))}
                              className="w-full h-9 px-1 bg-ink-50 border border-ink-200 rounded-lg text-xs font-bold text-ink-900 outline-none cursor-pointer"
                            >
                              <option value={10}>10 min</option>
                              <option value={15}>15 min</option>
                              <option value={20}>20 min</option>
                              <option value={30}>30 min</option>
                              <option value={40}>40 min</option>
                              <option value={45}>45 min</option>
                              <option value={60}>60 min</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <span className="text-[9px] font-black uppercase text-rose-500 tracking-wider">Fechado / Sem expediente</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ─── ABERTURA DE AGENDA (JANELAS POR DATAS EXATAS) ─── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 ml-1">
          <CalendarRange size={15} className="text-emerald-600" />
          <h4 className="text-[10px] font-black text-ink-500 uppercase tracking-widest">Abertura de Agenda</h4>
        </div>
        <p className="text-xs text-ink-500 ml-1 -mt-2">
          Abra a agenda apenas em períodos exatos (ex.: o mês inteiro ou de 05/08 a 20/08).
          {' '}<strong>Sem nenhuma janela cadastrada, a agenda fica sempre aberta.</strong>{' '}
          Com janelas, só é possível agendar dentro delas.
        </p>

        <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-4">
          {/* Atalho: abrir mês inteiro */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-1">
              <label className="text-[9px] font-black text-ink-400 uppercase tracking-widest block mb-1">Abrir mês inteiro</label>
              <input
                type="month"
                value={monthToOpen}
                onChange={(e) => setMonthToOpen(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-ink-200 rounded-xl text-xs font-bold text-ink-900 focus:border-emerald-400 outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleOpenMonth}
              disabled={!monthToOpen}
              className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <LockOpen size={12} />
              Abrir Mês
            </button>
            <button
              type="button"
              onClick={handleAddCustomWindow}
              className="h-10 px-4 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <Plus size={12} />
              Período Personalizado
            </button>
          </div>

          {agendaWindows.length === 0 ? (
            <p className="text-xs text-ink-500 italic">Nenhuma janela cadastrada — agenda sempre aberta.</p>
          ) : (
            <div className="space-y-2">
              {agendaWindows.map(w => (
                <div key={w.id} className="p-3 rounded-xl bg-white border border-emerald-200/70 shadow-sm flex flex-col sm:flex-row sm:items-end gap-3">
                  <div className="flex-1">
                    <label className="text-[9px] font-black text-ink-400 uppercase tracking-widest block mb-1">Rótulo</label>
                    <input
                      type="text"
                      value={w.label || ''}
                      onChange={(e) => handleWindowChange(w.id, 'label', e.target.value)}
                      placeholder="Ex: Agosto/2026"
                      className="w-full h-9 px-2 bg-ink-50 border border-ink-200 rounded-lg text-xs font-bold text-ink-900 focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-ink-400 uppercase tracking-widest block mb-1">Abre em</label>
                    <input
                      type="date"
                      value={w.start}
                      onChange={(e) => handleWindowChange(w.id, 'start', e.target.value)}
                      className="h-9 px-2 bg-ink-50 border border-ink-200 rounded-lg text-xs font-bold text-ink-900 focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-ink-400 uppercase tracking-widest block mb-1">Fecha em</label>
                    <input
                      type="date"
                      value={w.end}
                      min={w.start || undefined}
                      onChange={(e) => handleWindowChange(w.id, 'end', e.target.value)}
                      className="h-9 px-2 bg-ink-50 border border-ink-200 rounded-lg text-xs font-bold text-ink-900 focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveWindow(w.id)}
                    className="h-9 px-3 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider self-end"
                    title="Fechar (remover) esta janela"
                  >
                    <Trash2 size={13} />
                    Fechar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── DATAS BLOQUEADAS ─── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 ml-1">
          <CalendarOff size={15} className="text-rose-600" />
          <h4 className="text-[10px] font-black text-ink-500 uppercase tracking-widest">Datas Bloqueadas</h4>
        </div>
        <p className="text-xs text-ink-500 ml-1 -mt-2">
          Bloqueie datas exatas (feriados, recessos, congressos) — mesmo dentro de uma janela aberta, o dia fica indisponível.
        </p>

        <div className="p-5 rounded-2xl bg-rose-50/40 border border-rose-200 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div>
              <label className="text-[9px] font-black text-ink-400 uppercase tracking-widest block mb-1">Data</label>
              <input
                type="date"
                value={newBlockDate}
                onChange={(e) => setNewBlockDate(e.target.value)}
                className="h-10 px-3 bg-white border border-ink-200 rounded-xl text-xs font-bold text-ink-900 focus:border-rose-400 outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-[9px] font-black text-ink-400 uppercase tracking-widest block mb-1">Motivo (opcional)</label>
              <input
                type="text"
                value={newBlockReason}
                onChange={(e) => setNewBlockReason(e.target.value)}
                placeholder="Ex: Feriado municipal"
                className="w-full h-10 px-3 bg-white border border-ink-200 rounded-xl text-xs font-bold text-ink-900 focus:border-rose-400 outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleAddBlockedDate}
              disabled={!newBlockDate}
              className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <CalendarOff size={12} />
              Bloquear Data
            </button>
          </div>

          {blockedDates.length === 0 ? (
            <p className="text-xs text-ink-500 italic">Nenhuma data bloqueada.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {blockedDates.map(b => (
                <span key={b.date} className="inline-flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl bg-white border border-rose-200 text-xs font-bold text-ink-800 shadow-sm">
                  {formatBrDate(b.date)}
                  {b.reason && <span className="text-[10px] font-medium text-ink-500">— {b.reason}</span>}
                  <button
                    type="button"
                    onClick={() => handleRemoveBlockedDate(b.date)}
                    className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 transition-all"
                    title="Desbloquear data"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-6 border-t border-ink-100 justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="h-14 px-8 bg-ink-900 hover:bg-ink-800 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm active:scale-95"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          Salvar Configurações de Agenda
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-14 px-6 border border-ink-200 hover:bg-ink-50 text-ink-600 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
