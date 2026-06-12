import { useMemo, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Home } from 'lucide-react';
import { Appointment } from '../../../types';
import { classNames } from '../../../utils/format';
import { getLocalDateStr, countDayAppointments } from '../utils/scheduleUtils';

interface WeeklyCalendarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  appointments: Appointment[];
  clinicId?: string;
}

export function WeeklyCalendar({
  selectedDate,
  onSelectDate,
  appointments,
  clinicId,
}: WeeklyCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const today = useMemo(() => getLocalDateStr(new Date()), []);

  const weekDays = useMemo(() => {
    const days = [];
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + weekOffset * 7);

    // Start from Monday of the week (pt-BR convention)
    const dayOfWeek = baseDate.getDay();
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() - ((dayOfWeek + 6) % 7));

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = getLocalDateStr(d);
      const counts = countDayAppointments(appointments, dateStr, clinicId);
      const isToday = dateStr === today;
      const isPast = dateStr < today;
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

      // Full day: has appointments but all agendado/confirmado and confirmed equals total (simplified indicator)
      const isFull = counts.total > 0 && counts.agendado === 0 && counts.confirmado === counts.total;

      days.push({
        dateStr,
        dayNum: d.getDate(),
        dayLabel: d.toLocaleDateString('pt-BR', { weekday: 'short' })
          .replace('.', '')
          .toUpperCase()
          .substring(0, 3),
        counts,
        isToday,
        isPast,
        isWeekend,
        isFull,
      });
    }
    return days;
  }, [appointments, weekOffset, clinicId, today]);

  const weekRangeLabel = useMemo(() => {
    if (weekDays.length === 0) return '';
    const first = new Date(weekDays[0].dateStr + 'T00:00:00');
    const last = new Date(weekDays[6].dateStr + 'T00:00:00');
    
    const firstDay = first.getDate();
    const lastDay = last.getDate();
    
    const firstMonth = first.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
    const lastMonth = last.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
    
    const firstYear = first.getFullYear();
    const lastYear = last.getFullYear();

    if (firstYear !== lastYear) {
      return `${firstDay} DE ${firstMonth} DE ${firstYear} – ${lastDay} DE ${lastMonth} DE ${lastYear}`;
    }
    if (firstMonth !== lastMonth) {
      return `${firstDay} DE ${firstMonth} – ${lastDay} DE ${lastMonth} DE ${firstYear}`;
    }
    return `${firstDay} – ${lastDay} DE ${firstMonth} DE ${firstYear}`;
  }, [weekDays]);

  const handleResetToToday = () => {
    setWeekOffset(0);
    onSelectDate(today);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
      {/* Calendar Header with Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-sm">
            <Calendar size={15} />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">Calendário Semanal</h4>
            <span className="text-[10px] text-slate-500 font-bold uppercase mt-1 block tracking-wider">{weekRangeLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center"
            title="Semana Anterior"
          >
            <ChevronLeft size={16} />
          </button>
          
          <button
            type="button"
            onClick={handleResetToToday}
            className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1"
            title="Ir para Hoje"
          >
            <Home size={12} />
            <span>Hoje</span>
          </button>

          <button
            type="button"
            onClick={() => setWeekOffset(prev => prev + 1)}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center"
            title="Próxima Semana"
          >
            <ChevronRight size={16} />
          </button>

          {/* Date Picker Button Wrapper */}
          <div className="relative overflow-hidden p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center cursor-pointer">
            <Calendar size={16} />
            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  onSelectDate(e.target.value);
                  const targetDate = new Date(e.target.value + 'T00:00:00');
                  const todayDate = new Date();
                  const diffTime = targetDate.getTime() - todayDate.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  setWeekOffset(Math.floor(diffDays / 7));
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>
        </div>
      </div>

      {/* Grid of 7 days */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
        {weekDays.map((day) => {
          const isSelected = selectedDate === day.dateStr;
          return (
            <button
              key={day.dateStr}
              type="button"
              onClick={() => onSelectDate(day.dateStr)}
              className={classNames(
                "flex flex-col items-center justify-between min-h-[85px] py-2.5 px-1 rounded-2xl border transition-all duration-300 relative active:scale-95 shadow-sm",
                isSelected
                  ? "bg-slate-900 border-slate-900 text-white shadow-md scale-[1.03]"
                  : "bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50",
                day.isToday && !isSelected ? "ring-2 ring-slate-900/10 border-slate-400" : ""
              )}
            >
              <span className={classNames(
                "text-[8px] sm:text-[9px] font-black uppercase tracking-widest mb-1.5",
                isSelected ? "text-slate-300" : "text-slate-400"
              )}>
                {day.dayLabel}
              </span>

              <span className="text-base sm:text-lg font-black leading-none mb-1">
                {day.dayNum}
              </span>

              <div className="flex items-center justify-center gap-0.5 mt-1.5 min-h-[6px]">
                {day.counts.agendado > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm" title={`${day.counts.agendado} Agendado(s)`} />
                )}
                {day.counts.confirmado > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm" title={`${day.counts.confirmado} Confirmado(s)`} />
                )}
                {day.counts.cancelado > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-sm" title={`${day.counts.cancelado} Cancelado(s)`} />
                )}
              </div>

              {day.counts.total > 0 && (
                <span className={classNames(
                  "absolute -top-1 -right-1 min-w-[15px] h-[15px] rounded-full text-[8px] font-black flex items-center justify-center px-1 shadow-sm border-none",
                  isSelected ? "bg-emerald-500 text-white" : "bg-slate-900 text-white"
                )}>
                  {day.counts.total}
                </span>
              )}

              {day.isFull && (
                <span className="absolute bottom-1 text-[7px] font-black tracking-widest text-rose-500">
                  CHEIA
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
