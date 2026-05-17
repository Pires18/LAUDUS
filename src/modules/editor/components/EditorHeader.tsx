import { 
  ChevronLeft, CheckCircle2, Settings, User, Activity, Info
} from 'lucide-react';
import { Patient, ExamRequest, Clinic, ExamStatus, EXAM_AREAS } from '../../../types';
import { calculateAge, formatDateTime, classNames } from '../../../utils/format';
import { AreaIcon } from '../../../components/AreaIcon';
import { useApp } from '../../../store/app';

interface EditorHeaderProps {
  exam: ExamRequest;
  patient: Patient;
  clinic: Clinic | null;
  onBack: () => void;
  onStatusChange: (status: ExamStatus) => void;
  onUnlock: () => void;
  onEditMetadata: () => void;
}

export function EditorHeader({
  exam,
  patient,
  clinic,
  onBack,
  onStatusChange,
  onUnlock,
  onEditMetadata
}: EditorHeaderProps) {
  const area = EXAM_AREAS.find(a => a.id === exam.area);
  const age = calculateAge(patient.birthDate || '');

  return (
    <header className="h-[72px] bg-ink-900 border-b border-white/5 flex items-center justify-between px-6 shrink-0 sticky top-0 z-[100] backdrop-blur-md">
      <div className="flex items-center gap-5">
        <button 
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-ink-300 hover:text-white hover:bg-white/10 transition-all group"
          title="Voltar à Worklist"
        >
          <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        </button>

        <div className="flex items-center gap-4">
          <div className={classNames(
            "w-11 h-11 rounded-xl flex items-center justify-center shadow-lg transition-transform",
            area?.color || 'bg-brand-500'
          )}>
            <AreaIcon area={exam.area} size={24} className="text-white" />
          </div>
          
          <div className="space-y-0.5">
            <div className="flex items-center gap-3">
              <h1 className="text-base font-black text-white tracking-tight uppercase max-w-[240px] truncate">
                {patient.name}
              </h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
                <User size={10} className="text-brand-400" />
                <span className="text-[9px] font-black text-ink-200 uppercase tracking-widest">
                  {age ? `${age} anos` : 'Idade N/I'}
                </span>
              </div>
              <span className={classNames(
                "text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border",
                exam.status === 'finalizado' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-brand-500/20 text-brand-400 border-brand-500/30"
              )}>
                {exam.status}
              </span>
            </div>
            
            <div className="flex items-center gap-4 text-[9px] font-bold text-ink-400 uppercase tracking-[0.15em]">
              <div className="flex items-center gap-1.5">
                <Activity size={11} className="text-brand-500" />
                <span className="text-ink-200">{exam.examType}</span>
              </div>
              <div className="flex items-center gap-1.5 max-w-[300px] truncate">
                <Info size={11} className="text-amber-500" />
                <span className="text-ink-500 italic lowercase tracking-normal">
                  {exam.clinicalIndication || 'Indicação não informada'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden xl:flex flex-col items-end gap-0.5 px-4 border-r border-white/5 mr-2">
           <span className="text-[9px] font-black text-ink-400 uppercase tracking-widest">Sincronização Cloud</span>
           <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-[10px] font-bold text-ink-200">Database Realtime</span>
           </div>
        </div>

        <button
          onClick={onEditMetadata}
          className="h-10 px-4 rounded-xl bg-white/5 text-ink-200 hover:text-white hover:bg-white/10 border border-white/5 transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"
        >
          <Settings size={16} /> Config
        </button>

        {exam.status === 'finalizado' ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-4 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
               <CheckCircle2 size={14} className="text-emerald-400" />
               <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Finalizado</span>
            </div>
            <button
              onClick={onUnlock}
              className="h-10 px-4 rounded-xl bg-white/5 text-ink-300 hover:text-white hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest"
            >
              Unlock
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onStatusChange('finalizado')}
              className="h-10 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-black text-[10px] uppercase tracking-widest hover:from-emerald-500 hover:to-emerald-600 shadow-lg shadow-emerald-900/40 transition-all flex items-center gap-2"
            >
              <CheckCircle2 size={16} /> Finalizar Laudo
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
