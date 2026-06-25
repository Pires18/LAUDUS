import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../store/app';
import { useCollection } from '../hooks/useFirestore';
import { addItemWithId, genId } from '../store/db';
import { Patient, ReportTemplate, Clinic, ExamRequest, EXAM_AREAS, ExamArea } from '../types';
import { 
  X, Search, UserPlus, ArrowRight, Loader2, Sparkles, 
  ChevronRight
} from 'lucide-react';
import { classNames } from '../utils/format';
import { generateNumericId } from '../store/db';
import { getInitialReportContent } from '../modules/templates/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaIcon } from './AreaIcon';
import { syncExamToOrthancWorklist } from '../utils/dicom';
import { logger } from '../utils/logger';

interface CreateExamModalProps {
  onClose: () => void;
}

export function CreateExamModal({ onClose }: CreateExamModalProps) {
  const { setView, selectedClinicId, showToast, createExamDefaultPatient, setCreateExamDefaultPatient, settings } = useApp();
  const { data: patients } = useCollection<Patient>('patients');
  const { data: templates } = useCollection<ReportTemplate>('templates');
  const { data: clinics } = useCollection<Clinic>('clinics');

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [showQuickPatient, setShowQuickPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientBirthDate, setNewPatientBirthDate] = useState('');
  const [newPatientGender, setNewPatientGender] = useState<'M' | 'F' | 'O'>('F');

  const [selectedArea, setSelectedArea] = useState<ExamArea | 'todas'>('todas');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);

  const [hoveredTemplate, setHoveredTemplate] = useState<ReportTemplate | null>(null);
  const [anamnesis, setAnamnesis] = useState('');
  const [anamnesisFromTemplate, setAnamnesisFromTemplate] = useState(false);
  const [examDateStr, setExamDateStr] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(settings.dicomDevices?.[0]?.id || '');

  // Configura clínica inicial
  useEffect(() => {
    if (clinics.length > 0 && !selectedClinic) {
      const initial = clinics.find(c => c.id === selectedClinicId) || clinics[0];
      setSelectedClinic(initial);
    }
  }, [clinics, selectedClinicId, selectedClinic]);

  // Pré-preenche anamnese com o template selecionado
  useEffect(() => {
    if (selectedTemplate?.anamnesisTemplate) {
      setAnamnesis(selectedTemplate.anamnesisTemplate);
      setAnamnesisFromTemplate(true);
    } else {
      setAnamnesisFromTemplate(false);
    }
  }, [selectedTemplate]);

  // Define paciente padrão vindo do contexto
  useEffect(() => {
    if (createExamDefaultPatient) {
      setSelectedPatient(createExamDefaultPatient);
    }
  }, [createExamDefaultPatient]);

  // Cleanup do paciente ao fechar o modal
  useEffect(() => {
    return () => {
      setCreateExamDefaultPatient(null);
    };
  }, [setCreateExamDefaultPatient]);

  const filteredPatients = useMemo(() => {
    if (!patientSearch) return patients.slice(0, 5);
    const s = patientSearch.toLowerCase();
    return patients.filter(p => 
      p.name.toLowerCase().includes(s) || 
      p.id.toLowerCase().includes(s)
    ).slice(0, 8);
  }, [patients, patientSearch]);

  const hasExactMatch = useMemo(() => {
    if (!patientSearch.trim()) return true;
    const s = patientSearch.trim().toLowerCase();
    return patients.some(p => p.name.toLowerCase() === s);
  }, [patients, patientSearch]);

  // Auto-open quick patient registration when search has no matches
  useEffect(() => {
    if (patientSearch.trim() && filteredPatients.length === 0 && !selectedPatient && !showQuickPatient) {
      setNewPatientName(patientSearch.trim());
      setShowQuickPatient(true);
    }
  }, [patientSearch, filteredPatients, selectedPatient, showQuickPatient]);

  const handleToggleQuickPatient = () => {
    if (showQuickPatient) {
      setShowQuickPatient(false);
      setPatientSearch('');
      setNewPatientName('');
      setNewPatientBirthDate('');
      setNewPatientGender('F');
    } else {
      setShowQuickPatient(true);
      setNewPatientName(patientSearch.trim());
    }
  };

  const filteredTemplates = useMemo(() => {
    let list = templates;
    if (selectedArea && selectedArea !== 'todas') {
      list = list.filter(t => t.area === selectedArea);
    }
    if (templateSearch) {
      const s = templateSearch.toLowerCase();
      list = list.filter(t => 
        t.name.toLowerCase().includes(s)
      );
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [templates, templateSearch, selectedArea]);

  const handleQuickPatient = async () => {
    if (!newPatientName.trim()) return;
    setLoading(true);
    try {
      const patientId = `P-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const newP: Omit<Patient, 'id'> & { id: string } = {
        id: patientId,
        name: newPatientName.trim(),
        birthDate: newPatientBirthDate || undefined,
        gender: newPatientGender,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await addItemWithId('patients', patientId, newP);
      setSelectedPatient(newP as Patient);
      setShowQuickPatient(false);
      setNewPatientName('');
      setNewPatientBirthDate('');
      setNewPatientGender('F');
      showToast('Paciente registrado com sucesso!');
    } catch (err) {
      showToast('Erro ao criar paciente', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDirect = async (template: ReportTemplate) => {
    if (!selectedPatient) return;
    setLoading(true);
    try {
      const examData: Partial<ExamRequest> = {
        friendlyId: generateNumericId(),
        patientId: selectedPatient.id,
        clinicId: selectedPatient.id === 'ANONIMO' ? '' : (selectedClinic?.id || clinics[0]?.id),
        area: template.area,
        examType: template.name,
        templateId: template.id,
        status: 'pendente',
        reportContent: getInitialReportContent(template),
        anamnesis: anamnesis.trim() || undefined,
        consentTerm: template.consentTemplate || undefined,
        consentAccepted: false,
        clinicalIndication: anamnesis.trim() || undefined,
        examDate: examDateStr ? (() => {
          const [year, month, day] = examDateStr.split('-').map(Number);
          return new Date(year, month - 1, day).getTime();
        })() : Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const id = genId('exams');
      await addItemWithId('exams', id, examData);

      // Sincronização local com a Worklist do Orthanc
      const { success, backupSuccess, error } = await syncExamToOrthancWorklist(
        id,
        template.name,
        { id: selectedPatient.id, name: selectedPatient.name, birthDate: selectedPatient.birthDate, gender: selectedPatient.gender },
        settings,
        selectedDeviceId,
        examData.examDate
      );
      
      if (!success) {
        logger.warn('[Orthanc Sync] Falha ao enviar para o worklist local:', error);
        showToast(`PACS: falha ao criar worklist — ${error || 'verifique o agente local e o Python/pydicom'}`, 'error');
      } else if (backupSuccess === false) {
        logger.warn('[Orthanc Sync] Falha ao enviar para o backup do worklist');
        showToast('PACS: worklist principal criada, mas falhou no backup', 'error');
      }

      // Tocar som de sucesso
      if (settings.soundNotifications !== false) {
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);
          }
        } catch (err) {}
      }

      showToast('Exame iniciado!');
      setCreateExamDefaultPatient(null);
      setView({ name: 'exam-editor', examId: id });
      onClose();
    } catch (error) {
      logger.error('Erro ao criar exame:', error);
      showToast('Erro ao criar exame', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div 
        initial={{ scale: 0.96, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90dvh] relative modal-mobile-sheet"
      >
        
        {/* Compact Header */}
        <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between bg-white z-10 relative">
          <div className="flex items-center gap-3 relative z-10">
            <div className="relative w-9 h-9 rounded-xl bg-ink-900 text-white flex items-center justify-center shadow-sm shrink-0">
              <Sparkles size={16} className="animate-pulse relative z-10" />
            </div>
            <div>
              <h2 className="text-base font-black text-ink-900 leading-tight">Novo Laudo LAUD.IA</h2>
              <p className="text-[9px] text-ink-500 font-bold uppercase tracking-widest mt-0.5">Fluxo assistido por IA</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setCreateExamDefaultPatient(null);
              onClose();
            }} 
            className="p-1.5 hover:bg-ink-100 rounded-xl text-ink-400 hover:text-ink-700 transition-all active:scale-95 relative z-10"
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress Bar with Steps */}
        <div className="bg-ink-50/80 backdrop-blur-sm px-6 py-3 flex items-center justify-between border-b border-ink-150 z-10 shrink-0 shadow-[inset_0_-1px_2px_rgba(0,0,0,0.02)]">
           <div className="flex items-center gap-2.5">
             {[
               { step: 1, label: 'Identificação' },
               { step: 2, label: 'Máscara' },
               { step: 3, label: 'Anamnese' }
             ].map((s, idx) => {
               const isActive = step === s.step;
               const isPast = step > s.step;
               return (
                 <div key={s.step} className="flex items-center gap-2.5">
                    <div className="flex items-center gap-2 relative">
                      <motion.div 
                        initial={false}
                        animate={{ 
                          backgroundColor: isActive || isPast ? 'rgb(79, 70, 229)' : 'rgb(241, 245, 249)',
                          color: isActive || isPast ? 'white' : 'rgb(148, 163, 184)',
                          scale: isActive ? 1.1 : 1
                        }}
                        className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black shadow-sm z-10"
                      >
                        {s.step}
                      </motion.div>
                      <span className={classNames(
                        "text-[9px] font-black uppercase tracking-wider transition-colors duration-300",
                        isActive ? "text-brand-700" : isPast ? "text-ink-900" : "text-ink-400"
                      )}>{s.label}</span>
                    </div>
                    {idx < 2 && (
                      <div className="w-6 h-1 rounded-full bg-ink-100 overflow-hidden shrink-0">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: isPast ? '100%' : '0%' }}
                          transition={{ duration: 0.3 }}
                          className="h-full bg-brand-500"
                        />
                      </div>
                    )}
                 </div>
               );
             })}
           </div>
           <AnimatePresence>
             {selectedPatient && (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.9 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 0.9 }}
                 className="hidden xs:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-brand-50 to-indigo-50 border border-brand-200/50 text-[9px] font-black text-brand-700 uppercase tracking-widest truncate max-w-[160px] shadow-sm"
               >
                 {selectedPatient.name}
               </motion.div>
             )}
           </AnimatePresence>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 z-10 custom-scrollbar">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="space-y-5"
              >
                {selectedPatient ? (
                  /* Patient Selected: Show Card & Clinical Indication Form */
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center gap-4 bg-ink-50 p-4 sm:p-5 rounded-2xl border border-ink-200 shadow-sm relative overflow-hidden group">
                       <div className="w-12 h-12 rounded-[1rem] bg-white border border-ink-200 text-ink-700 flex items-center justify-center font-black text-xl shrink-0 relative z-10">
                          {selectedPatient.name.charAt(0)}
                       </div>
                       <div className="flex-1 min-w-0 relative z-10">
                          <p className="text-[9px] font-black text-ink-500 uppercase tracking-widest leading-none mb-1.5 flex items-center gap-1">
                            <Sparkles size={10} /> Paciente Confirmado
                          </p>
                          <h4 className="text-base font-black text-ink-900 truncate leading-tight">{selectedPatient.name}</h4>
                          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-wider mt-1">
                            ID: {selectedPatient.id} {selectedPatient.birthDate && <span className="text-ink-500 font-black px-1">• {selectedPatient.birthDate}</span>}
                          </p>
                       </div>
                       <button 
                         onClick={() => {
                           setSelectedPatient(null);
                           setCreateExamDefaultPatient(null);
                         }}
                         className="p-3 bg-white text-ink-400 hover:text-rose-500 rounded-xl transition-all border border-ink-200 hover:border-rose-200 hover:bg-rose-50 shadow-sm shrink-0 relative z-10 hover:rotate-180 duration-500"
                         title="Trocar Paciente"
                       >
                         <RotateCcw size={16} />
                       </button>
                    </div>

                    <div className="space-y-4">
                      {clinics.length > 1 && (
                        <div>
                          <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest ml-1 mb-1.5 block">Unidade de Atendimento</label>
                          <select
                            value={selectedClinic?.id || ''}
                            onChange={(e) => {
                              const c = clinics.find(x => x.id === e.target.value);
                              if (c) setSelectedClinic(c);
                            }}
                            className="w-full h-11 px-3 bg-ink-50 border-2 border-ink-100 rounded-xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-bold text-xs text-ink-900"
                          >
                            {clinics.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* No Patient Selected: Show search or quick register */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <div className="space-y-0.5">
                          <h3 className="font-black text-ink-900 text-sm">Quem é o paciente?</h3>
                          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-wider">Busque no banco ou crie um registro rápido</p>
                       </div>
                       <button 
                        onClick={handleToggleQuickPatient}
                        className="px-3 py-1.5 rounded-xl bg-ink-900 text-white font-bold text-[9px] uppercase tracking-widest hover:bg-ink-800 transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        {showQuickPatient ? <ArrowRight size={12} className="rotate-180" /> : <UserPlus size={12} />}
                        {showQuickPatient ? 'Voltar' : 'Registrar Rápido'}
                      </button>
                    </div>
                    
                    {showQuickPatient ? (
                      <div className="space-y-4 p-5 rounded-[1.5rem] bg-ink-50 border border-ink-200 shadow-sm animate-in zoom-in-95 duration-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2">
                            <label className="text-[9px] font-black text-ink-700 uppercase tracking-widest ml-1 mb-1.5 block">Nome do Paciente *</label>
                            <input
                              type="text"
                              placeholder="Ex: Maria Oliveira Santos"
                              className="w-full h-12 px-4 bg-white border border-ink-200 rounded-xl focus:ring-2 focus:ring-ink-900/10 focus:border-ink-400 outline-none transition-all font-bold text-xs text-ink-900 shadow-sm"
                              value={newPatientName}
                              onChange={(e) => setNewPatientName(e.target.value)}
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-ink-700 uppercase tracking-widest ml-1 mb-1.5 block">Nascimento (Opcional)</label>
                            <input
                              type="date"
                              className="w-full h-12 px-4 bg-white border border-ink-200 rounded-xl focus:ring-2 focus:ring-ink-900/10 focus:border-ink-400 outline-none transition-all font-bold text-xs text-ink-900 shadow-sm"
                              value={newPatientBirthDate}
                              onChange={(e) => setNewPatientBirthDate(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-ink-700 uppercase tracking-widest ml-1 mb-1.5 block">Sexo</label>
                            <select
                              className="w-full h-12 px-4 bg-white border border-ink-200 rounded-xl focus:ring-2 focus:ring-ink-900/10 focus:border-ink-400 outline-none transition-all font-bold text-xs text-ink-900 shadow-sm appearance-none cursor-pointer"
                              value={newPatientGender}
                              onChange={(e) => setNewPatientGender(e.target.value as 'M' | 'F' | 'O')}
                            >
                              <option value="F">Feminino</option>
                              <option value="M">Masculino</option>
                              <option value="O">Outro</option>
                            </select>
                          </div>
                        </div>
                        <button
                          onClick={handleQuickPatient}
                          disabled={!newPatientName.trim() || loading}
                          className="w-full h-12 bg-ink-900 hover:bg-ink-800 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95 group"
                        >
                          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} className="group-hover:scale-110 transition-transform" />}
                          Registrar e Continuar
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="relative group">
                          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 group-focus-within:text-ink-900 transition-colors" />
                          <input
                            placeholder="Buscar paciente por nome, ID ou nascimento..."
                            className="w-full h-14 pl-12 pr-4 bg-ink-50 border-2 border-ink-200 rounded-2xl focus:ring-2 focus:ring-ink-900/10 focus:border-ink-400 focus:bg-white outline-none transition-all font-bold text-sm text-ink-900 shadow-sm"
                            value={patientSearch}
                            onChange={(e) => setPatientSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && patients.length > 0) {
                                setSelectedPatient(patients.filter(p => p.name.toLowerCase().includes(patientSearch.toLowerCase()) || p.id.includes(patientSearch))[0]);
                                setStep(2);
                              }
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-end mt-2">
                           <button
                             type="button"
                             onClick={() => {
                               setSelectedPatient({
                                 id: 'ANONIMO',
                                 name: 'Laudo Avulso / Sem Identificação',
                                 gender: 'O',
                                 createdAt: Date.now(),
                                 updatedAt: Date.now()
                               });
                               setSelectedClinic(null);
                               setStep(2);
                             }}
                             className="text-[10px] font-bold text-ink-400 hover:text-ink-700 uppercase tracking-widest transition-colors flex items-center gap-1.5"
                           >
                             Pular Identificação (Laudo Avulso)
                             <ArrowRight size={12} />
                           </button>
                        </div>

                        <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1.5 custom-scrollbar">
                          {filteredPatients.map(p => (
                            <button
                              key={p.id}
                              onClick={() => { setSelectedPatient(p); setPatientSearch(''); }}
                              className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-ink-200 hover:border-ink-400 hover:bg-ink-50 transition-all group shadow-sm"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                 <div className="w-8 h-8 rounded-lg bg-ink-100 text-ink-600 flex items-center justify-center font-black text-sm shrink-0 group-hover:bg-ink-900 group-hover:text-white transition-all">
                                    {p.name.charAt(0)}
                                 </div>
                                 <div className="text-left min-w-0">
                                    <p className="font-bold text-ink-900 text-xs truncate group-hover:text-ink-700 transition-colors">{p.name}</p>
                                    <p className="text-[8px] text-ink-400 font-mono font-bold mt-0.5 truncate">{p.id} {p.birthDate ? `• ${p.birthDate}` : ''}</p>
                                 </div>
                              </div>
                              <div className="w-8 h-8 rounded-lg bg-ink-50 text-ink-400 flex items-center justify-center group-hover:bg-ink-200 group-hover:text-ink-900 transition-all shrink-0">
                                <ChevronRight size={14} />
                              </div>
                            </button>
                          ))}
                          {patientSearch.trim() && !hasExactMatch && (
                            <button
                              type="button"
                              onClick={() => {
                                setNewPatientName(patientSearch.trim());
                                setShowQuickPatient(true);
                              }}
                              className="w-full flex items-center justify-between p-3 rounded-xl bg-ink-50 border border-dashed border-ink-300 hover:border-ink-400 hover:bg-ink-100 transition-all group shadow-sm text-ink-700 font-bold"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                 <div className="w-8 h-8 rounded-lg bg-ink-200 text-ink-600 flex items-center justify-center font-black text-sm shrink-0 group-hover:bg-ink-900 group-hover:text-white transition-all">
                                    <UserPlus size={14} />
                                 </div>
                                 <div className="text-left min-w-0">
                                    <p className="font-bold text-xs text-ink-700 truncate">Cadastrar "{patientSearch.trim()}" como novo paciente</p>
                                    <p className="text-[8px] text-ink-500 font-bold mt-0.5 uppercase tracking-wider">Criar registro rápido no banco</p>
                                 </div>
                              </div>
                              <div className="w-8 h-8 rounded-lg bg-ink-200/50 text-ink-600 flex items-center justify-center group-hover:bg-ink-900 group-hover:text-white transition-all shrink-0">
                                <Sparkles size={12} />
                              </div>
                            </button>
                          )}
                          {filteredPatients.length === 0 && (
                            patientSearch.trim() ? (
                              <div className="p-5 rounded-2xl bg-ink-50 border border-ink-200 flex flex-col items-center text-center gap-3 animate-fade-in my-1">
                                <div className="w-10 h-10 rounded-xl bg-ink-200 text-ink-600 flex items-center justify-center shrink-0">
                                  <UserPlus size={18} />
                                </div>
                                <div className="space-y-0.5">
                                  <h4 className="text-xs font-black text-ink-900 uppercase">Paciente não localizado</h4>
                                  <p className="text-[10px] text-ink-500 font-medium leading-relaxed">
                                    Não encontramos nenhum cadastro para "{patientSearch}".
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewPatientName(patientSearch.trim());
                                    setShowQuickPatient(true);
                                  }}
                                  className="h-9 px-4 rounded-xl bg-ink-900 hover:bg-ink-800 text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                                >
                                  <Sparkles size={12} />
                                  Criar Cadastro Rápido
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-6 opacity-60">
                                <p className="text-xs font-bold text-ink-400">Nenhum paciente cadastrado.</p>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="space-y-4"
              >
                 {/* Specialty Pills (Horizontal Compact Row) */}
                 <div className="space-y-2 shrink-0">
                   <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest ml-1 block">Filtrar Especialidade</label>
                   <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none shrink-0 -mx-1 px-1">
                     <button
                       onClick={() => setSelectedArea('todas')}
                       className={classNames(
                         "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap border shrink-0 active:scale-95",
                         selectedArea === 'todas'
                           ? "bg-ink-900 border-ink-900 text-white shadow-sm"
                           : "bg-ink-50 border-ink-200 text-ink-500 hover:bg-ink-100 hover:text-ink-700"
                       )}
                     >
                       Todas
                     </button>
                     {EXAM_AREAS.map(area => (
                       <button
                         key={area.id}
                         onClick={() => setSelectedArea(area.id)}
                         className={classNames(
                           "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap border flex items-center gap-2 shrink-0 active:scale-95 group",
                           selectedArea === area.id
                             ? "bg-ink-900 border-ink-900 text-white shadow-sm"
                             : "bg-ink-50 border-ink-200 hover:bg-ink-100 text-ink-500 hover:text-ink-700"
                         )}
                       >
                         <AreaIcon area={area.id} size={12} className={classNames(
                           "transition-transform group-hover:scale-110",
                           selectedArea === area.id ? "text-white" : "text-ink-400"
                         )} />
                         {area.label}
                       </button>
                     ))}
                   </div>
                 </div>

                 {/* Template Search & List */}
                 <div className="space-y-3">
                    <div className="relative group">
                      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 group-focus-within:text-ink-900 transition-colors" />
                      <input
                        placeholder="Pesquisar por nome da máscara técnica..."
                        className="w-full h-14 pl-12 pr-4 bg-ink-50 border-2 border-ink-200 rounded-2xl focus:ring-2 focus:ring-ink-900/10 focus:border-ink-400 outline-none transition-all font-bold text-ink-900 text-sm shadow-sm bg-white"
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        autoFocus
                      />
                    </div>

                    <div
                      className={classNames("grid grid-cols-1 gap-2.5 max-h-[260px] overflow-y-auto pr-2 custom-scrollbar py-1", loading && "pointer-events-none opacity-60")}
                      onMouseLeave={() => setHoveredTemplate(null)}
                    >
                      {filteredTemplates.map(t => (
                        <button
                          key={t.id}
                          onMouseEnter={() => setHoveredTemplate(t)}
                          onClick={() => {
                            setSelectedTemplate(t);
                            setStep(3);
                            setTemplateSearch('');
                          }}
                          disabled={loading}
                          className={classNames(
                            "w-full flex items-center justify-between p-3.5 rounded-2xl bg-white border transition-all duration-300 group shadow-sm hover:shadow-md hover:-translate-y-0.5",
                            hoveredTemplate?.id === t.id
                              ? "border-brand-400 bg-brand-50/50 shadow-md -translate-y-0.5"
                              : "border-ink-200 hover:border-ink-400 hover:bg-ink-50"
                          )}
                        >
                          <div className="text-left flex items-center gap-4 min-w-0">
                            <div className={classNames(
                              "w-10 h-10 rounded-[0.8rem] flex items-center justify-center transition-all duration-300 shrink-0 group-hover:scale-110",
                              hoveredTemplate?.id === t.id ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-400 group-hover:bg-ink-900 group-hover:text-white"
                            )}>
                              <AreaIcon area={t.area} size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-ink-900 text-sm truncate group-hover:text-ink-700 transition-colors">{t.name}</p>
                              <p className="text-[9px] text-ink-400 font-bold uppercase tracking-wider mt-1 leading-none">{t.area}</p>
                            </div>
                          </div>
                          <div className="w-8 h-8 rounded-xl bg-transparent flex items-center justify-center text-ink-300 group-hover:text-ink-900 group-hover:bg-ink-200 transition-all shrink-0">
                             <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                          </div>
                        </button>
                      ))}
                      {filteredTemplates.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 opacity-60">
                          <Search size={32} className="text-ink-300 mb-3" />
                          <p className="text-sm font-bold text-ink-500">Nenhuma máscara encontrada.</p>
                        </div>
                      )}
                    </div>
                  </div>
              </motion.div>
            )}

            {step === 3 && selectedTemplate && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="space-y-4 animate-in fade-in duration-200"
              >
                <div className="space-y-1 bg-ink-50 p-5 rounded-[1.5rem] border border-ink-200 shadow-sm relative overflow-hidden shrink-0">
                  <p className="text-[9px] font-black text-ink-500 uppercase tracking-widest leading-none mb-2 flex items-center gap-1.5 relative z-10">
                    <Sparkles size={12} /> Procedimento Selecionado
                  </p>
                  <h4 className="text-sm font-black text-ink-900 truncate leading-tight relative z-10">{selectedTemplate.name}</h4>
                  <p className="text-[9px] text-ink-400 font-black uppercase tracking-wider mt-1 relative z-10">{selectedTemplate.area}</p>
                </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   {/* Data do Exame */}
                   <div className="flex flex-col space-y-2.5">
                     <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest ml-1 block">Data do Exame</label>
                     <input
                       type="date"
                       value={examDateStr}
                       onChange={(e) => setExamDateStr(e.target.value)}
                       className="w-full h-14 px-4 bg-white border-2 border-ink-200 rounded-2xl focus:ring-2 focus:ring-ink-900/10 focus:border-ink-400 outline-none transition-all font-bold text-sm text-ink-900 shadow-sm"
                     />
                   </div>

                   {settings.dicomDevices && settings.dicomDevices.length > 0 && (
                     <div className="flex flex-col space-y-2.5">
                       <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest ml-1 block">Enviar Worklist Para</label>
                       <div className="relative">
                         <select
                           value={selectedDeviceId}
                           onChange={(e) => setSelectedDeviceId(e.target.value)}
                           className="w-full h-14 px-4 bg-white border-2 border-ink-200 rounded-2xl focus:ring-2 focus:ring-ink-900/10 focus:border-ink-400 outline-none transition-all font-bold text-sm text-ink-900 shadow-sm appearance-none cursor-pointer"
                         >
                           {settings.dicomDevices.map(device => (
                             <option key={device.id} value={device.id}>{device.name} ({device.aeTitle})</option>
                           ))}
                         </select>
                       </div>
                     </div>
                   )}
                 </div>

                 <div className="flex flex-col space-y-2.5">
                   {/* Anamnese / Indicação Clínica */}
                   <div className="flex items-center justify-between ml-1">
                     <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest block">Anamnese / Indicação Clínica</label>
                     {anamnesisFromTemplate && (
                       <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                         Pré-preenchido pelo template
                       </span>
                     )}
                     {!anamnesisFromTemplate && selectedTemplate?.anamnesisTemplate && (
                       <button
                         type="button"
                         onClick={() => { setAnamnesis(selectedTemplate.anamnesisTemplate!); setAnamnesisFromTemplate(true); }}
                         className="text-[9px] font-black text-brand-600 hover:text-brand-700 uppercase tracking-wider transition-colors"
                       >
                         Restaurar do template
                       </button>
                     )}
                   </div>
                   <textarea
                     value={anamnesis}
                     onChange={(e) => { setAnamnesis(e.target.value); setAnamnesisFromTemplate(false); }}
                     placeholder="Ex: Dor abdominal a esclarecer. Suspeita de litíase vesicular."
                     className="w-full h-36 p-4 bg-white border-2 border-ink-200 rounded-[1rem] focus:ring-2 focus:ring-ink-900/10 focus:border-ink-400 outline-none transition-all font-medium text-sm text-ink-900 resize-none custom-scrollbar shadow-sm"
                   />
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-6 py-5 border-t border-ink-100 bg-white flex items-center justify-between z-10 shrink-0 relative">
           {step > 1 ? (
             <button 
               onClick={() => {
                 if (step === 3) {
                   setStep(2);
                 } else {
                   setStep(1);
                   setPatientSearch('');
                 }
               }}
               className="flex items-center gap-1.5 text-[10px] font-bold text-ink-400 hover:text-ink-900 uppercase tracking-widest transition-all active:scale-95 group px-2 py-1 rounded-lg hover:bg-ink-100"
             >
               <ArrowRight size={14} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
               Voltar
             </button>
           ) : (
             <div className="w-16" />
           )}
           
           <div className="flex gap-2.5">
             {[1, 2, 3].map(i => (
               <div key={i} className={classNames(
                 "h-1.5 rounded-full transition-all duration-500",
                 step === i ? "bg-ink-900 w-8 shadow-sm" : step > i ? "bg-ink-400 w-4 opacity-50" : "bg-ink-200 w-2"
               )} />
             ))}
           </div>

           {step === 1 ? (
             <button 
               onClick={() => { setStep(2); setPatientSearch(''); }}
               disabled={!selectedPatient || loading}
               className="flex items-center gap-2 px-5 h-11 rounded-xl bg-ink-900 text-white font-bold text-[10px] uppercase tracking-widest hover:bg-ink-800 disabled:opacity-50 transition-all shadow-sm active:scale-95 group"
             >
               Prosseguir
               <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
             </button>
           ) : step === 3 ? (
             <button 
               onClick={() => handleCreateDirect(selectedTemplate!)}
               disabled={loading}
               className="flex items-center gap-2 px-6 h-12 rounded-xl bg-ink-900 hover:bg-ink-800 text-white font-bold text-[10px] uppercase tracking-widest hover:shadow-md disabled:opacity-50 transition-all active:scale-95 group shadow-sm"
             >
               {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} className="group-hover:scale-110 transition-transform" />}
               Iniciar Laudo
             </button>
           ) : (
             <div className="w-24" />
           )}
        </div>
      </motion.div>
    </div>
  );
}

function RotateCcw({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
