import { useMemo } from 'react';
import { Appointment, Clinic } from '../../../types';
import { 
  Clock, Check, X, Building2, Phone, 
  Trash2, RefreshCw, AlertTriangle, ShieldCheck, Edit,
  User, Fingerprint, Calendar, Heart
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
          avatarBg: 'bg-blue-50 text-blue-600 border border-blue-150',
          glow: 'group-hover:border-blue-200 group-hover:shadow-blue-500/5',
        };
      case 'ginecologia':
      case 'medicina-fetal':
        return {
          gradient: 'from-pink-400 to-rose-600',
          avatarBg: 'bg-pink-50 text-pink-600 border border-pink-150',
          glow: 'group-hover:border-pink-200 group-hover:shadow-pink-500/5',
        };
      case 'pequenas-partes':
        return {
          gradient: 'from-emerald-400 to-emerald-600',
          avatarBg: 'bg-emerald-50 text-emerald-600 border border-emerald-150',
          glow: 'group-hover:border-emerald-200 group-hover:shadow-emerald-500/5',
        };
      case 'musculoesqueletico':
        return {
          gradient: 'from-orange-400 to-orange-600',
          avatarBg: 'bg-orange-50 text-orange-600 border border-orange-150',
          glow: 'group-hover:border-orange-200 group-hover:shadow-orange-500/5',
        };
      case 'vascular':
        return {
          gradient: 'from-red-400 to-red-600',
          avatarBg: 'bg-red-50 text-red-600 border border-red-150',
          glow: 'group-hover:border-red-200 group-hover:shadow-red-500/5',
        };
      case 'pediatria':
        return {
          gradient: 'from-cyan-400 to-cyan-600',
          avatarBg: 'bg-cyan-50 text-cyan-600 border border-cyan-150',
          glow: 'group-hover:border-cyan-200 group-hover:shadow-cyan-500/5',
        };
      case 'procedimentos':
        return {
          gradient: 'from-ink-400 to-ink-600',
          avatarBg: 'bg-ink-50 text-ink-600 border border-ink-150',
          glow: 'group-hover:border-ink-200 group-hover:shadow-ink-500/5',
        };
      case 'reumatologico':
        return {
          gradient: 'from-amber-400 to-amber-600',
          avatarBg: 'bg-amber-50 text-amber-600 border border-amber-150',
          glow: 'group-hover:border-amber-200 group-hover:shadow-amber-500/5',
        };
      case 'mastologia':
        return {
          gradient: 'from-rose-400 to-pink-600',
          avatarBg: 'bg-rose-50 text-rose-600 border border-rose-150',
          glow: 'group-hover:border-rose-200 group-hover:shadow-rose-500/5',
        };
      default:
        return {
          gradient: 'from-ink-400 to-ink-600',
          avatarBg: 'bg-ink-50 text-ink-600 border border-ink-150',
          glow: 'group-hover:border-ink-250',
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
        "bg-white border rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between relative group overflow-hidden",
        appointment.status === 'confirmado' ? "border-emerald-200/80 bg-emerald-50/5" :
        appointment.status === 'cancelado' ? "border-rose-200/80 bg-rose-50/5" : "border-ink-200/80",
        areaColors.glow
      )}
    >
      {/* Side Color Accent bar */}
      <div className={classNames(
        "absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b",
        areaColors.gradient
      )} />

      <div className="space-y-4">
        {/* Row 1: Time, Date, Clinic & Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100/50 pb-3">
          <div className="flex items-center gap-2 flex-wrap text-ink-500">
            <span className="flex items-center gap-1 bg-ink-100 text-ink-800 px-2.5 py-1 rounded-xl font-bold text-[10px] uppercase tracking-wide">
              <Clock size={11} className="text-ink-500" /> {appTime}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-500 bg-ink-50 px-2 py-1 rounded-lg">
              <Calendar size={11} /> {appDateStr}
            </span>
            {clinic && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-brand-600 bg-brand-50/50 border border-brand-100/50 px-2 py-0.5 rounded-lg truncate max-w-[120px]" title={clinic.name}>
                <Building2 size={10} /> {clinic.name}
              </span>
            )}
          </div>

          {/* Status badge with ping animations */}
          <div className="shrink-0">
            {appointment.status === 'confirmado' ? (
              <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-250 flex items-center gap-1.5 shadow-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                Confirmado
              </span>
            ) : appointment.status === 'cancelado' ? (
              <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-250 flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Cancelado
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-250 flex items-center gap-1.5 shadow-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                </span>
                Agendado
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Patient Profile Info */}
        <div className="flex items-center gap-4">
          <div className={classNames(
            "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm",
            areaColors.avatarBg
          )}>
            {patientInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-ink-900 text-base leading-tight truncate max-w-[200px] sm:max-w-[260px]" title={appointment.patientName}>
                {appointment.patientName}
              </h3>
              {appointment.priority === 'urgente' && (
                <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-black text-[7px] uppercase tracking-widest animate-pulse flex items-center gap-0.5 shrink-0 shadow-sm">
                  <AlertTriangle size={8} /> Urgente
                </span>
              )}
            </div>
            <p className="text-[10px] text-ink-400 font-bold uppercase tracking-wider mt-1">
              Prontuário: <span className="text-ink-600 font-black">{appointment.patientId}</span> {appointment.patientBirthDate ? `· Nasc: ${appointment.patientBirthDate}` : ''}
            </p>
          </div>
        </div>

        {/* Row 3: Specialty & Exam Template */}
        <div className="flex items-center gap-2.5 text-xs font-bold text-ink-800 bg-ink-50/50 border border-ink-150 p-3 rounded-2xl">
          <div className="w-6 h-6 rounded-lg bg-white border border-ink-200 flex items-center justify-center shrink-0 shadow-sm">
            <AreaIcon area={appointment.area} size={13} className="text-ink-500" />
          </div>
          <span className="truncate leading-none" title={appointment.examType}>{appointment.examType}</span>
        </div>

        {/* Row 4: Metadata Fields Grid (CPF, Phone, Insurance, Doc) */}
        <div className="grid grid-cols-2 gap-3 text-[10px] text-ink-600 bg-ink-50/30 border border-ink-100 p-3.5 rounded-2xl">
          {appointment.patientPhone ? (
            <div className="flex items-center gap-2 min-w-0" title={`Telefone: ${appointment.patientPhone}`}>
              <Phone size={11} className="text-ink-400 shrink-0" />
              <span className="truncate font-semibold">{appointment.patientPhone}</span>
            </div>
          ) : (
            <div className="text-ink-300 italic">Sem telefone</div>
          )}

          {appointment.patientCPF ? (
            <div className="flex items-center gap-2 min-w-0" title={`CPF: ${appointment.patientCPF}`}>
              <Fingerprint size={11} className="text-ink-400 shrink-0" />
              <span className="truncate font-semibold">{appointment.patientCPF}</span>
            </div>
          ) : (
            <div className="text-ink-300 italic">Sem CPF</div>
          )}

          {appointment.patientInsurance ? (
            <div className="flex items-center gap-2 min-w-0" title={`Convênio: ${appointment.patientInsurance}`}>
              <Heart size={11} className="text-rose-450 shrink-0" />
              <span className="truncate font-black text-ink-700">{appointment.patientInsurance}</span>
            </div>
          ) : (
            <div className="text-ink-300 italic">Sem Convênio</div>
          )}

          {appointment.requestingPhysician ? (
            <div className="flex items-center gap-2 min-w-0" title={`Médico Solicitante: ${appointment.requestingPhysician}`}>
              <User size={11} className="text-ink-400 shrink-0" />
              <span className="truncate font-semibold">{appointment.requestingPhysician}</span>
            </div>
          ) : (
            <div className="text-ink-300 italic">Sem Solicitante</div>
          )}
        </div>

        {/* Row 5: Notes Quote */}
        {appointment.notes && (
          <div className="text-[10px] text-ink-500 italic bg-amber-50/30 p-3 rounded-2xl border-l-4 border-amber-300 leading-relaxed">
            <span className="font-bold text-amber-700 not-italic block text-[8px] uppercase tracking-wider mb-0.5">Observações:</span>
            "{appointment.notes}"
          </div>
        )}
      </div>

      {/* Row 6: Consolidated Actions Row */}
      <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-ink-100 shrink-0">
        {appointment.status === 'agendado' && (
          <>
            <button
              type="button"
              onClick={() => onConfirm(appointment)}
              className="flex-1 h-10 bg-ink-900 hover:bg-ink-800 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <Check size={14} strokeWidth={2.5} /> Confirmar
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onEdit(appointment)}
                className="w-9 h-9 text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 border border-blue-150 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-sm"
                title="Editar agendamento"
              >
                <Edit size={13} />
              </button>
              <button
                type="button"
                onClick={() => onReschedule(appointment)}
                className="w-9 h-9 text-ink-700 hover:bg-ink-100 border border-ink-200 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-sm"
                title="Reagendar horário"
              >
                <RefreshCw size={13} />
              </button>
              <button
                type="button"
                onClick={() => onCancel(appointment)}
                className="w-9 h-9 text-amber-600 hover:text-white bg-amber-50 hover:bg-amber-600 border border-amber-200 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-sm"
                title="Cancelar agendamento"
              >
                <X size={13} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(appointment)}
                className="w-9 h-9 text-rose-500 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-sm"
                title="Excluir permanentemente"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </>
        )}

        {appointment.status === 'confirmado' && (
          <>
            <div className="flex-1 text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-250 px-3 h-10 rounded-xl flex items-center gap-2 justify-center shadow-inner select-none">
              <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
              <span>ENVIADO PACS WORKLIST</span>
            </div>
            <button
              type="button"
              onClick={() => onDelete(appointment)}
              className="w-9 h-9 text-rose-500 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-sm shrink-0"
              title="Excluir agendamento"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}

        {appointment.status === 'cancelado' && (
          <>
            <div className="flex-1 text-[9px] font-black text-rose-700 bg-rose-50 border border-rose-200/80 px-3 h-10 rounded-xl flex items-center gap-2 justify-center shadow-inner select-none">
              <X size={14} className="text-rose-500 shrink-0" />
              <span>AGENDAMENTO CANCELADO</span>
            </div>
            <button
              type="button"
              onClick={() => onDelete(appointment)}
              className="w-9 h-9 text-rose-500 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-sm shrink-0"
              title="Excluir agendamento"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
