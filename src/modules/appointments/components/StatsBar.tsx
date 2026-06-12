import { useMemo } from 'react';
import { CalendarDays, Check, Clock, Percent } from 'lucide-react';
import { Appointment } from '../../../types';
import { countDayAppointments } from '../utils/scheduleUtils';

interface StatsBarProps {
  appointments: Appointment[];
  selectedDate: string;
  clinicId?: string;
}

export function StatsBar({ appointments, selectedDate, clinicId }: StatsBarProps) {
  const counts = countDayAppointments(appointments, selectedDate, clinicId);

  const formattedDate = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, [selectedDate]);

  const confirmationRate = useMemo(() => {
    if (counts.total === 0) return 0;
    return Math.round((counts.confirmado / counts.total) * 100);
  }, [counts]);

  return (
    <div className="relative bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 rounded-3xl p-5 shadow-lg overflow-hidden flex flex-col md:flex-row items-center justify-between gap-5">
      {/* Decorative Glows */}
      <div className="absolute -right-12 -top-12 w-36 h-36 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -left-12 -bottom-12 w-36 h-36 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />

      {/* Date Info */}
      <div className="flex items-center gap-3 relative shrink-0 z-10 w-full md:w-auto">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400">
          <CalendarDays size={20} />
        </div>
        <div>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Resumo Diário</h4>
          <span className="text-xs font-black text-white mt-1.5 block capitalize leading-none">{formattedDate}</span>
        </div>
      </div>

      {/* Grid of stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto flex-1 max-w-3xl z-10">
        {/* Total */}
        <div className="bg-white/5 border border-white/10 p-3 rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-slate-300">
            <CalendarDays size={16} />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-none">Agendados</span>
            <span className="text-base font-black text-white mt-1 block leading-none">{counts.total}</span>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/25 flex items-center justify-center text-blue-300">
            <Clock size={16} />
          </div>
          <div>
            <span className="text-[9px] font-bold text-blue-300 uppercase tracking-wider block leading-none">Pendentes</span>
            <span className="text-base font-black text-blue-100 mt-1 block leading-none">{counts.agendado}</span>
          </div>
        </div>

        {/* Confirmed */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/25 flex items-center justify-center text-emerald-300">
            <Check size={16} />
          </div>
          <div>
            <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-wider block leading-none">Confirmados</span>
            <span className="text-base font-black text-emerald-100 mt-1 block leading-none">{counts.confirmado}</span>
          </div>
        </div>

        {/* Confirmation Rate */}
        <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/25 flex items-center justify-center text-purple-300">
            <Percent size={14} />
          </div>
          <div>
            <span className="text-[9px] font-bold text-purple-300 uppercase tracking-wider block leading-none">Taxa Conf.</span>
            <span className="text-base font-black text-purple-100 mt-1 block leading-none">{confirmationRate}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
