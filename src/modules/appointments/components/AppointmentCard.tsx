import { useMemo } from 'react';
import { Appointment, Clinic } from '../../../types';
import { 
  Clock, Check, X, Building2, Phone, 
  Trash2, RefreshCw, AlertTriangle, ShieldCheck, Edit
} from 'lucide-react';
import { classNames } from '../../../utils/format';
import { AreaIcon } from '../../../components/AreaIcon';
import { motion } from 'framer-motion';

interface AppointmentCardProps {
  appointment: Appointment;
  clinic?: Clinic;
  onConfirm: (app: Appointment) => void;
  onCancel: (app: Appointment) => void;
  onDelete: (app: Appointment) => void;
  onReschedule: (app: Appointment) => void;
  onEdit: (app: Appointment) => void;
}

export function AppointmentCard({
  appointment,
  clinic,
  onConfirm,
  onCancel,
  onDelete,
  onReschedule,
  onEdit,
}: AppointmentCardProps) {
  const appTime = new Date(appointment.scheduledAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const appDateStr = new Date(appointment.scheduledAt).toLocaleDateString('pt-BR');

  const areaColors = useMemo(() => {
    switch (appointment.area) {
      case 'medicina-interna':
        return {
          gradient: 'from-blue-400 to-blue-600',
          avatarBg: 'bg-blue-100 text-blue-700',
        };
      case 'ginecologia':
      case 'medicina-fetal':
        return {
          gradient: 'from-pink-400 to-rose-600',
          avatarBg: 'bg-pink-100 text-pink-700',
        };
      case 'pequenas-partes':
        return {
          gradient: 'from-emerald-400 to-emerald-600',
          avatarBg: 'bg-emerald-100 text-emerald-700',
        };
      case 'musculoesqueletico':
        return {
          gradient: 'from-orange-400 to-orange-600',
          avatarBg: 'bg-orange-100 text-orange-700',
        };
      case 'vascular':
        return {
          gradient: 'from-red-400 to-red-650',
          avatarBg: 'bg-red-100 text-red-700',
        };
      case 'pediatria':
        return {
          gradient: 'from-cyan-400 to-cyan-600',
          avatarBg: 'bg-cyan-100 text-cyan-700',
        };
      case 'procedimentos':
        return {
          gradient: 'from-ink-400 to-ink-600',
          avatarBg: 'bg-ink-100 text-ink-700',
        };
      case 'reumatologico':
        return {
          gradient: 'from-amber-400 to-amber-600',
          avatarBg: 'bg-amber-100 text-amber-700',
        };
      case 'mastologia':
        return {
          gradient: 'from-rose-400 to-pink-600',
          avatarBg: 'bg-rose-100 text-rose-700',
        };
      default:
        return {
          gradient: 'from-ink-400 to-ink-600',
          avatarBg: 'bg-ink-100 text-ink-700',
        };
    }
  }, [appointment.area]);

  const patientInitials = useMemo(() => {
    if (!appointment.patientName) return 'P';
    return appointment.patientName
      .trim()
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [appointment.patientName]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className={classNames(
        "bg-white border rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative group",
        appointment.status === 'confirmado' ? "border-emerald-250 bg-emerald-50/5" :
        appointment.status === 'cancelado' ? "border-rose-200 bg-rose-50/5" : "border-ink-200"
      )}
    >
      {/* Decorative gradient bar on the left side */}
      <div className={classNames(
        "absolute left-0 top-6 bottom-6 w-1 rounded-r-lg bg-gradient-to-b",
        areaColors.gradient
      )} />

      <div className="pl-3 space-y-3">
        {/* Top Header line: Status and Time */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
            <span className="flex items-center gap-1 bg-ink-100 text-ink-700 px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wide">
              <Clock size={12} /> {appTime}
            </span>
            <span className="font-bold text-ink-600">{appDateStr}</span>
            {clinic && (
              <span className="flex items-center gap-0.5 text-[9px] font-black text-brand-600 truncate max-w-[130px]" title={clinic.name}>
                <Building2 size={10} /> {clinic.name}
              </span>
            )}
          </div>

          {/* Status pill (no diagonal ribbon) */}
          <div className="shrink-0">
            {appointment.status === 'confirmado' ? (
              <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <Check size={10} /> Confirmado
              </span>
            ) : appointment.status === 'cancelado' ? (
              <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                <X size={10} /> Cancelado
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                🔵 Agendado
              </span>
            )}
          </div>
        </div>

        {/* Patient Details */}
        <div className="flex items-center gap-3">
          <div className={classNames(
            "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-inner",
            areaColors.avatarBg
          )}>
            {patientInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-black text-ink-900 text-sm leading-tight truncate max-w-[180px] sm:max-w-[220px]" title={appointment.patientName}>
                {appointment.patientName}
              </h3>
              {appointment.priority === 'urgente' && (
                <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-black text-[7px] uppercase tracking-widest animate-pulse flex items-center gap-0.5 shrink-0">
                  <AlertTriangle size={8} /> Urgente
                </span>
              )}
            </div>
            <p className="text-[9px] text-ink-400 font-bold uppercase tracking-wider mt-1">
              ID: {appointment.patientId} {appointment.patientBirthDate ? `• Nasc: ${appointment.patientBirthDate}` : ''}
            </p>
          </div>
        </div>

        {/* Exam Template Indicator */}
        <div className="flex items-center gap-2 text-xs font-semibold text-ink-700 bg-ink-50 border border-ink-200/60 p-2.5 rounded-xl">
          <AreaIcon area={appointment.area} size={14} className="text-ink-400 shrink-0" />
          <span className="truncate" title={appointment.examType}>{appointment.examType}</span>
        </div>

        {/* Additional information */}
        <div className="grid grid-cols-2 gap-2 text-[10px] text-ink-600 border-t border-ink-100 pt-2.5">
          {appointment.patientPhone && (
            <div className="flex items-center gap-1 truncate" title={`Telefone: ${appointment.patientPhone}`}>
              <Phone size={10} className="text-ink-400 shrink-0" />
              <span className="truncate">{appointment.patientPhone}</span>
            </div>
          )}
          {appointment.patientCPF && (
            <div className="flex items-center gap-1 truncate" title={`CPF: ${appointment.patientCPF}`}>
              <span className="font-bold text-ink-400 shrink-0">CPF:</span>
              <span className="truncate">{appointment.patientCPF}</span>
            </div>
          )}
          {appointment.patientInsurance && (
            <div className="flex items-center gap-1 truncate" title={`Convênio: ${appointment.patientInsurance}`}>
              <span className="font-bold text-ink-400 shrink-0">Conv:</span>
              <span className="truncate font-black text-ink-700">{appointment.patientInsurance}</span>
            </div>
          )}
          {appointment.requestingPhysician && (
            <div className="flex items-center gap-1 truncate" title={`Médico Solicitante: ${appointment.requestingPhysician}`}>
              <span className="font-bold text-ink-400 shrink-0">Dr(a):</span>
              <span className="truncate">{appointment.requestingPhysician}</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {appointment.notes && (
          <p className="text-[10px] text-ink-500 italic bg-ink-50/50 p-2 rounded-xl border border-ink-100/60 truncate" title={appointment.notes}>
            Obs: {appointment.notes}
          </p>
        )}
      </div>

      {/* Action buttons (fixed height footer) */}
      <div className="flex gap-2 mt-4 pt-3 border-t border-ink-100 pl-3 shrink-0">
        {appointment.status === 'agendado' && (
          <>
            <button
              type="button"
              onClick={() => onConfirm(appointment)}
              className="flex-1 h-9 bg-ink-900 hover:bg-ink-800 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-sm flex items-center justify-center gap-1 active:scale-95 transition-all"
            >
              <Check size={12} /> Confirmar
            </button>
            <button
              type="button"
              onClick={() => onEdit(appointment)}
              className="p-2 text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-200 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-sm"
              title="Editar"
            >
              <Edit size={13} />
            </button>
            <button
              type="button"
              onClick={() => onReschedule(appointment)}
              className="p-2 text-ink-600 hover:text-brand-700 hover:bg-ink-50 border border-ink-200 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-sm"
              title="Reagendar"
            >
              <RefreshCw size={13} />
            </button>
            <button
              type="button"
              onClick={() => onCancel(appointment)}
              className="p-2 text-amber-600 hover:text-white hover:bg-amber-600 border border-amber-250 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-sm"
              title="Cancelar Agendamento"
            >
              <X size={13} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(appointment)}
              className="p-2 text-rose-500 hover:text-white hover:bg-rose-650 border border-rose-200 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-sm"
              title="Excluir Permanentemente"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}

        {appointment.status === 'confirmado' && (
          <>
            <div className="flex-1 text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 h-9 rounded-xl flex items-center gap-1.5 justify-center shadow-inner">
              <ShieldCheck size={14} className="shrink-0" />
              <span>ENVIADO PACS WORKLIST</span>
            </div>
            <button
              type="button"
              onClick={() => onDelete(appointment)}
              className="p-2 text-rose-500 hover:text-white hover:bg-rose-650 border border-rose-200 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-sm shrink-0"
              title="Excluir"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}

        {appointment.status === 'cancelado' && (
          <>
            <div className="flex-1 text-[9px] font-black text-rose-650 bg-rose-50 border border-rose-200 px-3 h-9 rounded-xl flex items-center gap-1.5 justify-center shadow-inner">
              <X size={14} className="shrink-0" />
              <span>AGENDAMENTO CANCELADO</span>
            </div>
            <button
              type="button"
              onClick={() => onDelete(appointment)}
              className="p-2 text-rose-500 hover:text-white hover:bg-rose-650 border border-rose-200 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-sm shrink-0"
              title="Excluir"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
