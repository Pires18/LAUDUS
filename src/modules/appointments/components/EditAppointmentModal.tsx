import { useState, useMemo, useEffect } from 'react';
import { 
  X, Search, Loader2, Sparkles, CalendarDays, AlertCircle, Edit, User, FileText, Check, ChevronRight
} from 'lucide-react';
import { Patient, ReportTemplate, Clinic, EXAM_AREAS, ExamArea, Appointment } from '../../../types';
import { classNames } from '../../../utils/format';
import { AreaIcon } from '../../../components/AreaIcon';
import { generateSlotsForDay, getLocalDateStr } from '../utils/scheduleUtils';
import { motion } from 'framer-motion';

interface EditAppointmentModalProps {
  appointment: Appointment;
  clinics: Clinic[];
  patients: Patient[];
  templates: ReportTemplate[];
  appointments: Appointment[];
  onClose: () => void;
  onSave: (updatedFields: Partial<Appointment>) => Promise<void>;
}

export function EditAppointmentModal({
  appointment,
  clinics,
  patients,
  templates,
  appointments: allAppointments,
  onClose,
  onSave,
}: EditAppointmentModalProps) {
  const [loading, setLoading] = useState(false);

  // Patient info (Editable on the appointment object)
  const [selectedPatientId, setSelectedPatientId] = useState(appointment.patientId);
  const [patientName, setPatientName] = useState(appointment.patientName);
  const [patientBirthDate, setPatientBirthDate] = useState(appointment.patientBirthDate || '');
  const [patientGender, setPatientGender] = useState<'M' | 'F' | 'O'>(appointment.patientGender || 'F');
  const [patientPhone, setPatientPhone] = useState(appointment.patientPhone || '');
  const [patientCPF, setPatientCPF] = useState(appointment.patientCPF || '');
  
  // Search patient modal/popover state
  const [showPatientSearch, setShowPatientSearch] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');

  // Exam / Clinic states
  const [selectedClinicId, setSelectedClinicId] = useState(appointment.clinicId || clinics[0]?.id || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState(appointment.templateId || '');
  const [selectedArea, setSelectedArea] = useState<ExamArea | 'todas'>('todas');
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');

  // Date/Time Rescheduling states
  const [appointmentDate, setAppointmentDate] = useState(getLocalDateStr(appointment.scheduledAt));
  const [appointmentTime, setAppointmentTime] = useState(() => {
    const d = new Date(appointment.scheduledAt);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  });

  // Other details
  const [appointmentNotes, setAppointmentNotes] = useState(appointment.notes || '');
  const [appointmentPriority, setAppointmentPriority] = useState<'normal' | 'urgente'>(appointment.priority || 'normal');
  const [appointmentRequestingPhysician, setAppointmentRequestingPhysician] = useState(appointment.requestingPhysician || '');
  const [appointmentInsurance, setAppointmentInsurance] = useState(appointment.patientInsurance || '');

  // Resolved Clinic and Template objects
  const selectedClinic = useMemo(() => {
    return clinics.find(c => c.id === selectedClinicId) || null;
  }, [clinics, selectedClinicId]);

  const selectedTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateId) || null;
  }, [templates, selectedTemplateId]);

  // Set default area filter based on template's area
  useEffect(() => {
    if (selectedTemplate) {
      setSelectedArea(selectedTemplate.area);
    }
  }, [selectedTemplate]);

  // Filter templates list
  const filteredTemplates = useMemo(() => {
    let list = templates;
    if (selectedArea && selectedArea !== 'todas') {
      list = list.filter(t => t.area === selectedArea);
    }
    if (templateSearchQuery) {
      const s = templateSearchQuery.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(s));
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [templates, templateSearchQuery, selectedArea]);

  // Filter patients list for searching
  const filteredPatients = useMemo(() => {
    if (!patientSearchQuery.trim()) return patients.slice(0, 5);
    const s = patientSearchQuery.toLowerCase().trim();
    return patients.filter(p => {
      const matchName = p.name.toLowerCase().includes(s);
      const matchId = p.id.toLowerCase().includes(s);
      const matchPhone = p.phone && p.phone.toLowerCase().includes(s);
      
      const cleanCPF = p.cpf ? p.cpf.replace(/\D/g, '') : '';
      const cleanSearch = s.replace(/\D/g, '');
      const matchCPF = cleanCPF && cleanSearch && cleanCPF.includes(cleanSearch);
      
      return matchName || matchId || matchPhone || matchCPF;
    }).slice(0, 8);
  }, [patients, patientSearchQuery]);

  // Slots generation
  const slots = useMemo(() => {
    if (!selectedClinic || !appointmentDate) return [];
    return generateSlotsForDay(selectedClinic, appointmentDate, allAppointments);
  }, [selectedClinic, appointmentDate, allAppointments]);

  const handlePatientSelect = (p: Patient) => {
    setSelectedPatientId(p.id);
    setPatientName(p.name);
    setPatientBirthDate(p.birthDate || '');
    setPatientGender(p.gender || 'F');
    setPatientPhone(p.phone || '');
    setPatientCPF(p.cpf || '');
    if (p.insurance) {
      setAppointmentInsurance(p.insurance);
    }
    setShowPatientSearch(false);
  };

  const handleConfirm = async () => {
    if (!patientName.trim() || !selectedTemplateId || !selectedClinicId || !appointmentTime) return;
    
    setLoading(true);
    try {
      const [year, month, day] = appointmentDate.split('-').map(Number);
      const [hours, minutes] = appointmentTime.split(':').map(Number);
      const scheduledDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);

      const updatedFields: Partial<Appointment> = {
        patientId: selectedPatientId,
        patientName: patientName.trim(),
        patientBirthDate: patientBirthDate || undefined,
        patientGender,
        patientPhone: patientPhone.trim() || undefined,
        patientCPF: patientCPF.trim() || undefined,
        patientInsurance: appointmentInsurance.trim() || undefined,
        requestingPhysician: appointmentRequestingPhysician.trim() || undefined,
        priority: appointmentPriority,
        clinicId: selectedClinicId,
        area: selectedTemplate?.area || appointment.area,
        examType: selectedTemplate?.name || appointment.examType,
        templateId: selectedTemplateId,
        scheduledAt: scheduledDateTime.getTime(),
        notes: appointmentNotes.trim() || undefined,
        updatedAt: Date.now()
      };

      await onSave(updatedFields);
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
        className="bg-white rounded-[2rem] shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] relative modal-mobile-sheet"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-ink-100 flex items-center justify-between bg-white z-10 relative shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative w-10 h-10 rounded-xl bg-ink-900 text-white flex items-center justify-center shadow-sm">
              <Edit size={18} />
            </div>
            <div>
              <h2 className="text-base font-black text-ink-900 leading-tight">Editar Agendamento</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                <p className="text-[9px] text-ink-500 font-bold uppercase tracking-[0.2em]">Registro ID: {appointment.id}</p>
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar grid grid-cols-1 lg:grid-cols-2 gap-6 bg-ink-50/50">
          
          {/* COLUMN 1: Patient & Billing Details */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-ink-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-ink-100 pb-3">
                <h3 className="font-black text-ink-900 text-xs uppercase tracking-wider flex items-center gap-2">
                  <User size={14} className="text-ink-400" />
                  Dados do Paciente
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPatientSearch(!showPatientSearch)}
                  className="px-2.5 py-1 rounded-lg bg-ink-100 text-ink-700 hover:bg-ink-200 font-bold text-[9px] uppercase tracking-wider transition-all"
                >
                  {showPatientSearch ? 'Cancelar' : 'Alterar Paciente'}
                </button>
              </div>

              {showPatientSearch ? (
                <div className="space-y-3 p-3 bg-ink-50 border border-ink-200 rounded-xl">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                    <input
                      placeholder="Buscar por nome, CPF ou Telefone..."
                      className="w-full h-9 pl-9 pr-3 bg-white border border-ink-200 rounded-lg focus:border-ink-400 outline-none text-xs font-bold text-ink-900"
                      value={patientSearchQuery}
                      onChange={(e) => setPatientSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1.5 custom-scrollbar">
                    {filteredPatients.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePatientSelect(p)}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-white border border-ink-200 hover:border-ink-400 transition-all text-left shadow-sm text-xs font-bold"
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="text-[8px] text-ink-400 font-mono shrink-0 ml-2">{p.id}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-ink-700">
                <div className="sm:col-span-2">
                  <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest ml-1 mb-1 block">Nome Completo *</label>
                  <input
                    type="text"
                    className="w-full h-10 px-3 bg-white border border-ink-200 rounded-xl focus:border-ink-400 outline-none font-bold text-xs text-ink-900"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest ml-1 mb-1 block">Nascimento</label>
                  <input
                    type="date"
                    className="w-full h-10 px-3 bg-white border border-ink-200 rounded-xl focus:border-ink-400 outline-none font-bold text-xs text-ink-900"
                    value={patientBirthDate}
                    onChange={(e) => setPatientBirthDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest ml-1 mb-1 block">Sexo</label>
                  <select
                    className="w-full h-10 px-3 bg-white border border-ink-200 rounded-xl focus:border-ink-400 outline-none font-bold text-xs text-ink-900 cursor-pointer"
                    value={patientGender}
                    onChange={(e) => setPatientGender(e.target.value as any)}
                  >
                    <option value="F">Feminino</option>
                    <option value="M">Masculino</option>
                    <option value="O">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest ml-1 mb-1 block">Telefone</label>
                  <input
                    type="tel"
                    className="w-full h-10 px-3 bg-white border border-ink-200 rounded-xl focus:border-ink-400 outline-none font-bold text-xs text-ink-900"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest ml-1 mb-1 block">CPF</label>
                  <input
                    type="text"
                    className="w-full h-10 px-3 bg-white border border-ink-200 rounded-xl focus:border-ink-400 outline-none font-bold text-xs text-ink-900"
                    value={patientCPF}
                    onChange={(e) => setPatientCPF(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-ink-200 shadow-sm space-y-4">
              <h3 className="font-black text-ink-900 text-xs uppercase tracking-wider flex items-center gap-2 border-b border-ink-100 pb-3">
                <FileText size={14} className="text-ink-400" />
                Dados do Atendimento / Convênio
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-ink-700">
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
                    value={appointmentInsurance}
                    onChange={(e) => setAppointmentInsurance(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-ink-200 rounded-xl font-bold text-xs focus:border-ink-400 outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest block mb-1">Médico Solicitante (Opcional)</label>
                  <input
                    type="text"
                    value={appointmentRequestingPhysician}
                    onChange={(e) => setAppointmentRequestingPhysician(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-ink-200 rounded-xl font-bold text-xs focus:border-ink-400 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* COLUMN 2: Clinic, Exam Template & Date/Time Reschedule */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-ink-200 shadow-sm space-y-4">
              <h3 className="font-black text-ink-900 text-xs uppercase tracking-wider flex items-center gap-2 border-b border-ink-100 pb-3">
                <CalendarDays size={14} className="text-ink-400" />
                Clínica & Procedimento (Máscara)
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest ml-1 mb-1 block">Unidade de Atendimento</label>
                  <select
                    value={selectedClinicId}
                    onChange={(e) => {
                      setSelectedClinicId(e.target.value);
                      setAppointmentTime('');
                    }}
                    className="w-full h-10 px-3 bg-white border border-ink-200 rounded-xl font-bold text-xs text-ink-900 focus:border-ink-400 outline-none"
                  >
                    {clinics.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest ml-1 mb-1 block">Procedimento (Máscara)</label>
                  
                  {selectedTemplate ? (
                    <div className="flex items-center justify-between bg-ink-50 p-2.5 rounded-xl border border-ink-200 shadow-inner mb-2">
                      <div className="flex items-center gap-2">
                        <AreaIcon area={selectedTemplate.area} size={12} className="text-ink-400" />
                        <span className="text-xs font-bold text-ink-900">{selectedTemplate.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedTemplateId('')}
                        className="p-1 hover:bg-ink-200 rounded text-ink-450 hover:text-ink-900"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                        <button
                          type="button"
                          onClick={() => setSelectedArea('todas')}
                          className={classNames(
                            "px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider transition-all border shrink-0",
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
                              "px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider transition-all border shrink-0 flex items-center gap-1",
                              selectedArea === area.id ? "bg-ink-900 border-ink-900 text-white shadow-sm" : "bg-ink-50 text-ink-500 border-ink-200"
                            )}
                          >
                            <AreaIcon area={area.id} size={8} />
                            {area.label}
                          </button>
                        ))}
                      </div>

                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                        <input
                          placeholder="Buscar máscara técnica do exame..."
                          className="w-full h-9 pl-9 pr-3 bg-white border border-ink-200 rounded-lg focus:border-ink-400 outline-none font-bold text-ink-900 text-xs"
                          value={templateSearchQuery}
                          onChange={(e) => setTemplateSearchQuery(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-1.5 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                        {filteredTemplates.map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedTemplateId(t.id)}
                            className="w-full flex items-center justify-between p-2 rounded-lg bg-white border border-ink-200 hover:border-ink-400 transition-all text-left shadow-sm text-xs font-bold"
                          >
                            <span>{t.name}</span>
                            <ChevronRight size={12} className="text-ink-350" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-ink-200 shadow-sm space-y-4">
              <h3 className="font-black text-ink-900 text-xs uppercase tracking-wider flex items-center gap-2 border-b border-ink-100 pb-3">
                <CalendarDays size={14} className="text-ink-400" />
                Data & Horário
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest block mb-1">Data</label>
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => {
                      setAppointmentDate(e.target.value);
                      setAppointmentTime('');
                    }}
                    className="w-full h-10 px-3 bg-white border border-ink-200 rounded-xl font-bold text-xs focus:border-ink-400 outline-none shadow-sm"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest block mb-1">Horário</label>
                  
                  {slots.length === 0 ? (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-700 text-xs font-semibold">
                      <AlertCircle size={16} />
                      <span>Sem turnos configurados ou expediente ativo para o dia selecionado.</span>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[140px] overflow-y-auto p-2 border border-ink-200 rounded-xl custom-scrollbar bg-white">
                      {Array.from(new Set(slots.map(s => s.shiftName))).map(shiftName => (
                        <div key={shiftName} className="space-y-1.5">
                          <span className="text-[8px] font-black text-ink-400 uppercase tracking-widest block px-1">{shiftName}</span>
                          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                            {slots.filter(s => s.shiftName === shiftName).map(slot => {
                              // Slot is booked by another appointment (not the one being edited)
                              const isBooked = slot.booked && slot.appointmentId !== appointment.id;
                              return (
                                <button
                                  key={slot.time}
                                  type="button"
                                  disabled={isBooked}
                                  onClick={() => setAppointmentTime(slot.time)}
                                  className={classNames(
                                    "py-2 rounded-lg text-xs font-bold text-center border transition-all active:scale-95",
                                    isBooked 
                                      ? "bg-ink-100 border-ink-200 text-ink-400 cursor-not-allowed line-through" 
                                      : appointmentTime === slot.time
                                        ? "bg-ink-900 border-ink-900 text-white shadow-sm"
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
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-ink-200 shadow-sm space-y-2">
              <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest block ml-0.5">Indicação Clínica / Observações</label>
              <textarea
                placeholder="Ex: Dor abdominal, suspeita de cálculo renal..."
                value={appointmentNotes}
                maxLength={500}
                onChange={(e) => setAppointmentNotes(e.target.value)}
                className="w-full h-16 p-3 bg-white border border-ink-200 rounded-xl font-medium text-xs focus:border-ink-400 outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-ink-100 bg-white flex items-center justify-between shrink-0 z-10">
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
            disabled={loading || !patientName.trim() || !selectedTemplateId || !selectedClinicId || !appointmentTime}
            className="px-5 h-10 bg-ink-950 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-ink-800 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Salvar Alterações
          </button>
        </div>
      </motion.div>
    </div>
  );
}
