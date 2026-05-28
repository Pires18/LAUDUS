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
  const [search, setSearch] = useState('');
  const [showQuickPatient, setShowQuickPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientBirthDate, setNewPatientBirthDate] = useState('');
  const [newPatientGender, setNewPatientGender] = useState<'M' | 'F' | 'O'>('F');

  const [selectedArea, setSelectedArea] = useState<ExamArea | 'todas'>('todas');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);

  const [anamnesis, setAnamnesis] = useState('');

  // Configura clínica inicial
  useEffect(() => {
    if (clinics.length > 0 && !selectedClinic) {
      const initial = clinics.find(c => c.id === selectedClinicId) || clinics[0];
      setSelectedClinic(initial);
    }
  }, [clinics, selectedClinicId, selectedClinic]);

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
    if (!search) return patients.slice(0, 5);
    const s = search.toLowerCase();
    return patients.filter(p => 
      p.name.toLowerCase().includes(s) || 
      p.id.toLowerCase().includes(s)
    ).slice(0, 8);
  }, [patients, search]);

  const hasExactMatch = useMemo(() => {
    if (!search.trim()) return true;
    const s = search.trim().toLowerCase();
    return patients.some(p => p.name.toLowerCase() === s);
  }, [patients, search]);

  // Auto-open quick patient registration when search has no matches
  useEffect(() => {
    if (search.trim() && filteredPatients.length === 0 && !selectedPatient && !showQuickPatient) {
      setNewPatientName(search.trim());
      setShowQuickPatient(true);
    }
  }, [search, filteredPatients, selectedPatient, showQuickPatient]);

  const handleToggleQuickPatient = () => {
    if (showQuickPatient) {
      setShowQuickPatient(false);
      setSearch('');
      setNewPatientName('');
      setNewPatientBirthDate('');
      setNewPatientGender('F');
    } else {
      setShowQuickPatient(true);
      setNewPatientName(search.trim());
    }
  };

  const filteredTemplates = useMemo(() => {
    let list = templates;
    if (selectedArea && selectedArea !== 'todas') {
      list = list.filter(t => t.area === selectedArea);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(t => 
        t.name.toLowerCase().includes(s)
      );
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [templates, search, selectedArea]);

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
        clinicId: selectedClinic?.id || clinics[0]?.id,
        area: template.area,
        examType: template.name,
        templateId: template.id,
        status: 'pendente',
        reportContent: getInitialReportContent(template),
        anamnesis: anamnesis.trim() || undefined,
        consentTerm: template.consentTemplate || undefined,
        consentAccepted: false,
        clinicalIndication: anamnesis.trim() || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const id = genId('exams');
      await addItemWithId('exams', id, examData);

      // Sincronização local com a Worklist do Orthanc (Mac Mini M2)
      try {
        // Formata o nome para DICOM (Mantendo ordem natural em maiúsculas sem acentos)
        const dicomName = selectedPatient.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

        // Formata data de nascimento para AAAAMMDD
        const dicomBirthDate = selectedPatient.birthDate ? selectedPatient.birthDate.replace(/[^0-9]/g, '') : '';

        // Formata data e hora atual do exame
        const now = new Date();
        const stepDate = now.getFullYear() + 
          String(now.getMonth() + 1).padStart(2, '0') + 
          String(now.getDate()).padStart(2, '0');
        const stepTime = String(now.getHours()).padStart(2, '0') + 
          String(now.getMinutes()).padStart(2, '0') + 
          String(now.getSeconds()).padStart(2, '0');

        const stepDescription = template.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

        if (settings.dicomSyncEnabled !== false) {
          await fetch('/api/worklist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              examId: id,
              patientName: dicomName,
              patientId: selectedPatient.id,
              patientBirthDate: dicomBirthDate,
              patientSex: selectedPatient.gender || 'F',
              modality: settings.dicomModalityType || 'US',
              aeTitle: settings.dicomModalityAETitle || 'MINDRAYMX7',
              stepDate,
              stepTime,
              stepDescription,
              outputDir: settings.dicomWorklistFolder
            })
          });
        }
      } catch (syncError) {
        console.warn('[Orthanc Sync] Falha ao enviar para o worklist local:', syncError);
      }

      showToast('Exame iniciado!');
      setCreateExamDefaultPatient(null);
      setView({ name: 'exam-editor', examId: id });
      onClose();
    } catch (error) {
      console.error(error);
      showToast('Erro ao criar exame', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] border border-ink-100 relative"
      >
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-brand-50 rounded-full blur-3xl -mr-24 -mt-24 opacity-40 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-50 rounded-full blur-3xl -ml-24 -mb-24 opacity-30 pointer-events-none" />

        {/* Header */}
        <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between bg-white/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-md shadow-brand-100">
              <Sparkles size={16} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-black text-ink-900 leading-tight">Novo Laudo LAUD.IA</h2>
              <p className="text-[8px] text-ink-400 font-black uppercase tracking-wider mt-0.5">Fluxo de Alta Performance</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setCreateExamDefaultPatient(null);
              onClose();
            }} 
            className="p-2 hover:bg-ink-100 rounded-xl text-ink-400 transition-all active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress Bar with Steps */}
        <div className="bg-ink-50/50 px-6 py-2 flex items-center justify-between border-b border-ink-100 z-10 shrink-0">
           <div className="flex items-center gap-2">
             {[
               { step: 1, label: 'Identificação' },
               { step: 2, label: 'Máscara' },
               { step: 3, label: 'Anamnese' }
             ].map((s, idx) => (
               <div key={s.step} className="flex items-center gap-2">
                  <div className={classNames(
                    "w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black transition-all",
                    step >= s.step ? "bg-brand-600 text-white shadow-sm" : "bg-ink-200 text-ink-500"
                  )}>
                    {s.step}
                  </div>
                  <span className={classNames(
                    "text-[9px] font-black uppercase tracking-wider",
                    step >= s.step ? "text-ink-900" : "text-ink-300"
                  )}>{s.label}</span>
                  {idx < 2 && <div className="w-4 h-px bg-ink-200 ml-1 shrink-0" />}
               </div>
             ))}
           </div>
           {selectedPatient && (
             <div className="hidden xs:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-brand-50 border border-brand-100 text-[8px] font-black text-brand-700 uppercase tracking-wider truncate max-w-[150px]">
               {selectedPatient.name}
             </div>
           )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 z-10 custom-scrollbar">
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
                    <div className="flex items-center gap-3 bg-brand-50/50 p-4 rounded-2xl border border-brand-100/60 shadow-sm relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-24 h-24 bg-brand-100/30 rounded-full blur-xl pointer-events-none" />
                       <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">
                          {selectedPatient.name.charAt(0)}
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-[8px] font-black text-brand-600 uppercase tracking-widest leading-none mb-1">Paciente Confirmado</p>
                          <h4 className="text-sm font-black text-ink-900 truncate leading-tight">{selectedPatient.name}</h4>
                          <p className="text-[9px] text-ink-400 font-bold uppercase tracking-wider mt-0.5">
                            ID: {selectedPatient.id} {selectedPatient.birthDate && `• ${selectedPatient.birthDate}`}
                          </p>
                       </div>
                       <button 
                         onClick={() => {
                           setSelectedPatient(null);
                           setCreateExamDefaultPatient(null);
                         }}
                         className="p-2 bg-white text-ink-400 hover:text-red-500 rounded-xl transition-all border border-ink-150 hover:border-red-100 hover:bg-red-50/30 shadow-sm shrink-0"
                         title="Trocar Paciente"
                       >
                         <RotateCcw size={14} />
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
                        className="px-3 py-1.5 rounded-xl bg-brand-600 text-white font-black text-[9px] uppercase tracking-widest hover:bg-brand-700 transition-all flex items-center gap-1.5 shadow-md shadow-brand-100"
                      >
                        {showQuickPatient ? <ArrowRight size={12} className="rotate-180" /> : <UserPlus size={12} />}
                        {showQuickPatient ? 'Voltar' : 'Registrar Rápido'}
                      </button>
                    </div>
                    
                    {showQuickPatient ? (
                      <div className="space-y-4 p-5 rounded-2xl bg-brand-50/40 border border-brand-100/60 border-dashed animate-in zoom-in-95 duration-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2">
                            <label className="text-[8px] font-black text-brand-700 uppercase tracking-widest ml-1 mb-1.5 block">Nome do Paciente *</label>
                            <input
                              type="text"
                              placeholder="Maria Oliveira Santos"
                              className="w-full h-11 px-3.5 bg-white border border-brand-100 rounded-xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-bold text-xs text-ink-900"
                              value={newPatientName}
                              onChange={(e) => setNewPatientName(e.target.value)}
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className="text-[8px] font-black text-brand-700 uppercase tracking-widest ml-1 mb-1.5 block">Nascimento (Opcional)</label>
                            <input
                              type="date"
                              className="w-full h-11 px-3.5 bg-white border border-brand-100 rounded-xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-bold text-xs text-ink-900"
                              value={newPatientBirthDate}
                              onChange={(e) => setNewPatientBirthDate(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[8px] font-black text-brand-700 uppercase tracking-widest ml-1 mb-1.5 block">Sexo</label>
                            <select
                              className="w-full h-11 px-3.5 bg-white border border-brand-100 rounded-xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-bold text-xs text-ink-900"
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
                          className="w-full h-11 bg-brand-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-brand-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-500/10 active:scale-95"
                        >
                          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                          Registrar e Continuar
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="relative group">
                          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 group-focus-within:text-brand-500 transition-colors" />
                          <input
                            placeholder="Buscar paciente por nome, ID ou nascimento..."
                            className="w-full h-12 pl-11 pr-4 bg-ink-50 border-2 border-ink-100 rounded-xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 focus:bg-white outline-none transition-all font-bold text-xs text-ink-900 shadow-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !hasExactMatch && search.trim()) {
                                e.preventDefault();
                                setNewPatientName(search.trim());
                                setShowQuickPatient(true);
                              }
                            }}
                            autoFocus
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1.5 custom-scrollbar">
                          {filteredPatients.map(p => (
                            <button
                              key={p.id}
                              onClick={() => { setSelectedPatient(p); setSearch(''); }}
                              className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-ink-100 hover:border-brand-500 hover:bg-brand-50/50 transition-all group shadow-sm"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                 <div className="w-8 h-8 rounded-lg bg-ink-100 text-ink-600 flex items-center justify-center font-black text-sm shrink-0 group-hover:bg-brand-600 group-hover:text-white transition-all">
                                    {p.name.charAt(0)}
                                 </div>
                                 <div className="text-left min-w-0">
                                    <p className="font-black text-ink-900 text-xs truncate group-hover:text-brand-700 transition-colors">{p.name}</p>
                                    <p className="text-[8px] text-ink-400 font-mono font-bold mt-0.5 truncate">{p.id} {p.birthDate ? `• ${p.birthDate}` : ''}</p>
                                 </div>
                              </div>
                              <div className="w-8 h-8 rounded-lg bg-ink-50 text-ink-300 flex items-center justify-center group-hover:bg-brand-100 group-hover:text-brand-600 transition-all shrink-0">
                                <ChevronRight size={14} />
                              </div>
                            </button>
                          ))}
                          {search.trim() && !hasExactMatch && (
                            <button
                              type="button"
                              onClick={() => {
                                setNewPatientName(search.trim());
                                setShowQuickPatient(true);
                              }}
                              className="w-full flex items-center justify-between p-3 rounded-xl bg-brand-50/30 border border-dashed border-brand-300 hover:border-brand-500 hover:bg-brand-50 transition-all group shadow-sm text-brand-700 font-bold"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                 <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center font-black text-sm shrink-0 group-hover:bg-brand-600 group-hover:text-white transition-all">
                                    <UserPlus size={14} />
                                 </div>
                                 <div className="text-left min-w-0">
                                    <p className="font-black text-xs text-brand-700 truncate">Cadastrar "{search.trim()}" como novo paciente</p>
                                    <p className="text-[8px] text-brand-500 font-bold mt-0.5 uppercase tracking-wider">Criar registro rápido no banco</p>
                                 </div>
                              </div>
                              <div className="w-8 h-8 rounded-lg bg-brand-100/55 text-brand-600 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-all shrink-0">
                                <Sparkles size={12} />
                              </div>
                            </button>
                          )}
                          {filteredPatients.length === 0 && (
                            search.trim() ? (
                              <div className="p-5 rounded-2xl bg-brand-50/50 border border-brand-100/50 flex flex-col items-center text-center gap-3 animate-fade-in my-1">
                                <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                                  <UserPlus size={18} />
                                </div>
                                <div className="space-y-0.5">
                                  <h4 className="text-xs font-black text-ink-900 uppercase">Paciente não localizado</h4>
                                  <p className="text-[10px] text-ink-500 font-semibold leading-relaxed">
                                    Não encontramos nenhum cadastro para "{search}".
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewPatientName(search.trim());
                                    setShowQuickPatient(true);
                                  }}
                                  className="h-9 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-md shadow-brand-100 transition-all active:scale-95"
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
                   <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none shrink-0 -mx-1 px-1">
                     <button
                       onClick={() => setSelectedArea('todas')}
                       className={classNames(
                         "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap border shrink-0",
                         selectedArea === 'todas'
                           ? "bg-brand-600 border-brand-600 text-white shadow-sm"
                           : "bg-ink-50 border-ink-100 text-ink-500 hover:bg-ink-100"
                       )}
                     >
                       Todas
                     </button>
                     {EXAM_AREAS.map(area => (
                       <button
                         key={area.id}
                         onClick={() => setSelectedArea(area.id)}
                         className={classNames(
                           "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap border flex items-center gap-1.5 shrink-0",
                           selectedArea === area.id
                             ? "bg-brand-600 border-brand-600 text-white shadow-sm"
                             : "bg-ink-50 border-ink-100 hover:bg-ink-100 text-ink-500"
                         )}
                       >
                         <AreaIcon area={area.id} size={10} className={classNames(selectedArea === area.id ? "text-white" : "text-ink-400")} />
                         {area.label}
                       </button>
                     ))}
                   </div>
                 </div>

                 {/* Template Search & List */}
                 <div className="space-y-3">
                    <div className="relative group">
                      <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300 group-focus-within:text-brand-500 transition-colors" />
                      <input
                        placeholder="Pesquisar por nome da máscara técnica..."
                        className="w-full h-11 pl-11 pr-4 bg-white border-2 border-ink-100 rounded-xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-bold text-ink-900 text-xs shadow-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2 max-h-[260px] overflow-y-auto pr-1.5 custom-scrollbar py-0.5">
                      {filteredTemplates.map(t => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setSelectedTemplate(t);
                            setAnamnesis(t.anamnesisTemplate || '');
                            setStep(3);
                            setSearch('');
                          }}
                          disabled={loading}
                          className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-ink-100 hover:border-brand-500 hover:bg-brand-50/50 transition-all group shadow-sm"
                        >
                          <div className="text-left flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-ink-50 text-ink-400 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-all shrink-0">
                              <AreaIcon area={t.area} size={14} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-black text-ink-900 text-xs truncate group-hover:text-brand-700 transition-colors">{t.name}</p>
                              <p className="text-[8px] text-ink-400 font-black uppercase tracking-wider mt-0.5 leading-none">{t.area}</p>
                            </div>
                          </div>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-200 group-hover:text-brand-600 transition-all shrink-0">
                             <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </button>
                      ))}
                      {filteredTemplates.length === 0 && (
                        <div className="text-center py-6 opacity-60">
                          <p className="text-xs font-bold text-ink-400">Nenhuma máscara encontrada.</p>
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
                <div className="space-y-1 bg-brand-50/40 p-4 rounded-2xl border border-brand-100/60 shadow-sm relative overflow-hidden shrink-0">
                  <p className="text-[8px] font-black text-brand-600 uppercase tracking-widest leading-none mb-1">Procedimento Selecionado</p>
                  <h4 className="text-xs font-black text-ink-900 truncate leading-tight">{selectedTemplate.name}</h4>
                  <p className="text-[8px] text-ink-400 font-black uppercase tracking-wider leading-none mt-0.5">{selectedTemplate.area}</p>
                </div>

                 <div className="flex flex-col space-y-2">
                   {/* Anamnese / Indicação Clínica */}
                   <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest ml-1 block">Anamnese / Indicação Clínica</label>
                   <textarea
                     value={anamnesis}
                     onChange={(e) => setAnamnesis(e.target.value)}
                     placeholder="Ex: Dor abdominal a esclarecer. Suspeita de litíase vesicular."
                     className="w-full h-56 p-4 bg-white border border-ink-150 rounded-xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-semibold text-xs text-ink-900 resize-none custom-scrollbar"
                   />
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-ink-100 bg-white/50 backdrop-blur-sm flex items-center justify-between z-10 shrink-0">
           {step > 1 ? (
             <button 
               onClick={() => {
                 if (step === 3) {
                   setStep(2);
                 } else {
                   setStep(1);
                   setSearch('');
                 }
               }}
               className="flex items-center gap-1 text-[10px] font-black text-ink-400 hover:text-ink-900 uppercase tracking-widest transition-all active:scale-95"
             >
               <ArrowRight size={14} className="rotate-180" />
               Voltar
             </button>
           ) : (
             <div className="w-10" />
           )}
           
           <div className="flex gap-2">
             {[1, 2, 3].map(i => (
               <div key={i} className={classNames(
                 "w-2 h-2 rounded-full transition-all duration-300",
                 step === i ? "bg-brand-600 w-6 shadow-md shadow-brand-100" : "bg-ink-200"
               )} />
             ))}
           </div>

           {step === 1 ? (
             <button 
               onClick={() => { setStep(2); setSearch(''); }}
               disabled={!selectedPatient || loading}
               className="flex items-center gap-1.5 px-4 h-9 rounded-xl bg-brand-600 text-white font-black text-[9px] uppercase tracking-widest hover:bg-brand-700 disabled:opacity-50 transition-all shadow-md shadow-brand-100 active:scale-95"
             >
               Prosseguir
               <ArrowRight size={12} />
             </button>
           ) : step === 3 ? (
             <button 
               onClick={() => handleCreateDirect(selectedTemplate!)}
               disabled={loading}
               className="flex items-center gap-1.5 px-4 h-9 rounded-xl bg-brand-600 text-white font-black text-[9px] uppercase tracking-widest hover:bg-brand-700 disabled:opacity-50 transition-all shadow-md shadow-brand-100 active:scale-95"
             >
               {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
               Iniciar Laudo
             </button>
           ) : (
             <div className="w-16" />
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
