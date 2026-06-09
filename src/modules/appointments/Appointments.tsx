import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../store/app';
import { useCollection } from '../../hooks/useFirestore';
import { addItemWithId, genId, updateItem, deleteItem, generateNumericId } from '../../store/db';
import { Patient, ReportTemplate, Clinic, ExamRequest, EXAM_AREAS, ExamArea, Appointment } from '../../types';
import { 
  Plus, Search, UserPlus, ArrowRight, Loader2, Sparkles, 
  ChevronRight, Calendar, Clock, Check, X, Building2, 
  AlertCircle, CalendarDays, FileText, Filter, RotateCcw,
  Sliders, Save, Trash2, CalendarRange, ArrowLeftRight
} from 'lucide-react';
import { classNames } from '../../utils/format';
import { getInitialReportContent } from '../templates/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaIcon } from '../../components/AreaIcon';
import { syncExamToOrthancWorklist } from '../../utils/dicom';
import { PageHeader } from '../../components/PageHeader';

interface Shift {
  id: string;
  name: string;
  start: string;
  end: string;
  slotDurationMinutes: number;
}

interface WeekdayShiftConfig {
  day: number;
  active: boolean;
  shifts: Shift[];
}

const DEFAULT_WEEKDAY_SHIFTS: WeekdayShiftConfig[] = [
  { day: 0, active: false, shifts: [] }, // Sunday
  { 
    day: 1, 
    active: true, 
    shifts: [
      { id: '1-manha', name: 'Manhã', start: '08:00', end: '12:00', slotDurationMinutes: 20 },
      { id: '1-tarde', name: 'Tarde', start: '13:00', end: '18:00', slotDurationMinutes: 20 }
    ] 
  }, // Monday
  { 
    day: 2, 
    active: true, 
    shifts: [
      { id: '2-manha', name: 'Manhã', start: '08:00', end: '12:00', slotDurationMinutes: 20 },
      { id: '2-tarde', name: 'Tarde', start: '13:00', end: '18:00', slotDurationMinutes: 20 }
    ] 
  }, // Tuesday
  { 
    day: 3, 
    active: true, 
    shifts: [
      { id: '3-manha', name: 'Manhã', start: '08:00', end: '12:00', slotDurationMinutes: 20 },
      { id: '3-tarde', name: 'Tarde', start: '13:00', end: '18:00', slotDurationMinutes: 20 }
    ] 
  }, // Wednesday
  { 
    day: 4, 
    active: true, 
    shifts: [
      { id: '4-manha', name: 'Manhã', start: '08:00', end: '12:00', slotDurationMinutes: 20 },
      { id: '4-tarde', name: 'Tarde', start: '13:00', end: '18:00', slotDurationMinutes: 20 }
    ] 
  }, // Thursday
  { 
    day: 5, 
    active: true, 
    shifts: [
      { id: '5-manha', name: 'Manhã', start: '08:00', end: '12:00', slotDurationMinutes: 20 },
      { id: '5-tarde', name: 'Tarde', start: '13:00', end: '18:00', slotDurationMinutes: 20 }
    ] 
  }, // Friday
  { day: 6, active: false, shifts: [] }, // Saturday
];

