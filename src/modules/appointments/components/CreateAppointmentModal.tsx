import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  X, Search, UserPlus, ArrowRight, Loader2, Sparkles,
  ChevronRight, CalendarDays, AlertCircle, RotateCcw, Check
} from 'lucide-react';
import { Patient, ReportTemplate, Clinic, EXAM_AREAS, ExamArea, Appointment } from '../../../types';
import { classNames } from '../../../utils/format';
import { AreaIcon } from '../../../components/AreaIcon';
import { generateSlotsForDay, findNextAvailableDate, getLocalDateStr } from '../utils/scheduleUtils';
import { motion, AnimatePresence } from 'framer-motion';

interface CreateAppointmentModalProps {
  clinics: Clinic[];
  patients: Patient[];
  templates: ReportTemplate[];
  appointments: Appointment[];
  
  // Selection states & set actions
  selectedClinic: Clinic | null;
  setSelectedClinic: (c: Clinic) => void;
  selectedPatient: Patient | null;
  setSelectedPatient: (p: Patient | null) => void;
  selectedTemplate: ReportTemplate | null;
  setSelectedTemplate: (t: ReportTemplate | null) => void;
  
  appointmentDate: string;
  setAppointmentDate: (d: string) => void;
  appointmentTime: string;
  setAppointmentTime: (t: string) => void;
  appointmentNotes: string;
  setAppointmentNotes: (n: string) => void;
  appointmentPriority: 'normal' | 'urgente';
  setAppointmentPriority: (p: 'normal' | 'urgente') => void;
  appointmentRequestingPhysician: string;
  setAppointmentRequestingPhysician: (dr: string) => void;
  appointmentInsurance: string;
  setAppointmentInsurance: (ins: string) => void;

  onClose: () => void;
  onSave: () => Promise<void>;
  onQuickPatientRegister: (patientData: {
    name: string;
    birthDate?: string;
    gender?: 'M' | 'F' | 'O';
    phone?: string;
    cpf?: string;
    insurance?: string;
  }) => Promise<Patient | null>;
}

