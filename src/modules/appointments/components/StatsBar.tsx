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
    <div className="relative bg-gradient-to-br from-zinc-950 to-zinc-900 text-white border border-zinc-850 rounded-3xl p-5 shadow-xl overflow-hidden flex flex-col md:flex-row items-center justify-between gap-5 font-sans">
      {/* Decorative Glows */}
      <div className="absolute -right-12 -top-12 w-36 h-36 bg-emerald-550/10 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -left-12 -bottom-12 w-36 h-36 bg-blue-550/10 blur-3xl rounded-full pointer-events-none" />

      {/* Date Info */}
      <div className="flex items-center gap-3 relative shrink-0 z-10 w-full md:w-auto">
        <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 shadow-inner">
          <CalendarDays size={20} />
        </div>
        <div>
          <h4 className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest leading-none">Resumo Diário</h4>
          <span className="text-xs font-black text-zinc-100 mt-1.5 block capitalize leading-none">{formattedDate}</span>
        </div>
      </div>

      {/* Grid of stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto flex-1 max-w-3xl z-10">
        {/* Total */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 p-3 rounded-2xl flex items-center gap-3 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-zinc-850 flex items-center justify-center text-zinc-300">
            <CalendarDays size={16} />
          </div>
          <div>
            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block leading-none">Agendados</span>
            <span className="text-base font-black text-white mt-1 block leading-none">{counts.total}</span>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-blue-950/40 border border-blue-900/50 p-3 rounded-2xl flex items-center gap-3 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-blue-900/40 flex items-center justify-center text-blue-400">
            <Clock size={16} />
          </div>
          <div>
            <span className="text-[9px] font-black text-blue-350 uppercase tracking-wider block leading-none">Pendentes</span>
            <span className="text-base font-black text-blue-100 mt-1 block leading-none">{counts.agendado}</span>
          </div>
        </div>

        {/* Confirmed */}
        <div className="bg-emerald-950/40 border border-emerald-900/50 p-3 rounded-2xl flex items-center gap-3 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-emerald-900/40 flex items-center justify-center text-emerald-400">
            <Check size={16} />
          </div>
          <div>
            <span className="text-[9px] font-black text-emerald-350 uppercase tracking-wider block leading-none">Confirmados</span>
            <span className="text-base font-black text-emerald-100 mt-1 block leading-none">{counts.confirmado}</span>
          </div>
        </div>

        {/* Confirmation Rate */}
        <div className="bg-violet-950/40 border border-violet-900/50 p-3 rounded-2xl flex items-center gap-3 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-violet-900/40 flex items-center justify-center text-violet-400">
            <Percent size={14} />
          </div>
          <div>
            <span className="text-[9px] font-black text-violet-350 uppercase tracking-wider block leading-none">Taxa Conf.</span>
            <span className="text-base font-black text-violet-100 mt-1 block leading-none">{confirmationRate}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
