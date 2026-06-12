import { useState, useMemo } from 'react';
import { Appointment, Clinic } from '../../../types';
import { generateSlotsForDay } from '../utils/scheduleUtils';
import { X, CalendarRange, AlertCircle, Loader2 } from 'lucide-react';
import { classNames } from '../../../utils/format';
import { motion } from 'framer-motion';

interface RescheduleModalProps {
  appointment: Appointment;
  clinic: Clinic;
  appointments: Appointment[];
  onClose: () => void;
  onConfirm: (newDateStr: string, newTimeStr: string, newNotes: string) => Promise<void>;
}

export function RescheduleModal({
  appointment,
  clinic,
  appointments,
  onClose,
  onConfirm,
}: RescheduleModalProps) {
  const [loading, setLoading] = useState(false);
  const [newDate, setNewDate] = useState(new Date(appointment.scheduledAt).toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('');
  const [notes, setNotes] = useState(appointment.notes || '');

  const slots = useMemo(() => {
    return generateSlotsForDay(clinic, newDate, appointments);
  }, [clinic, newDate, appointments]);

  const handleConfirm = async () => {
    if (!newTime) return;
    setLoading(true);
    try {
      await onConfirm(newDate, newTime, notes);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div 
        initial={{ scale: 0.96, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 15 }}
        className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh] modal-mobile-sheet"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <CalendarRange size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 leading-tight">Reagendar Atendimento</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                Paciente: {appointment.patientName}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-xl"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {/* Exam info */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm text-xs">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Exame selecionado</span>
            <p className="font-bold text-slate-900">{appointment.examType}</p>
          </div>

          {/* New Date */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block ml-0.5">Nova Data</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => { setNewDate(e.target.value); setNewTime(''); }}
              className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl font-bold text-xs focus:border-slate-400 outline-none shadow-sm"
            />
          </div>

          {/* Slots */}
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block ml-0.5">Horários Disponíveis</label>
            
            {slots.length === 0 ? (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-700 text-xs font-semibold">
                <AlertCircle size={16} />
                <span>Sem turnos configurados ou expediente ativo para a data selecionada.</span>
              </div>
            ) : (
              <div className="space-y-3 max-h-[180px] overflow-y-auto p-2 border border-slate-200 rounded-xl custom-scrollbar">
                {Array.from(new Set(slots.map(s => s.shiftName))).map(shiftName => (
                  <div key={shiftName} className="space-y-1.5">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block px-1">{shiftName}</span>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                      {slots.filter(s => s.shiftName === shiftName).map(slot => {
                        // Allow picking the same slot of the current appointment we are rescheduling
                        const isBooked = slot.booked && slot.appointmentId !== appointment.id;
                        return (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={isBooked}
                            onClick={() => setNewTime(slot.time)}
                            className={classNames(
                              "py-2 rounded-lg text-xs font-bold text-center border transition-all active:scale-95",
                              isBooked 
                                ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed line-through" 
                                : newTime === slot.time
                                  ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                                  : "bg-emerald-50/30 border-emerald-100 text-emerald-800 hover:bg-emerald-100/50 hover:border-emerald-300"
                            )}
                          >
                            {slot.time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block ml-0.5">Observações / Indicação Clínica</label>
            <textarea
              placeholder="Indicações clínicas..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-16 p-3 bg-white border border-slate-200 rounded-xl font-medium text-xs focus:border-slate-400 outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !newTime}
            className="px-5 h-10 bg-slate-950 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : null}
            Reagendar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
