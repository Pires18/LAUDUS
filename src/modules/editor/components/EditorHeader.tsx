import { 
  ChevronLeft, CheckCircle2, Settings, User, Activity, Info, ClipboardList, Play, Image
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
  onOpenAnamnesisConsent: () => void;
  onOpenDicomImages: () => void;
  hasDicomImages?: boolean;
  onToggleViewer?: () => void;
  viewerOpen?: boolean;
}

export function EditorHeader({
  exam,
  patient,
  clinic,
  onBack,
  onStatusChange,
  onUnlock,
  onOpenAnamnesisConsent,
  onOpenDicomImages,
  hasDicomImages = false,
  onToggleViewer,
  viewerOpen = false
}: EditorHeaderProps) {
  const { settings } = useApp();
  const area = EXAM_AREAS.find(a => a.id === exam.area);
  const age = calculateAge(patient.birthDate || '');
  const baseUrl = settings.dicomViewerUrl || 'http://localhost:8042';
  const studyUid = `1.2.276.0.7230010.3.1.2.${exam.id}`;
  let viewerUrl = baseUrl;

  const viewerType = settings.dicomViewerType || 'stone';
  if (viewerType === 'stone') {
    viewerUrl = `${baseUrl.replace(/\/$/, '')}/stone-webviewer/index.html?study=${studyUid}`;
  } else if (viewerType === 'oe2') {
    viewerUrl = `${baseUrl.replace(/\/$/, '')}/ui/app/retrieve-and-view.html?StudyInstanceUID=${studyUid}`;
  } else if (viewerType === 'ohif') {
    viewerUrl = `${baseUrl.replace(/\/$/, '')}/viewer?StudyInstanceUIDs=${studyUid}`;
  } else if (viewerType === 'custom' && settings.dicomViewerUrlPattern) {
    viewerUrl = settings.dicomViewerUrlPattern
      .replace('{{baseUrl}}', baseUrl.replace(/\/$/, ''))
      .replace('{{StudyInstanceUID}}', studyUid)
      .replace('{{examId}}', exam.id);
  } else {
    viewerUrl = `${baseUrl.replace(/\/$/, '')}/stone-webviewer/index.html?study=${studyUid}`;
  }

  return (
    <header className="h-[72px] bg-ink-900 border-b border-white/5 flex items-center justify-between px-6 shrink-0 sticky top-0 z-[100] backdrop-blur-md">
      <div className="flex items-center gap-2 sm:gap-5 min-w-0">
        <button 
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-ink-300 hover:text-white hover:bg-white/10 transition-all group shrink-0"
          title="Voltar à Worklist"
        >
          <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        </button>

        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div className={classNames(
            "w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shadow-lg transition-transform shrink-0",
            area?.color || 'bg-brand-500'
          )}>
            <AreaIcon area={exam.area} size={24} className="text-white" />
          </div>
          
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <h1 className="text-sm sm:text-base font-black text-white tracking-tight uppercase max-w-[100px] xs:max-w-[140px] sm:max-w-[240px] truncate">
                {patient.name}
              </h1>
              <div className="hidden xs:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 shrink-0">
                <User size={10} className="text-brand-400" />
                <span className="text-[9px] font-black text-ink-200 uppercase tracking-widest">
                  {age ? `${age} anos` : 'Idade N/I'}
                </span>
              </div>
              <span className={classNames(
                "text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border shrink-0 hidden sm:inline",
                exam.status === 'finalizado' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-brand-500/20 text-brand-400 border-brand-500/30"
              )}>
                {exam.status}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-[10px] font-semibold text-ink-300">
              <span className="text-ink-400 uppercase font-black text-[9px] tracking-wider">{exam.examType}</span>
              <span className="text-ink-500">•</span>
              <span>{formatDateTime(exam.createdAt)}</span>
              {exam.clinicalIndication && (
                <>
                  <span className="text-ink-500">•</span>
                  <span className="text-ink-500 italic lowercase tracking-normal">
                    {exam.clinicalIndication}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <div className="hidden xl:flex flex-col items-end gap-0.5 px-4 border-r border-white/5 mr-2">
           <span className="text-[9px] font-black text-ink-400 uppercase tracking-widest">Sincronização Cloud</span>
           <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-[10px] font-bold text-ink-200">Database Realtime</span>
           </div>
        </div>

        {settings.dicomSyncEnabled !== false && (
          <>
            {hasDicomImages ? (
              <button
                onClick={onToggleViewer}
                className={classNames(
                  "h-10 w-10 md:w-auto md:px-4 rounded-xl transition-all flex items-center justify-center md:justify-start gap-2 font-black text-[10px] uppercase tracking-widest shrink-0 border",
                  viewerOpen 
                    ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20" 
                    : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20"
                )}
                title="Visualizador de Imagens Integrado"
              >
                <Play size={16} />
                <span className="hidden md:inline">Ver Imagens</span>
              </button>
            ) : (
              <button
                disabled
                className="h-10 w-10 md:w-auto md:px-4 rounded-xl bg-white/5 text-ink-500 border border-white/5 opacity-40 cursor-not-allowed flex items-center justify-center md:justify-start gap-2 font-black text-[10px] uppercase tracking-widest shrink-0"
                title="Nenhuma imagem disponível no PACS para este exame"
              >
                <Play size={16} />
                <span className="hidden md:inline">Ver Imagens</span>
              </button>
            )}
            <button
              onClick={onOpenDicomImages}
              disabled={!hasDicomImages}
              className={classNames(
                "h-10 w-10 md:w-auto md:px-4 rounded-xl border transition-all flex items-center justify-center md:justify-start gap-2 font-black text-[10px] uppercase tracking-widest shrink-0",
                hasDicomImages 
                  ? "bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 border-brand-500/20"
                  : "bg-white/5 text-ink-500 border-white/5 opacity-40 cursor-not-allowed"
              )}
              title={hasDicomImages ? "Salvar ou Imprimir Imagens do Exame (PACS)" : "Nenhuma imagem disponível no PACS para este exame"}
            >
              <Image size={16} />
              <span className="hidden md:inline">PDF de Imagens</span>
            </button>
          </>
        )}

        <button
          onClick={onOpenAnamnesisConsent}
          className="h-10 w-10 md:w-auto md:px-4 rounded-xl bg-white/5 text-ink-200 hover:text-white hover:bg-white/10 border border-white/5 transition-all flex items-center justify-center md:justify-start gap-2 font-black text-[10px] uppercase tracking-widest shrink-0"
          title="Ficha, Anamnese & Configurações"
        >
          <Settings size={16} />
          <span className="hidden md:inline">Ficha & Config</span>
        </button>

        {exam.status === 'finalizado' ? (
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center justify-center gap-2 px-2.5 sm:px-4 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
               <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
               <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest hidden xs:inline">Finalizado</span>
            </div>
            <button
              onClick={onUnlock}
              className="h-10 px-3 sm:px-4 rounded-xl bg-white/5 text-ink-300 hover:text-white hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest shrink-0"
            >
              Unlock
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onStatusChange('finalizado')}
              className="h-10 px-3 md:px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-black text-[10px] uppercase tracking-widest hover:from-emerald-500 hover:to-emerald-600 shadow-lg shadow-emerald-900/40 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} className="shrink-0" />
              <span className="hidden md:inline">Finalizar Laudo</span>
              <span className="md:hidden">Finalizar</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