function getLocalDateStr(dateOrTimestamp: Date | number | string): string {
  if (typeof dateOrTimestamp === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOrTimestamp)) {
    return dateOrTimestamp;
  }
  const d = typeof dateOrTimestamp === 'string'
    ? new Date(dateOrTimestamp.includes('T') ? dateOrTimestamp : `${dateOrTimestamp}T00:00:00`)
    : new Date(dateOrTimestamp);
  
  if (isNaN(d.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function findNextAvailableDate(clinic: Clinic, startingFromStr: string, appointments: Appointment[]): string {
  const config = clinic.schedulingConfig;
  const shiftsConfig = config?.weekdayShifts || DEFAULT_WEEKDAY_SHIFTS;

  let date = new Date(startingFromStr.includes('T') ? startingFromStr : `${startingFromStr}T00:00:00`);
  
  for (let i = 0; i < 30; i++) {
    const dateStr = getLocalDateStr(date);
    const dayOfWeek = date.getDay();
    const daySetting = shiftsConfig.find(bh => bh.day === dayOfWeek);
    
    if (daySetting && daySetting.active && daySetting.shifts && daySetting.shifts.length > 0) {
      const bookedTimes = appointments
        .filter(app => {
          if (app.clinicId !== clinic.id || app.status === 'cancelado') return false;
          const appDateStr = getLocalDateStr(app.scheduledAt);
          return appDateStr === dateStr;
        })
        .map(app => {
          const appDate = new Date(app.scheduledAt);
          const h = String(appDate.getHours()).padStart(2, '0');
          const m = String(appDate.getMinutes()).padStart(2, '0');
          return `${h}:${m}`;
        });

      let hasFreeSlot = false;
      
      for (const shift of daySetting.shifts) {
        const [startH, startM] = shift.start.split(':').map(Number);
        const [endH, endM] = shift.end.split(':').map(Number);

        let currentMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        const duration = shift.slotDurationMinutes || 20;

        while (currentMinutes + duration <= endMinutes) {
          const h = String(Math.floor(currentMinutes / 60)).padStart(2, '0');
          const m = String(currentMinutes % 60).padStart(2, '0');
          const timeStr = `${h}:${m}`;

          if (!bookedTimes.includes(timeStr)) {
            hasFreeSlot = true;
            break;
          }
          currentMinutes += duration;
        }
        if (hasFreeSlot) break;
      }

      if (hasFreeSlot) {
        return dateStr;
      }
    }
    date.setDate(date.getDate() + 1);
  }
  
  return startingFromStr;
}


export function Appointments() {
  const { setView, selectedClinicId, showToast, settings, setCreateExamDefaultPatient } = useApp();
  const { data: appointments, loading: loadingAppointments } = useCollection<Appointment>('appointments');
  const { data: patients } = useCollection<Patient>('patients');
  const { data: templates } = useCollection<ReportTemplate>('templates');
  const { data: clinics } = useCollection<Clinic>('clinics');

  const [activeTab, setActiveTab] = useState<'agendamentos' | 'configuracao'>('agendamentos');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'agendado' | 'confirmado' | 'cancelado'>('todos');
  const [dateFilter, setDateFilter] = useState<string>(getLocalDateStr(new Date()));
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Advanced Confirmation & Cancel Modals
  const [confirmingApp, setConfirmingApp] = useState<Appointment | null>(null);
  const [cancelingApp, setCancelingApp] = useState<Appointment | null>(null);
  const [deletingApp, setDeletingApp] = useState<Appointment | null>(null);
  const [autoRedirectToReport, setAutoRedirectToReport] = useState(true);
  const [selectedConfirmDeviceId, setSelectedConfirmDeviceId] = useState<string>(settings.dicomDevices?.[0]?.id || '');

  // Clinic Config Tab State
  const [configClinicId, setConfigClinicId] = useState<string>('');
  const [configWeekdayShifts, setConfigWeekdayShifts] = useState<WeekdayShiftConfig[]>(DEFAULT_WEEKDAY_SHIFTS);

  // Modal State (Create Appointment)
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
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
  const [appointmentDate, setAppointmentDate] = useState<string>(getLocalDateStr(new Date()));
  const [appointmentTime, setAppointmentTime] = useState<string>('');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(settings.dicomDevices?.[0]?.id || '');

  // Set default clinic in modal & config clinic initially
  useEffect(() => {
    if (clinics.length > 0) {
      if (!selectedClinic) {
        const initial = clinics.find(c => c.id === selectedClinicId) || clinics[0];
        setSelectedClinic(initial);
      }
      if (!configClinicId) {
        setConfigClinicId(selectedClinicId || clinics[0].id);
      }
    }
  }, [clinics, selectedClinicId, selectedClinic, configClinicId, showCreateModal]);

  // Automatically select the next day with active shifts and free slots when modal opens or clinic changes
  useEffect(() => {
    if (showCreateModal && selectedClinic && appointments) {
      const todayStr = getLocalDateStr(new Date());
      const nextDate = findNextAvailableDate(selectedClinic, todayStr, appointments);
      setAppointmentDate(nextDate);
    }
  }, [showCreateModal, selectedClinic]);

  // Load clinic config for settings tab
  useEffect(() => {
    if (configClinicId) {
      const clinic = clinics.find(c => c.id === configClinicId);
      if (clinic) {
        setConfigWeekdayShifts(clinic.schedulingConfig?.weekdayShifts || DEFAULT_WEEKDAY_SHIFTS);
      }
    }
  }, [configClinicId, clinics]);

  // Weekly Calendar Navigation (Generates today + next 6 days)
  const weeklyDays = useMemo(() => {
    const days = [];
    const baseDate = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const dateStr = getLocalDateStr(d);
      
      // Count total appointments for this day
      const count = appointments.filter(app => {
        const dStr = getLocalDateStr(app.scheduledAt);
        return dStr === dateStr && app.status !== 'cancelado';
      }).length;

      days.push({
        dateStr,
        dayNum: d.getDate(),
        dayLabel: d.toLocaleDateString('pt-BR', { weekday: 'short' }).substring(0, 3),
        count
      });
    }
    return days;
  }, [appointments]);

  // Filtered appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter(app => {
      const matchesClinic = !selectedClinicId || app.clinicId === selectedClinicId;
      const matchesStatus = statusFilter === 'todos' || app.status === statusFilter;
      const matchesSearch = !search || 
        app.patientName.toLowerCase().includes(search.toLowerCase()) ||
        app.examType.toLowerCase().includes(search.toLowerCase());
      
      const appDateStr = getLocalDateStr(app.scheduledAt);
      const matchesDate = !dateFilter || appDateStr === dateFilter;

      return matchesClinic && matchesStatus && matchesSearch && matchesDate;
    }).sort((a, b) => a.scheduledAt - b.scheduledAt);
  }, [appointments, selectedClinicId, statusFilter, search, dateFilter]);

  // Patients filtering for modal
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

  // Auto-open quick patient registration in modal search
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

  // Templates filtering for modal
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

  // Generate dynamic slots for selected clinic & date (integrating multiple shifts)
  const generatedSlots = useMemo(() => {
    if (!selectedClinic || !appointmentDate) return [];

    const date = new Date(appointmentDate.includes('T') ? appointmentDate : `${appointmentDate}T00:00:00`);
    const dayOfWeek = date.getDay();

    const config = selectedClinic.schedulingConfig;
    const shiftsConfig = config?.weekdayShifts || DEFAULT_WEEKDAY_SHIFTS;

    const daySetting = shiftsConfig.find(bh => bh.day === dayOfWeek);
    if (!daySetting || !daySetting.active || !daySetting.shifts || daySetting.shifts.length === 0) return [];

    // Find booked appointments
    const bookedTimes = appointments
      .filter(app => {
        if (app.clinicId !== selectedClinic.id || app.status === 'cancelado') return false;
        const appDateStr = getLocalDateStr(app.scheduledAt);
        return appDateStr === appointmentDate;
      })
      .map(app => {
        const appDate = new Date(app.scheduledAt);
        const h = String(appDate.getHours()).padStart(2, '0');
        const m = String(appDate.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
      });

    const slots: { time: string; booked: boolean; shiftName: string }[] = [];

    // Generate slots for each shift
    daySetting.shifts.forEach(shift => {
      const [startH, startM] = shift.start.split(':').map(Number);
      const [endH, endM] = shift.end.split(':').map(Number);

      let currentMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      const duration = shift.slotDurationMinutes || 20;

      while (currentMinutes + duration <= endMinutes) {
        const h = String(Math.floor(currentMinutes / 60)).padStart(2, '0');
        const m = String(currentMinutes % 60).padStart(2, '0');
        const timeStr = `${h}:${m}`;

        slots.push({
          time: timeStr,
          booked: bookedTimes.includes(timeStr),
          shiftName: shift.name
        });

        currentMinutes += duration;
      }
    });

    return slots.sort((a, b) => a.time.localeCompare(b.time));
  }, [selectedClinic, appointmentDate, appointments]);

  // Quick Patient registration
  const handleQuickPatient = async () => {
    if (!newPatientName.trim()) return;
    setLoading(true);
    try {
      const patientId = `P-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const newP: Patient = {
        id: patientId,
        name: newPatientName.trim(),
        birthDate: newPatientBirthDate || undefined,
        gender: newPatientGender,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await addItemWithId('patients', patientId, newP as any);
      setSelectedPatient(newP);
      setShowQuickPatient(false);
      setNewPatientName('');
      setNewPatientBirthDate('');
      setNewPatientGender('F');
      showToast('Paciente registrado com sucesso!');
      setModalStep(2);
    } catch (err) {
      showToast('Erro ao criar paciente', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Sound notification effect
  const playSuccessSound = () => {
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
  };

  // Save Clinic Scheduling Config
  const handleSaveClinicConfig = async () => {
    if (!configClinicId) return;
    setLoading(true);
    try {
      await updateItem('clinics', configClinicId, {
        schedulingConfig: {
          weekdayShifts: configWeekdayShifts
        }
      });
      showToast('Configurações de turnos salvas com sucesso!', 'success');
      setActiveTab('agendamentos');
    } catch (err) {
      console.error(err);
      showToast('Erro ao salvar turnos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Save Appointment
  const handleCreateAppointment = async () => {
    if (!selectedPatient || !selectedTemplate || !selectedClinic || !appointmentTime) {
      showToast('Preencha todos os campos obrigatórios e selecione um horário!', 'error');
      return;
    }
    setLoading(true);
    try {
      const [year, month, day] = appointmentDate.split('-').map(Number);
      const [hours, minutes] = appointmentTime.split(':').map(Number);
      const scheduledDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
      const appointmentData: Omit<Appointment, 'id'> = {
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        patientBirthDate: selectedPatient.birthDate,
        patientGender: selectedPatient.gender,
        clinicId: selectedClinic.id,
        area: selectedTemplate.area,
        examType: selectedTemplate.name,
        templateId: selectedTemplate.id,
        scheduledAt: scheduledDateTime.getTime(),
        status: 'agendado',
        notes: appointmentNotes.trim() || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      const id = genId('appointments');
      await addItemWithId('appointments', id, appointmentData as any);
      showToast('Agendamento cadastrado com sucesso!');
      setShowCreateModal(false);
      resetModal();
    } catch (error) {
      console.error(error);
      showToast('Erro ao criar agendamento', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Confirm Appointment & Send to Worklist/PACS (Advanced confirmation)
  const handleConfirmAppointment = async () => {
    if (!confirmingApp) return;
    setLoading(true);
    try {
      const examData: Partial<ExamRequest> = {
        friendlyId: generateNumericId(),
        patientId: confirmingApp.patientId,
        clinicId: confirmingApp.clinicId,
        area: confirmingApp.area,
        examType: confirmingApp.examType,
        templateId: confirmingApp.templateId,
        status: 'pendente',
        scheduledAt: confirmingApp.scheduledAt,
        clinicalIndication: confirmingApp.notes || undefined,
        examDate: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const template = templates.find(t => t.id === confirmingApp.templateId);
      if (template) {
        examData.reportContent = getInitialReportContent(template);
        examData.consentTerm = template.consentTemplate || undefined;
      }

      const examId = genId('exams');
      await addItemWithId('exams', examId, examData as any);

      const patientData = {
        id: confirmingApp.patientId,
        name: confirmingApp.patientName,
        birthDate: confirmingApp.patientBirthDate,
        gender: confirmingApp.patientGender
      };
      
      const { success, error } = await syncExamToOrthancWorklist(
        examId,
        confirmingApp.examType,
        patientData,
        settings,
        selectedConfirmDeviceId,
        examData.examDate
      );

      if (!success) {
        console.warn('[Orthanc Sync] Falha ao enviar para o worklist local:', error);
      }

      await updateItem('appointments', confirmingApp.id, { status: 'confirmado' });

      playSuccessSound();
      showToast('Agendamento confirmado com sucesso!');
      
      const targetId = examId;
      setConfirmingApp(null);

      // Redirect immediately to report editor if checked
      if (autoRedirectToReport) {
        setView({ name: 'exam-editor', examId: targetId });
      }
    } catch (error) {
      console.error(error);
      showToast('Erro ao confirmar agendamento', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Cancel Appointment
  const handleCancelAppointment = async () => {
    if (!cancelingApp) return;
    try {
      await updateItem('appointments', cancelingApp.id, { status: 'cancelado' });
      showToast('Agendamento cancelado.');
      setCancelingApp(null);
    } catch (error) {
      console.error(error);
      showToast('Erro ao cancelar agendamento', 'error');
    }
  };

  // Delete Appointment
  const handleDeleteAppointment = async () => {
    if (!deletingApp) return;
    try {
      await deleteItem('appointments', deletingApp.id);
      showToast('Agendamento excluído permanentemente.');
      setDeletingApp(null);
    } catch (error) {
      console.error(error);
      showToast('Erro ao excluir agendamento', 'error');
    }
  };

  const resetModal = () => {
    setModalStep(1);
    setPatientSearch('');
    setTemplateSearch('');
    setShowQuickPatient(false);
    setSelectedPatient(null);
    setSelectedTemplate(null);
    setAppointmentNotes('');
    setAppointmentDate(getLocalDateStr(new Date()));
    setAppointmentTime('');
  };

  const handleWeekdayConfigActiveChange = (day: number, active: boolean) => {
    setConfigWeekdayShifts(prev => 
      prev.map(bh => bh.day === day ? { ...bh, active, shifts: active && bh.shifts.length === 0 ? [{ id: Math.random().toString(36).substr(2, 9), name: 'Manhã', start: '08:00', end: '12:00', slotDurationMinutes: 20 }] : bh.shifts } : bh)
    );
  };

  const handleAddShift = (day: number) => {
    setConfigWeekdayShifts(prev => 
      prev.map(bh => {
        if (bh.day === day) {
          const newShift: Shift = {
            id: Math.random().toString(36).substr(2, 9),
            name: bh.shifts.length === 0 ? 'Manhã' : bh.shifts.length === 1 ? 'Tarde' : 'Noite',
            start: bh.shifts.length === 0 ? '08:00' : bh.shifts.length === 1 ? '13:00' : '18:00',
            end: bh.shifts.length === 0 ? '12:00' : bh.shifts.length === 1 ? '18:00' : '22:00',
            slotDurationMinutes: 20
          };
          return { ...bh, shifts: [...bh.shifts, newShift] };
        }
        return bh;
      })
    );
  };

  const handleRemoveShift = (day: number, shiftId: string) => {
    setConfigWeekdayShifts(prev => 
      prev.map(bh => bh.day === day ? { ...bh, shifts: bh.shifts.filter(s => s.id !== shiftId) } : bh)
    );
  };

  const handleShiftValueChange = (day: number, shiftId: string, field: keyof Shift, value: any) => {
    setConfigWeekdayShifts(prev => 
      prev.map(bh => bh.day === day ? {
        ...bh,
        shifts: bh.shifts.map(s => s.id === shiftId ? { ...s, [field]: value } : s)
      } : bh)
    );
  };

  const weekdaysLabels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  return (
    <div className="module-container">
      <div className="max-w-7xl mx-auto w-full animate-fade-in space-y-6">
        <PageHeader
          title="Agendamentos & Recepção"
          subtitle="Gerencie a agenda de exames, crie fichas rápidas de pacientes e sincronize diretamente com a Worklist."
          actions={
            <div className="flex gap-2">
              <button
                className={classNames(
                  "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border flex items-center gap-2",
                  activeTab === 'configuracao'
                    ? "bg-slate-900 border-slate-900 text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                )}
                onClick={() => setActiveTab(activeTab === 'configuracao' ? 'agendamentos' : 'configuracao')}
              >
                <Sliders size={16} />
                <span>Configurar Turnos</span>
              </button>
              <button 
                className="btn-primary h-11 px-6 rounded-2xl shadow-brand flex items-center gap-2" 
                onClick={() => { resetModal(); setShowCreateModal(true); }}
              >
                <Plus size={18} />
                <span className="font-bold text-xs uppercase tracking-widest">Novo Agendamento</span>
              </button>
            </div>
          }
        />

        {activeTab === 'configuracao' ? (
          /* CONFIGURATION TAB */
          <div className="bg-white border border-ink-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-8 max-w-5xl mx-auto">
            <div className="flex items-center gap-3 border-b border-ink-50 pb-4">
              <Sliders className="text-brand-600" size={22} />
              <div>
                <h3 className="font-black text-slate-900 text-lg leading-tight">Configurações de Agenda & Turnos</h3>
                <p className="text-xs text-ink-500">Defina múltiplos turnos de trabalho (Manhã, Tarde, Noite...) por dia e parametrize a duração do exame de cada um.</p>
              </div>
            </div>

            <div>
              <label className="label">Unidade / Clínica</label>
              <select
                value={configClinicId}
                onChange={(e) => setConfigClinicId(e.target.value)}
                className="w-full max-w-sm h-12 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-955 focus:border-slate-400 outline-none"
              >
                {clinics.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* EXPEDIENTE POR DIA E TURNOS */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2">Turnos por Dia da Semana</h4>
              
              <div className="space-y-6">
                {configWeekdayShifts.map((bh) => (
                  <div key={bh.day} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id={`active-day-${bh.day}`}
                          checked={bh.active}
                          onChange={(e) => handleWeekdayConfigActiveChange(bh.day, e.target.checked)}
                          className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500/20 cursor-pointer"
                        />
                        <label htmlFor={`active-day-${bh.day}`} className="font-black text-slate-900 text-sm cursor-pointer select-none">
                          {weekdaysLabels[bh.day]}
                        </label>
                      </div>
                      
                      {bh.active && (
                        <button
                          type="button"
                          onClick={() => handleAddShift(bh.day)}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all"
                        >
                          <Plus size={12} />
                          Adicionar Turno
                        </button>
                      )}
                    </div>

                    {bh.active ? (
                      bh.shifts.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Nenhum turno configurado. Adicione um turno para este dia.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {bh.shifts.map((shift) => (
                            <div key={shift.id} className="p-4 rounded-xl bg-white border border-slate-250/50 shadow-sm space-y-3 relative group">
                              <button
                                type="button"
                                onClick={() => handleRemoveShift(bh.day, shift.id)}
                                className="absolute top-3 right-3 p-1.5 text-slate-350 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
                                title="Excluir Turno"
                              >
                                <Trash2 size={14} />
                              </button>

                              <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nome do Turno</label>
                                <input
                                  type="text"
                                  value={shift.name}
                                  onChange={(e) => handleShiftValueChange(bh.day, shift.id, 'name', e.target.value)}
                                  className="w-full h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:border-slate-400 outline-none"
                                  placeholder="Ex: Manhã, Tarde, Noturno"
                                />
                              </div>

                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Início</label>
                                  <input
                                    type="time"
                                    value={shift.start}
                                    onChange={(e) => handleShiftValueChange(bh.day, shift.id, 'start', e.target.value)}
                                    className="w-full h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fim</label>
                                  <input
                                    type="time"
                                    value={shift.end}
                                    onChange={(e) => handleShiftValueChange(bh.day, shift.id, 'end', e.target.value)}
                                    className="w-full h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tempo de Exame</label>
                                  <select
                                    value={shift.slotDurationMinutes || 20}
                                    onChange={(e) => handleShiftValueChange(bh.day, shift.id, 'slotDurationMinutes', Number(e.target.value))}
                                    className="w-full h-9 px-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none cursor-pointer"
                                  >
                                    <option value={10}>10 min</option>
                                    <option value={15}>15 min</option>
                                    <option value={20}>20 min</option>
                                    <option value={30}>30 min</option>
                                    <option value={40}>40 min</option>
                                    <option value={45}>45 min</option>
                                    <option value={60}>60 min</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    ) : (
                      <span className="text-[9px] font-black uppercase text-rose-500 tracking-wider">Fechado / Sem expediente</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-slate-100">
              <button
                onClick={handleSaveClinicConfig}
                disabled={loading}
                className="flex-1 h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-sm shadow-premium flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Salvar Configurações de Turnos
              </button>
              <button
                onClick={() => setActiveTab('agendamentos')}
                className="h-14 px-6 border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-2xl font-bold text-xs uppercase tracking-wider"
              >
                Voltar
              </button>
            </div>
          </div>
        ) : (
          /* APPOINTMENTS LIST TAB */
          <>
            {/* WEEKLY CALENDAR SLIDER */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
              {weeklyDays.map((day) => {
                const isSelected = dateFilter === day.dateStr;
                return (
                  <button
                    key={day.dateStr}
                    onClick={() => setDateFilter(day.dateStr)}
                    className={classNames(
                      "flex flex-col items-center justify-center min-w-[70px] py-3 rounded-2xl border transition-all duration-300 relative active:scale-95 shadow-sm",
                      isSelected
                        ? "bg-slate-900 border-slate-900 text-white shadow-md scale-105"
                        : "bg-white border-slate-200 hover:border-slate-400 text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-wider opacity-65 mb-1">{day.dayLabel}</span>
                    <span className="text-lg font-black leading-none">{day.dayNum}</span>
                    
                    {/* Badge indicator */}
                    {day.count > 0 && (
                      <span className={classNames(
                        "absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full text-[8px] font-black flex items-center justify-center px-1 shadow-sm ring-2 border-none",
                        isSelected ? "bg-emerald-500 text-white ring-slate-900" : "bg-slate-900 text-white ring-white"
                      )}>
                        {day.count}
                      </span>
                    )}
                  </button>
                );
              })}
              
              <div className="h-10 w-[1px] bg-slate-200 mx-2 shrink-0" />
              
              {/* Datepicker trigger */}
              <div className="relative">
                <CalendarRange size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="h-14 pl-9 pr-3 py-2 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-2xl outline-none focus:border-slate-400 shadow-sm"
                />
              </div>
            </div>

            {/* Toolbar & Filters */}
            <div className="bg-white border border-ink-100 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="text"
                    placeholder="Buscar por paciente ou tipo de exame..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input pl-12 py-3 h-12 text-sm shadow-sm border-ink-200 focus:border-brand-500 w-full"
                  />
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {[
                    { id: 'todos', label: 'Todos os Status' },
                    { id: 'agendado', label: 'Agendados' },
                    { id: 'confirmado', label: 'Confirmados' },
                    { id: 'cancelado', label: 'Cancelados' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setStatusFilter(f.id as any)}
                      className={classNames(
                        "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border",
                        statusFilter === f.id
                          ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                  
                  {(search || statusFilter !== 'todos' || dateFilter) && (
                    <button 
                      onClick={() => { setSearch(''); setStatusFilter('todos'); setDateFilter(getLocalDateStr(new Date())); }}
                      className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all flex items-center justify-center"
                      title="Hoje / Limpar"
                    >
                      <RotateCcw size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Appointment Grid / List */}
            <div className="space-y-4 pb-20">
              {loadingAppointments ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-28 bg-white border border-ink-100 rounded-3xl animate-pulse" />
                  ))}
                </div>
              ) : filteredAppointments.length === 0 ? (
                <div className="text-center py-20 bg-white border border-ink-100 rounded-3xl">
                  <CalendarDays size={48} className="mx-auto text-ink-200 mb-4 animate-pulse" />
                  <h4 className="text-sm font-black text-ink-700 uppercase tracking-widest">Nenhum Agendamento Localizado</h4>
                  <p className="text-xs text-ink-400 mt-1">Experimente navegar pelo calendário acima ou clique para criar um novo.</p>
                  <button 
                    onClick={() => { resetModal(); setShowCreateModal(true); }}
                    className="mt-5 px-5 py-2.5 bg-slate-900 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all shadow-sm active:scale-95"
                  >
                    Novo Agendamento
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredAppointments.map(app => {
                    const appTime = new Date(app.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const appDateStr = new Date(app.scheduledAt).toLocaleDateString('pt-BR');
                    const clinic = clinics.find(c => c.id === app.clinicId);

                    return (
                      <motion.div
                        key={app.id}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={classNames(
                          "bg-white border rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group",
                          app.status === 'confirmado' ? "border-emerald-100 bg-emerald-50/10" : 
                          app.status === 'cancelado' ? "border-rose-100 bg-rose-50/10" : "border-ink-100"
                        )}
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none overflow-hidden">
                          <div className={classNames(
                            "absolute transform rotate-45 text-center text-[8px] font-black uppercase tracking-widest py-1 w-[120px] top-4 -right-8 shadow-sm",
                            app.status === 'confirmado' ? "bg-emerald-500 text-white" :
                            app.status === 'cancelado' ? "bg-rose-500 text-white" : "bg-blue-500 text-white"
                          )}>
                            {app.status}
                          </div>
                        </div>

                        <div className="space-y-3 pr-10">
                          <div className="flex items-center gap-3 text-xs text-ink-500">
                            <span className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wide">
                              <Clock size={12} /> {appTime}
                            </span>
                            <span className="font-semibold">{appDateStr}</span>
                            {clinic && (
                              <span className="flex items-center gap-1 text-[10px] font-black text-brand-600 truncate max-w-[150px]">
                                <Building2 size={10} /> {clinic.name}
                              </span>
                            )}
                          </div>

                          <div>
                            <h3 className="font-black text-ink-900 text-base leading-tight truncate group-hover:text-brand-600 transition-colors">
                              {app.patientName}
                            </h3>
                            <p className="text-[10px] text-ink-400 font-bold uppercase tracking-wider mt-0.5">
                              ID: {app.patientId} {app.patientBirthDate ? `• Nascimento: ${app.patientBirthDate}` : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200/60 p-2.5 rounded-xl">
                            <AreaIcon area={app.area} size={14} className="text-slate-400" />
                            <span className="truncate">{app.examType}</span>
                          </div>

                          {app.notes && (
                            <p className="text-[11px] text-ink-500 italic bg-ink-50 p-2.5 rounded-xl border border-ink-100/30 truncate" title={app.notes}>
                              Obs: {app.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2.5 mt-5 pt-4 border-t border-ink-50">
                          {app.status === 'agendado' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedConfirmDeviceId(settings.dicomDevices?.[0]?.id || '');
                                  setConfirmingApp(app);
                                }}
                                className="flex-1 h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                              >
                                <Check size={14} /> Confirmar & Lançar
                              </button>
                              <button
                                onClick={() => setCancelingApp(app)}
                                className="p-2.5 text-amber-600 hover:text-white hover:bg-amber-600 border border-amber-250 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-sm"
                                title="Cancelar Agendamento"
                              >
                                <X size={14} />
                              </button>
                              <button
                                onClick={() => setDeletingApp(app)}
                                className="p-2.5 text-rose-500 hover:text-white hover:bg-rose-600 border border-rose-200 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-sm"
                                title="Excluir Agendamento"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}

                          {app.status === 'confirmado' && (
                            <>
                              <div className="flex-1 text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl flex items-center gap-1.5 justify-center shadow-inner">
                                <Check size={14} /> EXAME ENVIADO PARA A WORKLIST PACS
                              </div>
                              <button
                                onClick={() => setDeletingApp(app)}
                                className="p-2.5 text-rose-500 hover:text-white hover:bg-rose-600 border border-rose-200 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-sm shrink-0"
                                title="Excluir Agendamento"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}

                          {app.status === 'cancelado' && (
                            <>
                              <div className="flex-1 text-[10px] font-black text-rose-650 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl flex items-center gap-1.5 w-full justify-center shadow-inner">
                                <AlertCircle size={14} /> AGENDAMENTO CANCELADO
                              </div>
                              <button
                                onClick={() => setDeletingApp(app)}
                                className="p-2.5 text-rose-500 hover:text-white hover:bg-rose-600 border border-rose-200 rounded-xl transition-all active:scale-95 flex items-center justify-center shadow-sm shrink-0"
                                title="Excluir Agendamento"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* CREATE APPOINTMENT MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <motion.div 
              initial={{ scale: 0.96, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 20 }}
              className="bg-white rounded-[2rem] shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] relative modal-mobile-sheet"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white z-10 relative">
                <div className="flex items-center gap-4">
                  <div className="relative w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
                    <CalendarDays size={18} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 leading-tight">Novo Agendamento</h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse"></span>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">Recepção & Triagem</p>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setShowCreateModal(false)} 
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-all active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Progress Steps */}
              <div className="bg-ink-50/80 backdrop-blur-sm px-6 py-3 flex items-center gap-2.5 border-b border-ink-150 shrink-0">
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
                          "w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black shadow-sm",
                          isActive || isPast ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"
                        )}>
                          {s.step}
                        </div>
                        <span className={classNames(
                          "text-[9px] font-black uppercase tracking-wider",
                          isActive ? "text-slate-900" : isPast ? "text-slate-600" : "text-slate-400"
                        )}>{s.label}</span>
                      </button>
                      {idx < 2 && <div className="w-4 h-0.5 bg-slate-200" />}
                    </div>
                  );
                })}
              </div>

              {/* Body */}
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
                        <div className="pb-4 border-b border-slate-100">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-1.5 block">Unidade de Agendamento</label>
                          <select
                            value={selectedClinic?.id || ''}
                            onChange={(e) => {
                              const c = clinics.find(x => x.id === e.target.value);
                              if (c) setSelectedClinic(c);
                            }}
                            className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900 focus:border-slate-400 outline-none"
                          >
                            {clinics.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {selectedPatient ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-black text-lg shrink-0">
                                {selectedPatient.name.charAt(0)}
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-slate-900">{selectedPatient.name}</h4>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                  ID: {selectedPatient.id} {selectedPatient.birthDate ? `• Nascimento: ${selectedPatient.birthDate}` : ''}
                                </p>
                              </div>
                            </div>
                            <button 
                              onClick={() => setSelectedPatient(null)}
                              className="p-2 text-slate-400 hover:text-rose-500 rounded-lg border border-slate-200 hover:bg-rose-50 transition-all active:scale-95"
                            >
                              <RotateCcw size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-black text-slate-900 text-sm">Quem é o paciente?</h3>
                            <button 
                              onClick={handleToggleQuickPatient}
                              className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-[9px] uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm"
                            >
                              {showQuickPatient ? <ArrowRight size={12} className="rotate-180" /> : <UserPlus size={12} />}
                              {showQuickPatient ? 'Voltar' : 'Registrar Rápido'}
                            </button>
                          </div>

                          {showQuickPatient ? (
                            <div className="space-y-4 p-5 rounded-[1.5rem] bg-slate-50 border border-slate-200 shadow-sm">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
                                  <label className="text-[9px] font-black text-slate-700 uppercase tracking-widest ml-1 mb-1.5 block">Nome do Paciente *</label>
                                  <input
                                    type="text"
                                    placeholder="Ex: Maria Oliveira Santos"
                                    className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl focus:border-slate-400 outline-none transition-all font-bold text-xs text-slate-900"
                                    value={newPatientName}
                                    onChange={(e) => setNewPatientName(e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] font-black text-slate-700 uppercase tracking-widest ml-1 mb-1.5 block">Nascimento (Opcional)</label>
                                  <input
                                    type="date"
                                    className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl focus:border-slate-400 outline-none transition-all font-bold text-xs text-slate-900"
                                    value={newPatientBirthDate}
                                    onChange={(e) => setNewPatientBirthDate(e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] font-black text-slate-700 uppercase tracking-widest ml-1 mb-1.5 block">Sexo</label>
                                  <select
                                    className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl focus:border-slate-400 outline-none transition-all font-bold text-xs text-slate-900 appearance-none cursor-pointer"
                                    value={newPatientGender}
                                    onChange={(e) => setNewPatientGender(e.target.value as any)}
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
                                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                              >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                Registrar e Continuar
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="relative">
                                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                  placeholder="Buscar paciente por nome, ID ou nascimento..."
                                  className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-slate-400 focus:bg-white outline-none transition-all font-bold text-sm text-slate-900"
                                  value={patientSearch}
                                  onChange={(e) => setPatientSearch(e.target.value)}
                                />
                              </div>

                              <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-1.5 custom-scrollbar">
                                {filteredPatients.map(p => (
                                  <button
                                    key={p.id}
                                    onClick={() => { setSelectedPatient(p); setPatientSearch(''); setModalStep(2); }}
                                    className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 hover:border-slate-400 transition-all text-left shadow-sm group"
                                  >
                                    <div>
                                      <p className="font-bold text-slate-955 text-xs truncate">{p.name}</p>
                                      <p className="text-[8px] text-slate-400 font-mono mt-0.5 truncate">{p.id} {p.birthDate ? `• ${p.birthDate}` : ''}</p>
                                    </div>
                                    <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-955" />
                                  </button>
                                ))}
                                {patientSearch.trim() && !hasExactMatch && (
                                  <button
                                    onClick={() => { setNewPatientName(patientSearch.trim()); setShowQuickPatient(true); }}
                                    className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-dashed border-slate-300 hover:border-slate-400 transition-all font-bold text-slate-700"
                                  >
                                    <span className="text-xs truncate">Cadastrar "{patientSearch.trim()}"</span>
                                    <Sparkles size={12} className="text-slate-400" />
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
                          onClick={() => setSelectedArea('todas')}
                          className={classNames(
                            "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border shrink-0",
                            selectedArea === 'todas' ? "bg-slate-955 text-white bg-slate-900 border-slate-900 shadow-sm" : "bg-slate-50 text-slate-500"
                          )}
                        >
                          Todas
                        </button>
                        {EXAM_AREAS.map(area => (
                          <button
                            key={area.id}
                            onClick={() => setSelectedArea(area.id)}
                            className={classNames(
                              "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border shrink-0 flex items-center gap-1.5",
                              selectedArea === area.id ? "bg-slate-955 text-white bg-slate-900 border-slate-900 shadow-sm" : "bg-slate-50 text-slate-500"
                            )}
                          >
                            <AreaIcon area={area.id} size={10} />
                            {area.label}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-3">
                        <div className="relative">
                          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            placeholder="Buscar máscara técnica do exame..."
                            className="w-full h-11 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-400 outline-none transition-all font-bold text-slate-900 text-xs"
                            value={templateSearch}
                            onChange={(e) => setTemplateSearch(e.target.value)}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1.5 custom-scrollbar">
                          {filteredTemplates.map(t => (
                            <button
                              key={t.id}
                              onClick={() => { setSelectedTemplate(t); setTemplateSearch(''); setModalStep(3); }}
                              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-450 transition-all text-left shadow-sm group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-450">
                                  <AreaIcon area={t.area} size={12} />
                                </div>
                                <div>
                                  <p className="font-bold text-slate-955 text-xs">{t.name}</p>
                                  <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">{t.area}</p>
                                </div>
                              </div>
                              <ChevronRight size={14} className="text-slate-300" />
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
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Procedimento Selecionado</p>
                        <h4 className="text-sm font-black text-slate-900 mt-1">{selectedTemplate.name}</h4>
                      </div>

                      <div className="flex flex-col space-y-2.5">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Data do Agendamento</label>
                        <input
                          type="date"
                          value={appointmentDate}
                          onChange={(e) => { setAppointmentDate(e.target.value); setAppointmentTime(''); }}
                          className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl font-bold text-xs focus:border-slate-400 outline-none shadow-sm"
                        />
                      </div>

                      <div className="space-y-2.5">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Escolha um Horário Disponível</label>
                        
                        {generatedSlots.length === 0 ? (
                          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-700 text-xs font-semibold">
                            <AlertCircle size={16} />
                            <span>Sem turnos configurados ou expediente ativo para o dia selecionado.</span>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[200px] overflow-y-auto p-1.5 border border-slate-100 rounded-xl custom-scrollbar">
                            {Array.from(new Set(generatedSlots.map(s => s.shiftName))).map(shiftName => (
                              <div key={shiftName} className="space-y-1.5">
                                <span className="text-[8px] font-black text-slate-450 uppercase tracking-widest block px-1">{shiftName}</span>
                                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                                  {generatedSlots.filter(s => s.shiftName === shiftName).map(slot => (
                                    <button
                                      key={slot.time}
                                      type="button"
                                      disabled={slot.booked}
                                      onClick={() => setAppointmentTime(slot.time)}
                                      className={classNames(
                                        "py-2 rounded-lg text-xs font-bold text-center border transition-all active:scale-95",
                                        slot.booked 
                                          ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed line-through" 
                                          : appointmentTime === slot.time
                                            ? "bg-slate-900 border-slate-900 text-white shadow-sm"
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

                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Indicação Clínica / Observações</label>
                        <textarea
                          placeholder="Ex: Dor abdominal, suspeita de cálculo renal..."
                          value={appointmentNotes}
                          onChange={(e) => setAppointmentNotes(e.target.value)}
                          className="w-full h-16 p-3 bg-white border border-slate-200 rounded-xl font-medium text-xs focus:border-slate-400 outline-none resize-none"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="px-6 py-5 border-t border-slate-100 bg-white flex items-center justify-between z-10 shrink-0">
                {modalStep > 1 ? (
                  <button 
                    onClick={() => setModalStep((modalStep - 1) as any)}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-900 uppercase tracking-widest"
                  >
                    Voltar
                  </button>
                ) : (
                  <div className="w-10" />
                )}

                {modalStep === 1 && selectedPatient ? (
                  <button 
                    onClick={() => setModalStep(2)}
                    className="px-5 h-10 bg-slate-950 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all flex items-center gap-1.5"
                  >
                    Prosseguir <ArrowRight size={12} />
                  </button>
                ) : modalStep === 2 && selectedTemplate ? (
                  <button 
                    onClick={() => setModalStep(3)}
                    className="px-5 h-10 bg-slate-950 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all flex items-center gap-1.5"
                  >
                    Prosseguir <ArrowRight size={12} />
                  </button>
                ) : modalStep === 3 ? (
                  <button 
                    onClick={handleCreateAppointment}
                    disabled={loading || !appointmentTime}
                    className="px-5 h-10 bg-slate-950 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    Confirmar Agendamento
                  </button>
                ) : (
                  <div className="w-10" />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PREMIUM CONFIRMATION MODAL */}
      <AnimatePresence>
        {confirmingApp && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <motion.div 
              initial={{ scale: 0.96, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 15 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden modal-mobile-sheet"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 leading-tight">Confirmar e Lançar Exame</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Integração Local com PACS Worklist</p>
                  </div>
                </div>

                <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/60 text-xs">
                  <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Paciente</span>
                    <p className="font-bold text-slate-900">{confirmingApp.patientName}</p>
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Exame / Procedimento</span>
                    <p className="font-bold text-slate-900">{confirmingApp.examType}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Horário</span>
                      <p className="font-bold text-slate-900">{new Date(confirmingApp.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Data</span>
                      <p className="font-bold text-slate-900">{new Date(confirmingApp.scheduledAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                </div>

                {settings.dicomDevices && settings.dicomDevices.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block ml-0.5">Enviar para o PACS</label>
                    <select
                      value={selectedConfirmDeviceId}
                      onChange={(e) => setSelectedConfirmDeviceId(e.target.value)}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900 focus:border-slate-450 outline-none appearance-none cursor-pointer"
                    >
                      {settings.dicomDevices.map(device => (
                        <option key={device.id} value={device.id}>{device.name} ({device.aeTitle})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="auto-redirect"
                    checked={autoRedirectToReport}
                    onChange={(e) => setAutoRedirectToReport(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-650 focus:ring-brand-500/20 cursor-pointer"
                  />
                  <label htmlFor="auto-redirect" className="text-xs font-semibold text-slate-700 select-none cursor-pointer">
                    Iniciar laudo imediatamente após confirmar
                  </label>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmingApp(null)}
                  className="px-4 py-2 border border-slate-250 hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAppointment}
                  disabled={loading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PREMIUM CANCELLATION DIALOG */}
      <AnimatePresence>
        {cancelingApp && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <motion.div 
              initial={{ scale: 0.96, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 15 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-sm w-full overflow-hidden modal-mobile-sheet"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 leading-tight">Cancelar Agendamento</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Esta ação é irreversível</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Tem certeza que deseja cancelar o agendamento de **{cancelingApp.patientName}** para o procedimento de **{cancelingApp.examType}**?
                </p>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCancelingApp(null)}
                  className="px-4 py-2 border border-slate-250 hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  Manter Ativo
                </button>
                <button
                  type="button"
                  onClick={handleCancelAppointment}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
                >
                  Cancelar Agendamento
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PREMIUM DELETION DIALOG */}
      <AnimatePresence>
        {deletingApp && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <motion.div 
              initial={{ scale: 0.96, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 15 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-sm w-full overflow-hidden modal-mobile-sheet"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <Trash2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 leading-tight">Excluir Agendamento</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Remoção permanente</p>
                  </div>
                </div>

                <p className="text-xs text-slate-650 leading-relaxed">
                  Tem certeza que deseja **excluir permanentemente** do banco de dados o agendamento de **{deletingApp.patientName}**? Esta ação não pode ser desfeita.
                </p>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeletingApp(null)}
                  className="px-4 py-2 border border-slate-250 hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  Manter
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAppointment}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
                >
                  Excluir Permanente
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
