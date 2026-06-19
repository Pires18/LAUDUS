import { useState } from 'react';
import { Appointment } from '../../../types';
import { Check, Sparkles, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface ConfirmAppointmentModalProps {
  appointment: Appointment;
  dicomDevices: { id: string; name: string; aeTitle: string }[];
  onClose: () => void;
  onConfirm: (deviceId: string, autoRedirect: boolean) => Promise<void>;
}

export function ConfirmAppointmentModal({
  appointment,
  dicomDevices,
  onClose,
  onConfirm,
}: ConfirmAppointmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState(dicomDevices[0]?.id || '');
  const [autoRedirect, setAutoRedirect] = useState(true);

  const appTime = new Date(appointment.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const appDateStr = new Date(appointment.scheduledAt).toLocaleDateString('pt-BR');

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(selectedDeviceId, autoRedirect);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm animate-in fade-in duration-300 animate-in fade-in">
      <motion.div 
        initial={{ scale: 0.96, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 15 }}
        className="bg-white rounded-3xl border border-ink-100 shadow-2xl max-w-md w-full overflow-hidden"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-ink-100 pb-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Check size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-ink-900 leading-tight">Confirmar e Lançar Exame</h3>
              <p className="text-[10px] text-ink-400 font-bold uppercase tracking-wider">Integração Local com PACS Worklist</p>
            </div>
          </div>

          <div className="space-y-2.5 bg-ink-50 p-4 rounded-2xl border border-ink-200/60 text-xs text-ink-700">
            <div>
              <span className="text-[8px] font-black text-ink-400 uppercase tracking-widest block mb-0.5">Paciente</span>
              <p className="font-bold text-ink-900">{appointment.patientName}</p>
            </div>
            <div>
              <span className="text-[8px] font-black text-ink-400 uppercase tracking-widest block mb-0.5">Exame / Procedimento</span>
              <p className="font-bold text-ink-900">{appointment.examType}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[8px] font-black text-ink-400 uppercase tracking-widest block mb-0.5">Horário</span>
                <p className="font-bold text-ink-900">{appTime}</p>
              </div>
              <div>
                <span className="text-[8px] font-black text-ink-400 uppercase tracking-widest block mb-0.5">Data</span>
                <p className="font-bold text-ink-900">{appDateStr}</p>
              </div>
            </div>
          </div>

          {dicomDevices && dicomDevices.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-ink-550 uppercase tracking-widest block ml-0.5">Dispositivo PACS</label>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full h-11 px-3 bg-ink-50 border border-ink-200 rounded-xl font-bold text-xs text-ink-900 focus:border-ink-400 outline-none cursor-pointer"
              >
                {dicomDevices.map(device => (
                  <option key={device.id} value={device.id}>{device.name} ({device.aeTitle})</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="auto-redirect"
              checked={autoRedirect}
              onChange={(e) => setAutoRedirect(e.target.checked)}
              className="w-4 h-4 rounded text-ink-900 focus:ring-ink-900/20 cursor-pointer"
            />
            <label htmlFor="auto-redirect" className="text-xs font-semibold text-ink-700 select-none cursor-pointer">
              Iniciar laudo imediatamente após confirmar
            </label>
          </div>
        </div>

        <div className="px-6 py-4 bg-ink-50 border-t border-ink-100 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-ink-200 hover:bg-ink-100 text-ink-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Confirmar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
