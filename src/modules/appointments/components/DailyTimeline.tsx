import { useMemo } from 'react';
import { Clinic, Appointment } from '../../../types';
import { generateSlotsForDay } from '../utils/scheduleUtils';
import { 
  Clock, Plus, Check, RefreshCw, X, Trash2, ShieldCheck, Edit
} from 'lucide-react';
import { classNames } from '../../../utils/format';
import { AreaIcon } from '../../../components/AreaIcon';

interface DailyTimelineProps {
  clinic: Clinic;
  selectedDate: string;
  appointments: Appointment[];
  onConfirm: (app: Appointment) => void;
  onCancel: (app: Appointment) => void;
  onDelete: (app: Appointment) => void;
  onReschedule: (app: Appointment) => void;
  onEdit: (app: Appointment) => void;
  onQuickSchedule: (time: string) => void;
}

export function DailyTimeline({
  clinic,
  selectedDate,
  appointments,
  onConfirm,
  onCancel,
  onDelete,
  onReschedule,
  onEdit,
  onQuickSchedule,
}: DailyTimelineProps) {
  const slots = useMemo(() => {
    return generateSlotsForDay(clinic, selectedDate, appointments);
  }, [clinic, selectedDate, appointments]);

  const appointmentsMap = useMemo(() => {
    const map: Record<string, Appointment> = {};
    appointments.forEach(app => {
      map[app.id] = app;
    });
    return map;
  }, [appointments]);

  const nowTimeStr = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (selectedDate !== todayStr) return null;
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }, [selectedDate]);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Clock className="text-slate-800" size={18} />
        <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest leading-none">Visão em Linha do Tempo</h3>
      </div>

      {slots.length === 0 ? (
        <div className="text-center py-12 text-slate-400 italic text-xs">
          Sem expediente ou turnos configurados para este dia da semana.
        </div>
      ) : (
        <div className="relative border-l border-slate-200 ml-4 pl-6 space-y-6 py-2">
          {slots.map((slot) => {
            const appointment = slot.appointmentId ? appointmentsMap[slot.appointmentId] : null;
            const isNow = nowTimeStr && nowTimeStr >= slot.time && (slots.find(s => s.time > slot.time)?.time || '24:00') > nowTimeStr;

            const statusBorder = appointment
              ? appointment.status === 'confirmado' ? 'border-emerald-250 bg-emerald-50/5' :
                appointment.status === 'cancelado' ? 'border-rose-200 bg-rose-50/5' :
                'border-blue-200 bg-blue-50/5'
              : 'border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50/50';

            return (
              <div key={slot.time} className="relative group/slot">
                {/* Time Indicator Marker */}
                <div className={classNames(
                  "absolute -left-[31px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 bg-white transition-all z-10",
                  isNow ? "bg-amber-500 border-amber-500 scale-125 ring-4 ring-amber-500/20" :
                  slot.booked ? "border-slate-900 bg-slate-900" : "border-slate-300"
                )} />

                {/* Time Text */}
                <div className="absolute -left-[80px] top-1/2 -translate-y-1/2 w-12 text-right">
                  <span className={classNames(
                    "text-xs font-black",
                    isNow ? "text-amber-600 font-bold" : "text-slate-600"
                  )}>
                    {slot.time}
                  </span>
                </div>

                {/* Slot Card */}
                <div className={classNames(
                  "border rounded-2xl p-4 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
                  statusBorder
                )}>
                  {appointment ? (
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-slate-500 bg-slate-100">
                        <AreaIcon area={appointment.area} size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900 text-xs truncate max-w-[150px] sm:max-w-[200px]">
                            {appointment.patientName}
                          </span>
                          {appointment.priority === 'urgente' && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-black text-[6px] uppercase tracking-widest animate-pulse shrink-0">
                              Urgente
                            </span>
                          )}
                          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider shrink-0">
                            ({appointment.examType})
                          </span>
                        </div>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                          ID: {appointment.patientId} {appointment.patientInsurance ? `• Convênio: ${appointment.patientInsurance}` : ''}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-slate-400">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                        <Plus size={12} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-500">Horário Disponível</span>
                        <span className="text-[8px] font-bold uppercase tracking-wider block text-slate-400">{slot.shiftName}</span>
                      </div>
                    </div>
                  )}

                  {/* Actions Area */}
                  <div className="shrink-0 flex items-center gap-1.5 opacity-90 sm:opacity-0 group-hover/slot:opacity-100 transition-opacity self-end sm:self-auto">
                    {appointment ? (
                      appointment.status === 'agendado' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onConfirm(appointment)}
                            className="h-8 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[9px] uppercase tracking-wider rounded-lg shadow-sm flex items-center gap-1 active:scale-95 transition-all"
                          >
                            <Check size={10} /> Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => onEdit(appointment)}
                            className="p-1.5 text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-200 rounded-lg transition-all active:scale-95"
                            title="Editar"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onReschedule(appointment)}
                            className="p-1.5 text-slate-600 hover:text-brand-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all active:scale-95"
                            title="Reagendar"
                          >
                            <RefreshCw size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onCancel(appointment)}
                            className="p-1.5 text-amber-600 hover:text-white hover:bg-amber-600 border border-amber-200 rounded-lg transition-all active:scale-95"
                            title="Cancelar"
                          >
                            <X size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(appointment)}
                            className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-600 border border-rose-200 rounded-lg transition-all active:scale-95"
                            title="Excluir"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      ) : appointment.status === 'confirmado' ? (
                        <>
                          <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1.5 rounded-lg flex items-center gap-1 shadow-inner">
                            <ShieldCheck size={11} /> PACS
                          </span>
                          <button
                            type="button"
                            onClick={() => onDelete(appointment)}
                            className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-600 border border-rose-200 rounded-lg transition-all active:scale-95"
                            title="Excluir"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-[8px] font-black text-rose-650 bg-rose-50 border border-rose-200 px-2 py-1.5 rounded-lg flex items-center gap-1 shadow-inner">
                            Cancelado
                          </span>
                          <button
                            type="button"
                            onClick={() => onDelete(appointment)}
                            className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-600 border border-rose-200 rounded-lg transition-all active:scale-95"
                            title="Excluir"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => onQuickSchedule(slot.time)}
                        className="h-8 px-3 border border-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 text-slate-700 font-bold text-[9px] uppercase tracking-wider rounded-lg transition-all active:scale-95 flex items-center gap-1"
                      >
                        <Plus size={10} /> Agendar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