export function CreateAppointmentModal({
  clinics,
  patients,
  templates,
  appointments,
  selectedClinic,
  setSelectedClinic,
  selectedPatient,
  setSelectedPatient,
  selectedTemplate,
  setSelectedTemplate,
  appointmentDate,
  setAppointmentDate,
  appointmentTime,
  setAppointmentTime,
  appointmentNotes,
  setAppointmentNotes,
  appointmentPriority,
  setAppointmentPriority,
  appointmentRequestingPhysician,
  setAppointmentRequestingPhysician,
  appointmentInsurance,
  setAppointmentInsurance,
  onClose,
  onSave,
  onQuickPatientRegister,
}: CreateAppointmentModalProps) {
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [patientSearch, setPatientSearch] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [showQuickPatient, setShowQuickPatient] = useState(false);
  const [loading, setLoading] = useState(false);

  // Quick patient local state
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientBirthDate, setNewPatientBirthDate] = useState('');
  const [newPatientGender, setNewPatientGender] = useState<'M' | 'F' | 'O'>('F');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [newPatientCPF, setNewPatientCPF] = useState('');
  const [newPatientInsurance, setNewPatientInsurance] = useState('');

  const [selectedArea, setSelectedArea] = useState<ExamArea | 'todas'>('todas');

  const lastClinicIdRef = useRef<string | null>(null);

  // Auto-set initial clinic if not set
  useEffect(() => {
    if (clinics.length > 0 && !selectedClinic) {
      setSelectedClinic(clinics[0]);
    }
  }, [clinics, selectedClinic, setSelectedClinic]);

  // Ao trocar de clínica/abrir: respeita o dia já selecionado pelo usuário se
  // ele for um dia de atendimento; caso contrário, sugere o próximo disponível
  // A PARTIR do dia selecionado (não de "hoje").
  useEffect(() => {
    if (selectedClinic && appointments) {
      if (lastClinicIdRef.current !== selectedClinic.id) {
        lastClinicIdRef.current = selectedClinic.id;
        const baseStr = appointmentDate || getLocalDateStr(new Date());
        const nextDate = findNextAvailableDate(selectedClinic, baseStr, appointments);
        setAppointmentDate(nextDate);
      }
    }
  }, [selectedClinic, appointments, appointmentDate, setAppointmentDate]);

  // Patients filtering with improved phone/CPF match
  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients.slice(0, 5);
    const s = patientSearch.toLowerCase().trim();
    return patients.filter(p => {
      const matchName = p.name.toLowerCase().includes(s);
      const matchId = p.id.toLowerCase().includes(s);
      const matchPhone = p.phone && p.phone.toLowerCase().includes(s);
      
      const cleanCPF = p.cpf ? p.cpf.replace(/\D/g, '') : '';
      const cleanSearch = s.replace(/\D/g, '');
      const matchCPF = cleanCPF && cleanSearch && cleanCPF.includes(cleanSearch);
      
      return matchName || matchId || matchPhone || matchCPF;
    }).slice(0, 8);
  }, [patients, patientSearch]);

  const hasExactMatch = useMemo(() => {
    if (!patientSearch.trim()) return true;
    const s = patientSearch.trim().toLowerCase();
    return patients.some(p => p.name.toLowerCase() === s);
  }, [patients, patientSearch]);

  // Auto-open quick patient if no patient found
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
      setNewPatientPhone('');
      setNewPatientCPF('');
      setNewPatientInsurance('');
    } else {
      setShowQuickPatient(true);
      setNewPatientName(patientSearch.trim());
    }
  };

  const handleQuickPatientSubmit = async () => {
    if (!newPatientName.trim()) return;
    setLoading(true);
    try {
      const p = await onQuickPatientRegister({
        name: newPatientName.trim(),
        birthDate: newPatientBirthDate || undefined,
        gender: newPatientGender,
        phone: newPatientPhone.trim() || undefined,
        cpf: newPatientCPF.trim() || undefined,
        insurance: newPatientInsurance.trim() || undefined,
      });

      if (p) {
        setSelectedPatient(p);
        setNewPatientName('');
        setNewPatientBirthDate('');
        setNewPatientGender('F');
        setNewPatientPhone('');
        setNewPatientCPF('');
        setNewPatientInsurance('');
        setShowQuickPatient(false);
        setModalStep(2);
      }
    } finally {
      setLoading(false);
    }
  };

  // Templates filtering
  const filteredTemplates = useMemo(() => {
    let list = templates;
    if (selectedArea && selectedArea !== 'todas') {
      list = list.filter(t => t.area === selectedArea);
    }
    if (templateSearch) {
      const s = templateSearch.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(s));
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [templates, templateSearch, selectedArea]);

  // Slots generation
  const slots = useMemo(() => {
    if (!selectedClinic || !appointmentDate) return [];
    return generateSlotsForDay(selectedClinic, appointmentDate, appointments);
  }, [selectedClinic, appointmentDate, appointments]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onSave();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div 
        initial={{ scale: 0.96, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 20 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] relative modal-mobile-sheet"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-ink-100 flex items-center justify-between bg-white z-10 relative shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative w-10 h-10 rounded-xl bg-ink-900 text-white flex items-center justify-center shadow-sm">
              <CalendarDays size={18} />
            </div>
            <div>
              <h2 className="text-base font-black text-ink-900 leading-tight">Novo Agendamento</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-400 animate-pulse"></span>
                <p className="text-[9px] text-ink-500 font-bold uppercase tracking-[0.2em]">Recepção & Triagem</p>
              </div>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 hover:bg-ink-100 rounded-xl text-ink-400 hover:text-ink-700 transition-all active:scale-95"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sticky Steps bar */}
        <div className="bg-ink-50 px-6 py-3 flex items-center gap-2.5 border-b border-ink-100 shrink-0">
          {[
            { step: 1, label: 'Paciente' },
            { step: 2, label: 'Máscara' },
            { step: 3, label: 'Agenda & Horário' }
          ].map((s, idx) => {
            const isActive = modalStep === s.step;
            const isPast = modalStep > s.step;
            const canNavigate = s.step < modalStep || (s.step === 2 && selectedPatient) || (s.step === 3 && selectedPatient && selectedTemplate);

            return (
              <div key={s.step} className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={!canNavigate}
                  onClick={() => setModalStep(s.step as any)}
                  className={classNames(
                    "flex items-center gap-2 border-none bg-transparent p-0 outline-none transition-all text-left",
                    canNavigate ? "cursor-pointer hover:opacity-80" : "cursor-default"
                  )}
                >
                  <div className={classNames(
                    "w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black shadow-sm transition-colors",
                    isPast ? "bg-emerald-600 text-white" : isActive ? "bg-ink-900 text-white" : "bg-ink-200 text-ink-400"
                  )}>
                    {isPast ? <Check size={11} strokeWidth={3} /> : s.step}
                  </div>
                  <span className={classNames(
                    "text-[9px] font-black uppercase tracking-wider",
                    isActive ? "text-ink-900" : isPast ? "text-ink-600" : "text-ink-400"
                  )}>{s.label}</span>
                </button>
                {idx < 2 && <div className="w-4 h-0.5 bg-ink-200" />}
              </div>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <AnimatePresence mode="wait">
            {modalStep === 1 && (
              <motion.div 
                key="step1" 
                initial={{ opacity: 0, x: 15 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -15 }}
                className="space-y-5"
              >
                {clinics.length > 0 && (
                  <div className="pb-4 border-b border-ink-100">
                    <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest ml-1 mb-1.5 block">Unidade de Agendamento</label>
                    <select
                      value={selectedClinic?.id || ''}
                      onChange={(e) => {
                        const c = clinics.find(x => x.id === e.target.value);
                        if (c) setSelectedClinic(c);
                      }}
                      className="w-full h-11 px-3 bg-ink-50 border border-ink-200 rounded-xl font-bold text-xs text-ink-900 focus:border-ink-400 outline-none"
                    >
                      {clinics.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedPatient ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-ink-50 p-4 rounded-2xl border border-ink-200 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-ink-900 text-white flex items-center justify-center font-black text-lg shrink-0">
                          {selectedPatient.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-ink-900">{selectedPatient.name}</h4>
                          <p className="text-[9px] text-ink-400 font-bold uppercase tracking-wider mt-0.5">
                            ID: {selectedPatient.id} {selectedPatient.birthDate ? `• Nascimento: ${selectedPatient.birthDate}` : ''}
                          </p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setSelectedPatient(null)}
                        className="p-2 text-ink-400 hover:text-rose-500 rounded-lg border border-ink-200 hover:bg-rose-50 transition-all active:scale-95"
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-ink-900 text-xs uppercase tracking-widest">Selecione o Paciente</h3>
                      <button 
                        type="button"
                        onClick={handleToggleQuickPatient}
                        className="px-3 py-1.5 rounded-xl bg-ink-900 text-white font-bold text-[9px] uppercase tracking-widest hover:bg-ink-800 transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        {showQuickPatient ? <ArrowRight size={12} className="rotate-180" /> : <UserPlus size={12} />}
                        {showQuickPatient ? 'Voltar à busca' : 'Registrar Rápido'}
                      </button>
                    </div>

                    {showQuickPatient ? (
                      <div className="space-y-4 p-5 rounded-2xl bg-ink-50 border border-ink-200 shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-ink-700">
                          <div className="sm:col-span-2">
                            <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest ml-1 mb-1.5 block">Nome Completo *</label>
                            <input
                              type="text"
                              placeholder="Ex: Maria Oliveira Santos"
                              className="w-full h-11 px-3 bg-white border border-ink-200 rounded-xl focus:border-ink-400 outline-none font-bold text-xs text-ink-900"
                              value={newPatientName}
                              onChange={(e) => setNewPatientName(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest ml-1 mb-1.5 block">Nascimento (Opcional)</label>
                            <input
                              type="date"
                              className="w-full h-11 px-3 bg-white border border-ink-200 rounded-xl focus:border-ink-400 outline-none font-bold text-xs text-ink-900"
                              value={newPatientBirthDate}
                              onChange={(e) => setNewPatientBirthDate(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest ml-1 mb-1.5 block">Sexo</label>
                            <select
                              className="w-full h-11 px-3 bg-white border border-ink-200 rounded-xl focus:border-ink-400 outline-none font-bold text-xs text-ink-900 cursor-pointer"
                              value={newPatientGender}
                              onChange={(e) => setNewPatientGender(e.target.value as any)}
                            >
                              <option value="F">Feminino</option>
                              <option value="M">Masculino</option>
                              <option value="O">Outro</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest ml-1 mb-1.5 block">Telefone</label>
                            <input
                              type="tel"
                              placeholder="(00) 00000-0000"
                              className="w-full h-11 px-3 bg-white border border-ink-200 rounded-xl focus:border-ink-400 outline-none font-bold text-xs text-ink-900"
                              value={newPatientPhone}
                              onChange={(e) => setNewPatientPhone(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest ml-1 mb-1.5 block">CPF</label>
                            <input
                              type="text"
                              placeholder="000.000.000-00"
                              className="w-full h-11 px-3 bg-white border border-ink-200 rounded-xl focus:border-ink-400 outline-none font-bold text-xs text-ink-900"
                              value={newPatientCPF}
                              onChange={(e) => setNewPatientCPF(e.target.value)}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest ml-1 mb-1.5 block">Convênio / Plano de Saúde</label>
                            <input
                              type="text"
                              placeholder="Ex: Unimed, Bradesco..."
                              className="w-full h-11 px-3 bg-white border border-ink-200 rounded-xl focus:border-ink-400 outline-none font-bold text-xs text-ink-900"
                              value={newPatientInsurance}
                              onChange={(e) => setNewPatientInsurance(e.target.value)}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleQuickPatientSubmit}
                          disabled={!newPatientName.trim() || loading}
                          className="w-full h-11 bg-ink-900 hover:bg-ink-800 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                          Registrar e Continuar
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="relative">
                          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
                          <input
                            placeholder="Buscar por nome, ID, CPF ou Telefone..."
                            className="w-full h-12 pl-12 pr-4 bg-ink-50 border border-ink-200 rounded-2xl focus:border-ink-400 focus:bg-white outline-none font-bold text-sm text-ink-900"
                            value={patientSearch}
                            onChange={(e) => setPatientSearch(e.target.value)}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1.5 custom-scrollbar">
                          {filteredPatients.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedPatient(p);
                                if (p.insurance) {
                                  setAppointmentInsurance(p.insurance);
                                }
                                setPatientSearch('');
                                setModalStep(2);
                              }}
                              className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-ink-200 hover:border-ink-400 transition-all text-left shadow-sm group"
                            >
                              <div>
                                <p className="font-bold text-ink-900 text-xs truncate">{p.name}</p>
                                <p className="text-[8px] text-ink-400 font-mono mt-0.5 truncate">
                                  ID: {p.id} {p.birthDate ? `• Nasc: ${p.birthDate}` : ''} {p.cpf ? `• CPF: ${p.cpf}` : ''}
                                </p>
                              </div>
                              <ChevronRight size={14} className="text-ink-300 group-hover:text-ink-900" />
                            </button>
                          ))}
                          {patientSearch.trim() && !hasExactMatch && (
                            <button
                              type="button"
                              onClick={() => { setNewPatientName(patientSearch.trim()); setShowQuickPatient(true); }}
                              className="w-full flex items-center justify-between p-3 rounded-xl bg-ink-50 border border-dashed border-ink-300 hover:border-ink-400 transition-all font-bold text-ink-700"
                            >
                              <span className="text-xs truncate">Cadastrar "{patientSearch.trim()}"</span>
                              <Sparkles size={12} className="text-ink-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {modalStep === 2 && (
              <motion.div 
                key="step2" 
                initial={{ opacity: 0, x: 15 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -15 }}
                className="space-y-4"
              >
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <button
                    type="button"
                    onClick={() => setSelectedArea('todas')}
                    className={classNames(
                      "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border shrink-0",
                      selectedArea === 'todas' ? "bg-ink-900 border-ink-900 text-white shadow-sm" : "bg-ink-50 text-ink-500 border-ink-200"
                    )}
                  >
                    Todas
                  </button>
                  {EXAM_AREAS.map(area => (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => setSelectedArea(area.id)}
                      className={classNames(
                        "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border shrink-0 flex items-center gap-1.5",
                        selectedArea === area.id ? "bg-ink-900 border-ink-900 text-white shadow-sm" : "bg-ink-50 text-ink-500 border-ink-200"
                      )}
                    >
                      <AreaIcon area={area.id} size={10} />
                      {area.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
                    <input
                      placeholder="Buscar máscara técnica do exame..."
                      className="w-full h-11 pl-12 pr-4 bg-ink-50 border border-ink-200 rounded-xl focus:border-ink-400 outline-none font-bold text-ink-900 text-xs"
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1.5 custom-scrollbar">
                    {filteredTemplates.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setSelectedTemplate(t); setTemplateSearch(''); setModalStep(3); }}
                        className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white border border-ink-200 hover:border-ink-400 transition-all text-left shadow-sm group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-ink-100 flex items-center justify-center text-ink-400">
                            <AreaIcon area={t.area} size={12} />
                          </div>
                          <div>
                            <p className="font-bold text-ink-900 text-xs">{t.name}</p>
                            <p className="text-[8px] text-ink-400 font-bold uppercase mt-0.5">{t.area}</p>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-ink-300" />
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {modalStep === 3 && selectedTemplate && (
              <motion.div 
                key="step3" 
                initial={{ opacity: 0, x: 15 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -15 }}
                className="space-y-4"
              >
                {/* Resumo Procedimento */}
                <div className="bg-ink-50 p-4 rounded-xl border border-ink-200 shadow-sm">
                  <p className="text-[9px] font-black text-ink-500 uppercase tracking-widest leading-none">Procedimento Selecionado</p>
                  <h4 className="text-xs font-black text-ink-900 mt-1">{selectedTemplate.name}</h4>
                </div>

                {/* Form fields: Priority, Doctor, Insurance */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 border border-ink-200 rounded-xl bg-ink-50/30">
                  <div>
                    <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest block mb-1">Prioridade</label>
                    <select
                      value={appointmentPriority}
                      onChange={(e) => setAppointmentPriority(e.target.value as any)}
                      className="w-full h-10 px-2 bg-white border border-ink-200 rounded-xl font-bold text-xs focus:border-ink-400 outline-none"
                    >
                      <option value="normal">Normal</option>
                      <option value="urgente">⚠️ Urgente</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest block mb-1">Convênio</label>
                    <input
                      type="text"
                      placeholder="Ex: Unimed, Particular..."
                      value={appointmentInsurance}
                      onChange={(e) => setAppointmentInsurance(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-ink-200 rounded-xl font-bold text-xs focus:border-ink-400 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest block mb-1">Médico Solicitante (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Dr(a). Nome do Médico"
                      value={appointmentRequestingPhysician}
                      onChange={(e) => setAppointmentRequestingPhysician(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-ink-200 rounded-xl font-bold text-xs focus:border-ink-400 outline-none"
                    />
                  </div>
                </div>

                {/* Date */}
                <div className="flex flex-col space-y-2">
                  <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest block">Data do Exame</label>
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => { setAppointmentDate(e.target.value); setAppointmentTime(''); }}
                    className="w-full h-11 px-3 bg-white border border-ink-200 rounded-xl font-bold text-xs focus:border-ink-400 outline-none shadow-sm"
                  />
                  {appointmentDate && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-brand-700 uppercase tracking-wider">
                      <CalendarDays size={12} className="text-brand-500" />
                      {new Date(appointmentDate + 'T00:00:00').toLocaleDateString('pt-BR', {
                        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                      })}
                    </span>
                  )}
                </div>

                {/* Slots Grid */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest block ml-0.5">Escolha um Horário Disponível</label>
                  
                  {slots.length === 0 ? (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-700 text-xs font-semibold">
                      <AlertCircle size={16} />
                      <span>Sem turnos configurados ou expediente ativo para o dia selecionado.</span>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[160px] overflow-y-auto p-1.5 border border-ink-200 rounded-xl custom-scrollbar bg-white">
                      {Array.from(new Set(slots.map(s => s.shiftName))).map(shiftName => (
                        <div key={shiftName} className="space-y-1.5">
                          <span className="text-[8px] font-black text-ink-400 uppercase tracking-widest block px-1">{shiftName}</span>
                          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                            {slots.filter(s => s.shiftName === shiftName).map(slot => (
                              <button
                                key={slot.time}
                                type="button"
                                disabled={slot.booked}
                                onClick={() => setAppointmentTime(slot.time)}
                                title={slot.booked ? `Ocupado por ${slot.bookedBy}` : 'Disponível'}
                                className={classNames(
                                  "py-2 rounded-lg text-xs font-bold text-center border transition-all active:scale-95",
                                  slot.booked 
                                    ? "bg-ink-100 border-ink-200 text-ink-400 cursor-not-allowed line-through" 
                                    : appointmentTime === slot.time
                                      ? "bg-ink-900 border-ink-900 text-white shadow-sm"
                                      : "bg-emerald-50/30 border-emerald-100 text-emerald-800 hover:bg-emerald-100/50 hover:border-emerald-300"
                                )}
                              >
                                {slot.time}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes (with word limit) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest block ml-0.5">Indicação Clínica / Observações</label>
                    <span className="text-[8px] font-black text-ink-400 uppercase tracking-wider">{appointmentNotes.length}/500</span>
                  </div>
                  <textarea
                    placeholder="Ex: Dor abdominal, suspeita de cálculo renal..."
                    value={appointmentNotes}
                    maxLength={500}
                    onChange={(e) => setAppointmentNotes(e.target.value)}
                    className="w-full h-16 p-3 bg-white border border-ink-200 rounded-xl font-medium text-xs focus:border-ink-400 outline-none resize-none"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-ink-100 bg-white flex items-center justify-between shrink-0 z-10">
          {modalStep > 1 ? (
            <button 
              type="button"
              onClick={() => setModalStep((modalStep - 1) as any)}
              className="flex items-center gap-1.5 text-[10px] font-bold text-ink-400 hover:text-ink-900 uppercase tracking-widest border-none bg-transparent"
            >
              Voltar
            </button>
          ) : (
            <div className="w-10" />
          )}

          {modalStep === 1 && selectedPatient ? (
            <button 
              type="button"
              onClick={() => setModalStep(2)}
              className="px-5 h-10 bg-ink-900 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-ink-800 transition-all flex items-center gap-1.5"
            >
              Prosseguir <ArrowRight size={12} />
            </button>
          ) : modalStep === 2 && selectedTemplate ? (
            <button 
              type="button"
              onClick={() => setModalStep(3)}
              className="px-5 h-10 bg-ink-900 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-ink-800 transition-all flex items-center gap-1.5"
            >
              Prosseguir <ArrowRight size={12} />
            </button>
          ) : modalStep === 3 ? (
            <div className="flex items-center gap-3">
              {!appointmentTime && (
                <span className="hidden sm:inline text-[9px] font-bold text-amber-600 uppercase tracking-wider">
                  Selecione um horário
                </span>
              )}
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading || !appointmentTime}
                className="px-5 h-10 bg-ink-900 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-ink-800 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Confirmar Agendamento
              </button>
            </div>
          ) : (
            <div className="w-10" />
          )}
        </div>
      </motion.div>
    </div>
  );
}
