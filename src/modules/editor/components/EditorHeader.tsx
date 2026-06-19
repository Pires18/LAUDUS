import {
  ChevronLeft, CheckCircle2, Settings, Play, ScanSearch, Edit2,
  Wifi, WifiOff, Loader2, ExternalLink, FileText, Save, AlertCircle
} from 'lucide-react';
import { Patient, ExamRequest, Clinic, ExamStatus, EXAM_AREAS } from '../../../types';
import { calculateAge, formatDate, classNames } from '../../../utils/format';
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
  hasDicomImages?: boolean;
  onToggleViewer?: () => void;
  viewerOpen?: boolean;
  onEditPatient?: () => void;
  // New PACS status props
  dicomStatus?: 'idle' | 'searching' | 'found' | 'not-found' | 'error' | 'connecting-backup';
  activeServer?: 'primary' | 'backup' | null;
  lastErrorMessage?: string | null;
  // Google Docs
  googleDocUrl?: string | null;
  // Save state
  saveState?: 'idle' | 'saving' | 'saved' | 'error';
}

export function EditorHeader({
  exam,
  patient,
  clinic,
  onBack,
  onStatusChange,
  onUnlock,
  onOpenAnamnesisConsent,
  hasDicomImages = false,
  onToggleViewer,
  viewerOpen = false,
  onEditPatient,
  dicomStatus,
  activeServer,
  lastErrorMessage,
  googleDocUrl,
  saveState = 'idle',
}: EditorHeaderProps) {
  const { settings } = useApp();
  const area = EXAM_AREAS.find(a => a.id === exam.area);
  const age = calculateAge(patient.birthDate || '', exam.createdAt);

  const isFinalizado = exam.status === 'finalizado';

  return (
    <header className="h-[68px] bg-white border-b border-ink-200 flex items-center justify-between px-4 sm:px-6 shrink-0 sticky top-0 z-[100] shadow-sm">
      
      {/* ── Left: Back + Patient Info ── */}
      <div className="flex items-center gap-3 min-w-0">
        
        {/* Back button */}
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-ink-50 border border-ink-200 text-ink-500 hover:text-ink-900 hover:bg-ink-100 transition-all group shrink-0"
          title="Voltar à Worklist"
        >
          <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-ink-200 shrink-0 hidden sm:block" />

        {/* Area icon + patient block */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={classNames(
            "w-9 h-9 rounded-xl flex items-center justify-center shadow-sm shrink-0 text-white",
            area?.color || 'bg-brand-600'
          )}>
            <AreaIcon area={exam.area} size={18} />
          </div>

          <div className="min-w-0 space-y-0.5">
            {/* Patient name + age + status */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-sm font-black text-ink-900 uppercase tracking-tight truncate max-w-[110px] xs:max-w-[160px] sm:max-w-[220px] md:max-w-[320px] lg:max-w-none">
                {patient.name}
              </h1>
              {onEditPatient && (
                <button
                  onClick={onEditPatient}
                  className="p-1 rounded-md text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                  title="Editar dados do paciente"
                >
                  <Edit2 size={12} />
                </button>
              )}
              {patient.birthDate && (
                <span className="text-[9px] font-bold text-ink-500 bg-ink-50 border border-ink-200 px-1.5 py-0.5 rounded-md shrink-0 hidden xs:inline">
                  Data de Nasc: {formatDate(patient.birthDate)}
                </span>
              )}
              {age && (
                <span className="text-[9px] font-bold text-ink-500 bg-ink-50 border border-ink-200 px-1.5 py-0.5 rounded-md shrink-0">
                  {age}
                </span>
              )}
              <span className={classNames(
                "text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border shrink-0 hidden sm:inline",
                isFinalizado
                  ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                  : "bg-amber-50 text-amber-600 border-amber-200"
              )}>
                {exam.status}
              </span>
            </div>
            
            {/* Exam type + date */}
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="font-bold text-ink-500 uppercase tracking-wider truncate max-w-[160px]">
                {exam.examType}
              </span>
              {exam.friendlyId && (
                <>
                  <span className="text-ink-300">·</span>
                  <span className="font-mono font-bold text-ink-400 text-[9px]">#{exam.friendlyId}</span>
                </>
              )}
              {clinic && (
                <>
                  <span className="text-ink-300">·</span>
                  <span className="font-semibold text-ink-500 truncate max-w-[80px] hidden lg:inline">{clinic.name}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Actions ── */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

        {/* Cloud sync + PACS status indicators */}
        <div className="hidden xl:flex items-center gap-3 px-3 mr-1 border-r border-ink-200">
          {/* Realtime Firestore */}
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[8px] font-black text-ink-400 uppercase tracking-widest">Sync</span>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[9px] font-bold text-ink-500">Realtime</span>
            </div>
          </div>

          {/* Save state indicator */}
          {saveState !== 'idle' && (
            <div className="flex flex-col items-end gap-0.5" title={
              saveState === 'saving' ? 'Salvando...' :
              saveState === 'saved' ? 'Salvo com sucesso' :
              saveState === 'error' ? 'Erro ao salvar' : ''
            }>
              <span className="text-[8px] font-black text-ink-400 uppercase tracking-widest">Laudo</span>
              <div className="flex items-center gap-1">
                {saveState === 'saving' && (
                  <>
                    <Loader2 size={9} className="animate-spin text-amber-500" />
                    <span className="text-[9px] font-bold text-amber-500">Salvando</span>
                  </>
                )}
                {saveState === 'saved' && (
                  <>
                    <CheckCircle2 size={9} className="text-emerald-500" />
                    <span className="text-[9px] font-bold text-emerald-600">Salvo</span>
                  </>
                )}
                {saveState === 'error' && (
                  <>
                    <AlertCircle size={9} className="text-red-500" />
                    <span className="text-[9px] font-bold text-red-500">Erro</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* PACS Status micro-indicator */}
          {settings.dicomSyncEnabled !== false && (
            <div className="flex flex-col items-end gap-0.5" title={lastErrorMessage || (dicomStatus === 'found' ? `PACS ${activeServer || ''} — Imagens encontradas` : 'PACS')}>
              <span className="text-[8px] font-black text-ink-400 uppercase tracking-widest">PACS</span>
              <div className="flex items-center gap-1">
                {dicomStatus === 'searching' || dicomStatus === 'connecting-backup' ? (
                  <Loader2 size={9} className="animate-spin text-amber-500" />
                ) : dicomStatus === 'found' ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ) : dicomStatus === 'error' ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-ink-300" />
                )}
                <span className={classNames(
                  "text-[9px] font-bold",
                  dicomStatus === 'found' ? 'text-emerald-600' : dicomStatus === 'error' ? 'text-red-500' : 'text-ink-400'
                )}>
                  {dicomStatus === 'searching' ? 'Buscando...' : dicomStatus === 'found' ? (activeServer === 'backup' ? 'Backup' : 'Online') : dicomStatus === 'error' ? 'Erro' : dicomStatus === 'not-found' ? 'Sem img.' : 'Off'}
                </span>
              </div>
            </div>
          )}

          {/* Google Docs quick link */}
          {googleDocUrl && (
            <a
              href={googleDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-end gap-0.5 hover:opacity-80 transition-opacity"
              title="Abrir Google Doc do laudo"
            >
              <span className="text-[8px] font-black text-ink-400 uppercase tracking-widest">G.Doc</span>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-[9px] font-bold text-blue-600">Abrir</span>
              </div>
            </a>
          )}
        </div>

        {/* DICOM viewer toggle — only when enabled */}
        {settings.dicomSyncEnabled !== false && (
          hasDicomImages ? (
            <button
              onClick={onToggleViewer}
              className={classNames(
                "h-9 w-9 md:w-auto md:px-3.5 rounded-xl transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest shrink-0 border",
                viewerOpen
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
              )}
              title="Visualizador de Imagens DICOM"
            >
              <Play size={14} />
              <span className="hidden md:inline">Imagens</span>
            </button>
          ) : (
            <button
              disabled
              className="h-9 w-9 md:w-auto md:px-3.5 rounded-xl bg-ink-50 text-ink-400 border border-ink-200 opacity-60 cursor-not-allowed flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest shrink-0"
              title="Nenhuma imagem disponível neste exame"
            >
              <ScanSearch size={14} />
              <span className="hidden md:inline">Imagens</span>
            </button>
          )
        )}

        {/* Ficha & Config */}
        <button
          onClick={onOpenAnamnesisConsent}
          className="h-9 w-9 md:w-auto md:px-3.5 rounded-xl bg-white text-ink-600 hover:text-ink-900 hover:bg-ink-50 border border-ink-200 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest shrink-0"
          title="Ficha do Exame, Anamnese e Configurações"
        >
          <Settings size={14} />
          <span className="hidden md:inline">Ficha & Config</span>
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-ink-200 shrink-0" />

        {/* Finalizar / Status */}
        {isFinalizado ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-emerald-50 border border-emerald-200">
              <CheckCircle2 size={13} className="text-emerald-600" />
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest hidden xs:inline">Finalizado</span>
            </div>
            <button
              onClick={onUnlock}
              className="h-9 px-3 rounded-xl bg-white text-ink-500 hover:text-ink-800 hover:bg-ink-50 transition-all font-black text-[10px] uppercase tracking-widest shrink-0 border border-ink-200 shadow-sm"
            >
              Unlock
            </button>
          </div>
        ) : (
          <button
            onClick={() => onStatusChange('finalizado')}
            className="h-9 px-4 md:px-5 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 shadow-sm transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95"
          >
            <CheckCircle2 size={14} className="shrink-0" />
            <span className="hidden md:inline">Finalizar Laudo</span>
            <span className="md:hidden">Finalizar</span>
          </button>
        )}
      </div>
    </header>
  );
}
