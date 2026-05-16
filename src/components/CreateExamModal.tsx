import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../store/app';
import { useCollection } from '../hooks/useFirestore';
import { addItemWithId, genId } from '../store/db';
import { Patient, ReportTemplate, Clinic, ExamRequest, EXAM_AREAS, ExamArea } from '../types';
import { 
  X, Search, UserPlus, Building2, ArrowRight, Loader2, Sparkles, 
  Info, LayoutGrid, Zap, Brain, ChevronRight, Wand2
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
  const { setView, selectedClinicId, showToast, createExamDefaultPatient, setCreateExamDefaultPatient } = useApp();
  const { data: patients } = useCollection<Patient>('patients');
  const { data: templates } = useCollection<ReportTemplate>('templates');
  const { data: clinics } = useCollection<Clinic>('clinics');

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showQuickPatient, setShowQuickPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientBirthDate, setNewPatientBirthDate] = useState('');
  const [clinicalIndication, setClinicalIndication] = useState('');

  const [selectedArea, setSelectedArea] = useState<ExamArea | 'todas' | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);

  const clinicalHints = [
    'Dor abdominal a esclarecer',
    'Pesquisa de colelitíase',
    'Seguimento de nódulo',
    'Rotina pré-natal',
    'Avaliação de fluxo Doppler'
  ];

  useEffect(() => {
    if (clinics.length > 0 && !selectedClinic) {
      const initial = clinics.find(c => c.id === selectedClinicId) || clinics[0];
      setSelectedClinic(initial);
    }
  }, [clinics, selectedClinicId, selectedClinic]);

  const filteredPatients = useMemo(() => {
    if (!search) return patients.slice(0, 6);
    const s = search.toLowerCase();
    return patients.filter(p => 
      p.name.toLowerCase().includes(s) || 
      p.id.toLowerCase().includes(s)
    ).slice(0, 10);
  }, [patients, search]);

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
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await addItemWithId('patients', patientId, newP);
      setSelectedPatient(newP as Patient);
      setStep(3);
      setShowQuickPatient(false);
      setNewPatientName('');
      setNewPatientBirthDate('');
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
        clinicalIndication: clinicalIndication.trim() || undefined,
        reportContent: getInitialReportContent(template),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const id = genId('exams');
      await addItemWithId('exams', id, examData);
      showToast('Exame iniciado!');
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
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-ink-100 relative"
      >
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -ml-32 -mb-32 opacity-30 pointer-events-none" />

        {/* Header */}
        <div className="px-10 py-8 border-b border-ink-100 flex items-center justify-between bg-white/50 backdrop-blur-sm z-10">
          <div>
            <h2 className="text-2xl font-black text-ink-900 flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-100">
                <Sparkles size={22} className="animate-pulse" />
              </div>
              Novo Laudo LAUD.IA
            </h2>
            <p className="text-[10px] text-ink-400 font-black uppercase tracking-[0.2em] mt-1.5 ml-0.5">Workflow Clínico de Alta Performance</p>
          </div>
          <button 
            onClick={() => {
              setCreateExamDefaultPatient(null);
              onClose();
            }} 
            className="p-3 hover:bg-ink-100 rounded-2xl text-ink-400 transition-all active:scale-90"
          >
            <X size={24} />
          </button>
        </div>

        {/* Progress Bar with Steps */}
        <div className="bg-ink-50/50 px-10 py-4 flex items-center justify-between border-b border-ink-100 z-10">
           {[
             { step: 1, label: 'Especialidade' },
             { step: 2, label: 'Paciente' },
             { step: 3, label: 'Máscara' }
           ].map((s) => (
             <div key={s.step} className="flex items-center gap-2">
                <div className={classNames(
                  "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black transition-all",
                  step >= s.step ? "bg-brand-600 text-white shadow-md shadow-brand-100" : "bg-ink-200 text-ink-500"
                )}>
                  {s.step}
                </div>
                <span className={classNames(
                  "text-[10px] font-black uppercase tracking-widest",
                  step >= s.step ? "text-ink-900" : "text-ink-300"
                )}>{s.label}</span>
                {s.step < 3 && <div className="w-8 h-px bg-ink-200 mx-2" />}
             </div>
           ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-10 z-10 custom-scrollbar">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center space-y-2">
                  <h3 className="font-black text-ink-900 text-xl">Qual a área do exame?</h3>
                  <p className="text-sm text-ink-500">Isso filtrará as máscaras inteligentes correspondentes.</p>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <button
                    onClick={() => { 
                      setSelectedArea('todas');
                      if (createExamDefaultPatient) {
                        setSelectedPatient(createExamDefaultPatient);
                        setStep(3);
                      } else {
                        setStep(2);
                      }
                    }}
                    className={classNames(
                      "flex flex-col items-center justify-center p-6 rounded-[2.5rem] border-2 transition-all gap-4 group h-40",
                      selectedArea === 'todas'
                        ? "border-brand-500 bg-brand-50 text-brand-700 shadow-xl shadow-brand-500/10" 
                        : "border-ink-50 bg-white text-ink-500 hover:border-brand-200 hover:bg-brand-50/30"
                    )}
                  >
                    <div className="w-16 h-16 rounded-[1.8rem] bg-ink-100 text-ink-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-brand-100 group-hover:text-brand-600 transition-all duration-300">
                      <LayoutGrid size={32} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest">Todas</span>
                  </button>
                  {EXAM_AREAS.map(area => (
                    <button
                      key={area.id}
                      onClick={() => { 
                        setSelectedArea(area.id);
                        if (createExamDefaultPatient) {
                          setSelectedPatient(createExamDefaultPatient);
                          setStep(3);
                        } else {
                          setStep(2);
                        }
                      }}
                      className={classNames(
                        "flex flex-col items-center justify-center p-6 rounded-[2.5rem] border-2 transition-all gap-4 group h-40",
                        selectedArea === area.id 
                          ? "border-brand-500 bg-brand-50 text-brand-700 shadow-xl shadow-brand-500/10" 
                          : "border-ink-50 bg-white text-ink-500 hover:border-brand-200 hover:bg-brand-50/30"
                      )}
                    >
                      <div className={classNames(
                        "w-16 h-16 rounded-[1.8rem] flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-sm",
                        area.color
                      )}>
                        <AreaIcon area={area.id} size={32} />
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-widest text-center leading-tight px-2">{area.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                   <div className="space-y-1">
                      <h3 className="font-black text-ink-900 text-xl">Identifique o Paciente</h3>
                      <p className="text-sm text-ink-500">Busque no banco ou crie um registro rápido.</p>
                   </div>
                   <button 
                    onClick={() => setShowQuickPatient(!showQuickPatient)}
                    className="px-5 py-2.5 rounded-2xl bg-brand-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-brand-700 transition-all flex items-center gap-2 shadow-lg shadow-brand-100"
                  >
                    {showQuickPatient ? <ArrowRight size={16} className="rotate-180" /> : <UserPlus size={16} />}
                    {showQuickPatient ? 'Voltar' : 'Novo Paciente'}
                  </button>
                </div>
                
                {showQuickPatient ? (
                  <div className="space-y-8 p-10 rounded-[3rem] bg-brand-50/50 border-2 border-brand-100 border-dashed animate-in zoom-in-95">
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label className="text-[10px] font-black text-brand-700 uppercase tracking-widest ml-1 mb-2.5 block">Nome do Paciente</label>
                        <input
                          type="text"
                          placeholder="Ex: Maria Oliveira Santos"
                          className="w-full h-14 px-5 bg-white border-2 border-brand-100 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-bold text-ink-900"
                          value={newPatientName}
                          onChange={(e) => setNewPatientName(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-brand-700 uppercase tracking-widest ml-1 mb-2.5 block">Data de Nascimento (Opcional)</label>
                        <input
                          type="date"
                          className="w-full h-14 px-5 bg-white border-2 border-brand-100 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-bold text-ink-900"
                          value={newPatientBirthDate}
                          onChange={(e) => setNewPatientBirthDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleQuickPatient}
                      disabled={!newPatientName.trim() || loading}
                      className="w-full h-14 bg-brand-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest hover:bg-brand-700 disabled:opacity-50 transition-all flex items-center justify-center gap-3 shadow-xl shadow-brand-500/20 active:scale-95"
                    >
                      {loading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                      Registrar e Prosseguir
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="relative group">
                      <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-ink-400 group-focus-within:text-brand-500 transition-colors" />
                      <input
                        placeholder="Nome, ID ou CPF..."
                        className="w-full h-16 pl-14 pr-6 bg-ink-50 border-2 border-ink-100 rounded-[1.8rem] focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 focus:bg-white outline-none transition-all font-semibold text-ink-900"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 max-h-[340px] overflow-y-auto pr-3 custom-scrollbar">
                      {filteredPatients.map(p => (
                        <button
                          key={p.id}
                          onClick={() => { setSelectedPatient(p); setStep(3); setSearch(''); }}
                          className="w-full flex items-center justify-between p-5 rounded-[1.8rem] bg-white border-2 border-ink-50 hover:border-brand-500 hover:bg-brand-50/50 transition-all group shadow-sm hover:shadow-md"
                        >
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-2xl bg-ink-100 text-ink-600 flex items-center justify-center font-black text-lg group-hover:bg-brand-600 group-hover:text-white transition-all duration-300">
                                {p.name.charAt(0)}
                             </div>
                             <div className="text-left">
                                <p className="font-black text-ink-900 text-sm group-hover:text-brand-700 transition-colors">{p.name}</p>
                                <p className="text-[10px] text-ink-400 font-mono font-bold mt-0.5">{p.id}</p>
                             </div>
                          </div>
                          <div className="w-10 h-10 rounded-xl bg-ink-50 text-ink-300 flex items-center justify-center group-hover:bg-brand-100 group-hover:text-brand-600 transition-all">
                            <ChevronRight size={18} />
                          </div>
                        </button>
                      ))}
                      {filteredPatients.length === 0 && (
                        <div className="text-center py-10 opacity-50">
                          <p className="text-sm font-bold text-ink-400">Nenhum paciente encontrado.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                 <div className="flex items-center gap-4 bg-brand-50 p-6 rounded-[2.5rem] border-2 border-brand-100 shadow-inner">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-brand-600 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-brand-200">
                       {selectedPatient?.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                       <p className="text-[9px] font-black text-brand-600 uppercase tracking-[0.2em]">Paciente Confirmado</p>
                       <p className="text-lg font-black text-ink-900">{selectedPatient?.name}</p>
                       <p className="text-[10px] text-brand-400 font-bold uppercase">{selectedPatient?.id}</p>
                    </div>
                    <button 
                      onClick={() => setStep(2)}
                      className="p-3 bg-white text-ink-400 hover:text-brand-600 rounded-2xl transition-all border border-brand-100 shadow-sm"
                    >
                      <RotateCcw size={18} />
                    </button>
                 </div>

                 <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <Brain size={16} className="text-brand-500" />
                          <label className="text-[10px] font-black text-ink-900 uppercase tracking-widest">Indicação Clínica & Motivo</label>
                        </div>
                        <div className="flex items-center gap-2">
                           <Wand2 size={12} className="text-brand-500" />
                           <span className="text-[9px] font-black text-brand-500 uppercase tracking-tighter">IA Context</span>
                        </div>
                      </div>
                      
                      <div className="relative group">
                        <textarea
                          placeholder="Ex: Dor abdominal no QSD há 2 dias, suspeita de colecistite..."
                          className="w-full p-5 bg-ink-50 border-2 border-ink-100 rounded-[2rem] focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 focus:bg-white outline-none transition-all font-semibold text-sm min-h-[120px] resize-none shadow-inner leading-relaxed"
                          value={clinicalIndication}
                          onChange={(e) => setClinicalIndication(e.target.value)}
                          autoFocus
                        />
                        <div className="absolute right-3 bottom-3 flex gap-2">
                           {clinicalHints.slice(0, 2).map((hint, idx) => (
                             <button
                               key={idx}
                               onClick={() => setClinicalIndication(hint)}
                               className="px-3 py-1.5 bg-white border border-ink-100 rounded-xl text-[9px] font-black text-ink-400 hover:text-brand-600 hover:border-brand-200 transition-all shadow-sm"
                             >
                               {hint}
                             </button>
                           ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-2">
                      <div className="flex items-center gap-2 px-1">
                        <LayoutGrid size={16} className="text-brand-500" />
                        <label className="text-[10px] font-black text-ink-900 uppercase tracking-widest">Selecione a Máscara Técnica</label>
                      </div>
                      
                      <div className="relative group">
                        <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-ink-300 group-focus-within:text-brand-500 transition-colors" />
                        <input
                          placeholder="Pesquisar por nome do exame..."
                          className="w-full h-14 pl-14 pr-6 bg-white border-2 border-ink-100 rounded-[1.5rem] focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-bold text-ink-900 text-sm shadow-sm"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 max-h-[240px] overflow-y-auto pr-3 custom-scrollbar py-1">
                        {filteredTemplates.map(t => (
                          <button
                            key={t.id}
                            onClick={() => handleCreateDirect(t)}
                            disabled={loading}
                            className="w-full flex items-center justify-between p-5 rounded-2xl bg-white border-2 border-ink-50 hover:border-brand-500 hover:bg-brand-50 transition-all group shadow-sm"
                          >
                            <div className="text-left flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-ink-50 text-ink-400 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-all">
                                <AreaIcon area={t.area} size={18} />
                              </div>
                              <div>
                                <p className="font-black text-ink-900 text-sm group-hover:text-brand-700 transition-colors">{t.name}</p>
                                <p className="text-[9px] text-ink-400 font-black uppercase tracking-widest mt-0.5">{t.area}</p>
                              </div>
                            </div>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-ink-200 group-hover:text-brand-600 transition-all">
                               <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-10 py-8 border-t border-ink-100 bg-white/50 backdrop-blur-sm flex items-center justify-between z-10">
           <button 
             onClick={() => setStep(s => s > 1 ? (s-1 as any) : 1)}
             disabled={step === 1 || loading}
             className="flex items-center gap-2 text-[11px] font-black text-ink-400 hover:text-ink-900 uppercase tracking-widest disabled:opacity-0 transition-all active:scale-95"
           >
             <ArrowRight size={16} className="rotate-180" />
             Anterior
           </button>
           
           <div className="flex gap-3">
             {[1,2,3].map(i => (
               <div key={i} className={classNames(
                 "w-2.5 h-2.5 rounded-full transition-all duration-500",
                 step === i ? "bg-brand-600 w-10 shadow-lg shadow-brand-100" : (step > i ? "bg-brand-200" : "bg-ink-200")
               )} />
             ))}
           </div>

           <div className="w-20" /> {/* Placeholder for layout balance */}
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
