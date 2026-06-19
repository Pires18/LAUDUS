import { useState, useEffect } from 'react';
import { Clinic } from '../../../types';
import { Sliders, Plus, Trash2, Loader2 } from 'lucide-react';
import { Shift, WeekdayShiftConfig, DEFAULT_WEEKDAY_SHIFTS } from '../utils/scheduleUtils';

interface ShiftConfigPanelProps {
  clinics: Clinic[];
  configClinicId: string;
  onClinicChange: (id: string) => void;
  onSave: (clinicId: string, shifts: WeekdayShiftConfig[]) => Promise<void>;
  onCancel: () => void;
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

  useEffect(() => {
    const clinic = clinics.find(c => c.id === configClinicId);
    if (clinic) {
      setWeekdayShifts(clinic.schedulingConfig?.weekdayShifts || DEFAULT_WEEKDAY_SHIFTS);
    }
  }, [configClinicId, clinics]);

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
    setLoading(true);
    try {
      await onSave(configClinicId, weekdayShifts);
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

      <div className="flex gap-3 pt-6 border-t border-ink-100 justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="h-14 px-8 bg-ink-900 hover:bg-ink-800 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm active:scale-95"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          Salvar Configurações de Turnos
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
