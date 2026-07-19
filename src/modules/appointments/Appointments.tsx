import { useEffect, useMemo } from 'react';
import { useApp } from '../../store/app';
import { useCollection } from '../../hooks/useFirestore';
import { useSubscription } from '../../hooks/useSubscription';
import { FeatureLocked } from '../../components/FeatureLocked';
import { addItemWithId, genId, updateItem, deleteItem, generateNumericId } from '../../store/db';
import { Patient, ReportTemplate, Clinic, ExamRequest, Appointment } from '../../types';
import { 
  Plus, Search, RotateCcw, Sliders, CalendarDays, AlertCircle, Trash2, Clock
} from 'lucide-react';
import { classNames } from '../../utils/format';
import { getInitialReportContent } from '../templates/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { syncExamToOrthancWorklist, getDevicesForClinic, pickDefaultDicomDevice } from '../../utils/dicom';
import { PageHeader } from '../../components/PageHeader';
import { logger } from '../../utils/logger';

// Modular Imports
import { getLocalDateStr, isSlotAvailable } from './utils/scheduleUtils';
import { useAppointmentsState } from './hooks/useAppointmentsState';
import { WeeklyCalendar } from './components/WeeklyCalendar';
import { StatsBar } from './components/StatsBar';
import { AppointmentCard } from './components/AppointmentCard';
import { DailyTimeline } from './components/DailyTimeline';
import { CreateAppointmentModal } from './components/CreateAppointmentModal';
import { EditAppointmentModal } from './components/EditAppointmentModal';
import { ConfirmAppointmentModal } from './components/ConfirmAppointmentModal';
import { RescheduleModal } from './components/RescheduleModal';
import { ShiftConfigPanel } from './components/ShiftConfigPanel';

export function Appointments() {
  const { setView, selectedClinicId, showToast, settings } = useApp();
  const { hasAppointments } = useSubscription();
  const { data: appointments, loading: loadingAppointments } = useCollection<Appointment>('appointments');
  const { data: patients } = useCollection<Patient>('patients');
  const { data: templates } = useCollection<ReportTemplate>('templates');
  const { data: clinics } = useCollection<Clinic>('clinics');

  const defaultClinic = useMemo(() => {
    if (clinics.length === 0) return null;
    return clinics.find(c => c.id === selectedClinicId) || clinics[0];
  }, [clinics, selectedClinicId]);

  const defaultDeviceId = useMemo(() => {
    return settings.dicomDevices?.[0]?.id || '';
  }, [settings.dicomDevices]);

  // Hook de Estado Centralizado
  const { state, dispatch } = useAppointmentsState(defaultClinic, defaultDeviceId);

  // Sincroniza clinica selecionada globalmente no state
  useEffect(() => {
    if (defaultClinic) {
      dispatch({ type: 'SET_SELECTED_CLINIC', payload: defaultClinic });
      dispatch({ type: 'SET_CONFIG_CLINIC_ID', payload: defaultClinic.id });
    }
  }, [defaultClinic, dispatch]);

  // Filtro de agendamentos
  const filteredAppointments = useMemo(() => {
    return appointments.filter(app => {
      const matchesClinic = !selectedClinicId || app.clinicId === selectedClinicId;
      const matchesStatus = state.statusFilter === 'todos' || app.status === state.statusFilter;
      
      const s = state.search.toLowerCase().trim();
      const matchesSearch = !s || 
        app.patientName.toLowerCase().includes(s) ||
        app.examType.toLowerCase().includes(s) ||
        (app.patientCPF && app.patientCPF.replace(/\D/g, '').includes(s.replace(/\D/g, ''))) ||
        (app.patientPhone && app.patientPhone.toLowerCase().includes(s));
      
      const appDateStr = getLocalDateStr(app.scheduledAt);
      const matchesDate = !state.dateFilter || appDateStr === state.dateFilter;

      return matchesClinic && matchesStatus && matchesSearch && matchesDate;
    }).sort((a, b) => {
      // Prioridade urgente primeiro
      if (a.priority === 'urgente' && b.priority !== 'urgente') return -1;
      if (a.priority !== 'urgente' && b.priority === 'urgente') return 1;
      return a.scheduledAt - b.scheduledAt;
    });
  }, [appointments, selectedClinicId, state.statusFilter, state.search, state.dateFilter]);

  // Play audio notification
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
          osc.frequency.setValueAtTime(523.25, ctx.currentTime);
          osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.4);
        }
      } catch (err) {}
    }
  };

  // Cadastrar Paciente Rápido
  const handleQuickPatientRegister = async (patientData: {
    name: string;
    birthDate?: string;
    gender?: 'M' | 'F' | 'O';
    phone?: string;
    cpf?: string;
    insurance?: string;
  }) => {
    try {
      const patientId = `P-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
      const newP: Patient = {
        id: patientId,
        name: patientData.name,
        birthDate: patientData.birthDate || undefined,
        gender: patientData.gender || 'F',
        phone: patientData.phone || undefined,
        cpf: patientData.cpf || undefined,
        insurance: patientData.insurance || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await addItemWithId('patients', patientId, newP as any);
      showToast('Paciente cadastrado com sucesso!');
      return newP;
    } catch (err) {
      showToast('Erro ao criar paciente', 'error');
      return null;
    }
  };

  // Salvar Agendamento
  const handleCreateAppointment = async () => {
    const { 
      selectedPatient, selectedTemplate, selectedClinic, 
      appointmentTime, appointmentDate, appointmentNotes,
      appointmentPriority, appointmentRequestingPhysician, appointmentInsurance
    } = state;

    if (!selectedPatient || !selectedTemplate || !selectedClinic || !appointmentTime) {
      showToast('Preencha os campos obrigatórios e escolha um horário!', 'error');
      return;
    }

    const conflict = isSlotAvailable(selectedClinic.id, appointmentDate, appointmentTime, appointments);
    if (!conflict.available) {
      showToast(`Horário ${appointmentTime} já reservado para ${conflict.bookedBy}`, 'error');
      return;
    }

    try {
      const [year, month, day] = appointmentDate.split('-').map(Number);
      const [hours, minutes] = appointmentTime.split(':').map(Number);
      const scheduledDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);

      const appointmentData: Omit<Appointment, 'id'> = {
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        patientBirthDate: selectedPatient.birthDate,
        patientGender: selectedPatient.gender,
        patientPhone: selectedPatient.phone || undefined,
        patientCPF: selectedPatient.cpf || undefined,
        patientInsurance: appointmentInsurance.trim() || selectedPatient.insurance || undefined,
        requestingPhysician: appointmentRequestingPhysician.trim() || undefined,
        priority: appointmentPriority,
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
      dispatch({ type: 'SET_SHOW_CREATE_MODAL', payload: false });
      dispatch({ type: 'RESET_FORM' });
    } catch (error) {
      logger.error('Erro ao criar agendamento:', error);
      showToast('Erro ao criar agendamento', 'error');
    }
  };

  // Confirmar e Sincronizar DICOM/PACS
  const handleConfirmAppointment = async (deviceId: string, autoRedirect: boolean) => {
    const confirmingApp = state.confirmingApp;
    if (!confirmingApp) return;

    try {
      const examId = genId('exams');
      const examData: Partial<ExamRequest> = {
        friendlyId: generateNumericId(),
        patientId: confirmingApp.patientId,
        clinicId: confirmingApp.clinicId,
        area: confirmingApp.area,
        examType: confirmingApp.examType,
        templateId: confirmingApp.templateId,
        // Normalização: exames novos sempre gravam templateIds (agenda = 1 máscara;
        // laudo combinado via agenda fica para a fase 2 do rollout).
        templateIds: confirmingApp.templateId ? [confirmingApp.templateId] : undefined,
        status: 'pendente',
        scheduledAt: confirmingApp.scheduledAt,
        clinicalIndication: confirmingApp.notes || undefined,
        dicomDeviceId: deviceId || undefined,
        examDate: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const template = templates.find(t => t.id === confirmingApp.templateId);
      if (template) {
        examData.reportContent = getInitialReportContent(template);
        examData.consentTerm = template.consentTemplate || undefined;
      }

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
        deviceId,
        examData.examDate,
        confirmingApp.clinicId
      );

      if (!success) {
        logger.warn('[Orthanc Sync] Falha ao enviar para o worklist:', error);
        showToast(`PACS: falha ao criar worklist — ${error || 'verifique o agente local e o Python/pydicom'}`, 'error');
      }

      await updateItem('appointments', confirmingApp.id, { status: 'confirmado' });
      playSuccessSound();
      showToast('Agendamento confirmado!');
      dispatch({ type: 'SET_CONFIRMING_APP', payload: null });

      if (autoRedirect) {
        setView({ name: 'exam-editor', examId });
      }
    } catch (error) {
      logger.error('Erro ao confirmar agendamento:', error);
      showToast('Erro ao confirmar agendamento', 'error');
    }
  };

  // Reagendar Agendamento
  const handleRescheduleConfirm = async (newDateStr: string, newTimeStr: string, newNotes: string) => {
    const app = state.reschedulingApp;
    if (!app) return;

    const conflict = isSlotAvailable(app.clinicId || '', newDateStr, newTimeStr, appointments, app.id);
    if (!conflict.available) {
      showToast(`Horário ${newTimeStr} já reservado para ${conflict.bookedBy}`, 'error');
      return;
    }

    try {
      const [year, month, day] = newDateStr.split('-').map(Number);
      const [hours, minutes] = newTimeStr.split(':').map(Number);
      const scheduledDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);

      // Cancel original
      await updateItem('appointments', app.id, { status: 'cancelado' });

      // Create new rescheduled link
      const newAppId = genId('appointments');
      const appointmentData: Omit<Appointment, 'id'> = {
        patientId: app.patientId,
        patientName: app.patientName,
        patientBirthDate: app.patientBirthDate,
        patientGender: app.patientGender,
        patientPhone: app.patientPhone,
        patientCPF: app.patientCPF,
        patientInsurance: app.patientInsurance,
        requestingPhysician: app.requestingPhysician,
        priority: app.priority,
        rescheduledFrom: app.id,
        clinicId: app.clinicId,
        area: app.area,
        examType: app.examType,
        templateId: app.templateId,
        scheduledAt: scheduledDateTime.getTime(),
        status: 'agendado',
        notes: newNotes.trim() || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await addItemWithId('appointments', newAppId, appointmentData as any);
      showToast('Agendamento reagendado com sucesso!');
      dispatch({ type: 'SET_RESCHEDULING_APP', payload: null });
    } catch (error) {
      logger.error('Erro ao reagendar agendamento:', error);
      showToast('Erro ao reagendar', 'error');
    }
  };

  // Cancelar
  const handleCancelAppointment = async () => {
    if (!state.cancelingApp) return;
    try {
      await updateItem('appointments', state.cancelingApp.id, { status: 'cancelado' });
      showToast('Agendamento cancelado.');
      dispatch({ type: 'SET_CANCELING_APP', payload: null });
    } catch (error) {
      logger.error('Erro ao cancelar agendamento:', error);
      showToast('Erro ao cancelar agendamento', 'error');
    }
  };

  // Excluir
  const handleDeleteAppointment = async () => {
    if (!state.deletingApp) return;
    try {
      await deleteItem('appointments', state.deletingApp.id);
      showToast('Agendamento excluído.');
      dispatch({ type: 'SET_DELETING_APP', payload: null });
    } catch (error) {
      logger.error('Erro ao excluir agendamento:', error);
      showToast('Erro ao excluir agendamento', 'error');
    }
  };

  // Salvar Edição de Agendamento
  const handleUpdateAppointment = async (updatedFields: Partial<Appointment>) => {
    const app = state.editingApp;
    if (!app) return;

    // Se mudou a data ou horário, valida o slot
    if (updatedFields.scheduledAt && updatedFields.scheduledAt !== app.scheduledAt) {
      const newDateStr = getLocalDateStr(updatedFields.scheduledAt);
      const d = new Date(updatedFields.scheduledAt);
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      const newTimeStr = `${h}:${m}`;

      const conflict = isSlotAvailable(updatedFields.clinicId || app.clinicId || '', newDateStr, newTimeStr, appointments, app.id);
      if (!conflict.available) {
        showToast(`Horário ${newTimeStr} já reservado para ${conflict.bookedBy}`, 'error');
        return;
      }
    }

    try {
      await updateItem('appointments', app.id, updatedFields);
      showToast('Agendamento atualizado com sucesso!');
      dispatch({ type: 'SET_EDITING_APP', payload: null });
    } catch (error) {
      logger.error('Erro ao atualizar agendamento:', error);
      showToast('Erro ao atualizar agendamento', 'error');
    }
  };

  // Salvar configuracao de turnos
  const handleSaveClinicConfig = async (clinicId: string, weekdayShifts: any) => {
    try {
      await updateItem('clinics', clinicId, {
        schedulingConfig: { weekdayShifts }
      });
      showToast('Turnos salvos com sucesso!');
      dispatch({ type: 'SET_ACTIVE_TAB', payload: 'agendamentos' });
    } catch (error) {
      logger.error('Erro ao salvar configuração de turnos:', error);
      showToast('Erro ao salvar configuração de turnos', 'error');
    }
  };

  if (!hasAppointments) {
    return (
      <FeatureLocked
        title="Módulo de Agendamentos"
        addonLabel="Agendamentos"
        description="Ative-o na sua assinatura para gerenciar a agenda, marcar exames e enviar a worklist ao aparelho automaticamente."
      />
    );
  }

  return (
    <div className="module-container">
      <div className="max-w-7xl mx-auto w-full animate-fade-in space-y-6">
        {/* ─── COMPACT HEADER ─── */}
        <div className="bg-white border border-ink-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shrink-0">
                <CalendarDays size={18} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-black text-ink-900 tracking-tight leading-none">Agendamentos & Recepção</h1>
                <p className="text-[11px] text-ink-500 font-medium mt-0.5">Gerencie a agenda de exames, crie fichas rápidas de pacientes e sincronize com a Worklist.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                className={classNames(
                  "h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-1.5 active:scale-95",
                  state.activeTab === 'configuracao'
                    ? "bg-ink-900 border-ink-900 text-white"
                    : "text-ink-500 bg-ink-100 border border-ink-200 hover:bg-ink-200"
                )}
                onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: state.activeTab === 'configuracao' ? 'agendamentos' : 'configuracao' })}
              >
                <Sliders size={12} />
                <span>Configurar Turnos</span>
              </button>
              <button 
                type="button"
                className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-750 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 active:scale-95" 
                onClick={() => { dispatch({ type: 'RESET_FORM' }); dispatch({ type: 'SET_SHOW_CREATE_MODAL', payload: true }); }}
              >
                <Plus size={11} />
                <span>Novo Agendamento</span>
              </button>
            </div>
          </div>
        </div>

        {state.activeTab === 'configuracao' ? (
          <ShiftConfigPanel
            clinics={clinics}
            configClinicId={state.configClinicId}
            onClinicChange={(id) => dispatch({ type: 'SET_CONFIG_CLINIC_ID', payload: id })}
            onSave={handleSaveClinicConfig}
            onCancel={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'agendamentos' })}
          />
        ) : (
          <>
            {/* Calendario Semanal e Estatisticas */}
            <div className="space-y-4">
              <WeeklyCalendar
                selectedDate={state.dateFilter}
                onSelectDate={(date) => dispatch({ type: 'SET_DATE_FILTER', payload: date })}
                appointments={appointments}
                clinicId={selectedClinicId || undefined}
              />
              
              <StatsBar
                appointments={appointments}
                selectedDate={state.dateFilter}
                clinicId={selectedClinicId || undefined}
              />
            </div>

            {/* Filtros e Toolbar */}
            <div className="bg-white border border-ink-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="text"
                    placeholder="Buscar por paciente, exame, CPF ou telefone..."
                    value={state.search}
                    onChange={(e) => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
                    className="input pl-12 py-3 h-12 text-sm shadow-sm border-ink-200 focus:border-brand-500 w-full"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 lg:justify-end w-full lg:w-auto">
                  {/* Status buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'todos', label: 'Todos' },
                      { id: 'agendado', label: 'Agendados' },
                      { id: 'confirmado', label: 'Confirmados' },
                      { id: 'cancelado', label: 'Cancelados' },
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => dispatch({ type: 'SET_STATUS_FILTER', payload: f.id as any })}
                        className={classNames(
                          "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border",
                          state.statusFilter === f.id
                            ? "bg-ink-900 border-ink-900 text-white shadow-sm"
                            : "bg-ink-50 border-ink-200 text-ink-500 hover:bg-ink-100"
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Reset button */}
                  {(state.search || state.statusFilter !== 'todos' || state.dateFilter !== getLocalDateStr(new Date())) && (
                    <button 
                      type="button"
                      onClick={() => {
                        dispatch({ type: 'SET_SEARCH', payload: '' });
                        dispatch({ type: 'SET_STATUS_FILTER', payload: 'todos' });
                        dispatch({ type: 'SET_DATE_FILTER', payload: getLocalDateStr(new Date()) });
                      }}
                      className="p-2.5 text-ink-400 hover:text-ink-900 hover:bg-ink-50 border border-ink-200 rounded-xl transition-all flex items-center justify-center shadow-sm"
                      title="Limpar Filtros"
                    >
                      <RotateCcw size={15} />
                    </button>
                  )}

                  <div className="w-[1px] h-6 bg-ink-200 hidden sm:block" />

                  {/* View mode toggle */}
                  <div className="flex border border-ink-200 rounded-xl p-0.5 bg-ink-50 shadow-inner shrink-0">
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'cards' })}
                      className={classNames(
                        "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1",
                        state.viewMode === 'cards'
                          ? "bg-white text-ink-900 shadow-sm"
                          : "text-ink-500 hover:text-ink-700"
                      )}
                    >
                      Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'timeline' })}
                      className={classNames(
                        "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1",
                        state.viewMode === 'timeline'
                          ? "bg-white text-ink-900 shadow-sm"
                          : "text-ink-500 hover:text-ink-700"
                      )}
                    >
                      <Clock size={11} /> Timeline
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* List/Timeline View Content */}
            {loadingAppointments ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-28 bg-white border border-ink-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="text-center py-20 bg-white border border-ink-200 rounded-2xl shadow-sm">
                <CalendarDays size={48} className="mx-auto text-ink-200 mb-4 animate-pulse" />
                <h4 className="text-sm font-black text-ink-700 uppercase tracking-widest">Nenhum Agendamento Localizado</h4>
                <p className="text-xs text-ink-400 mt-1">Experimente navegar pelo calendário acima ou clique para criar um novo.</p>
                <button 
                  type="button"
                  onClick={() => { dispatch({ type: 'RESET_FORM' }); dispatch({ type: 'SET_SHOW_CREATE_MODAL', payload: true }); }}
                  className="mt-5 px-5 py-2.5 bg-ink-900 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-ink-800 transition-all shadow-sm active:scale-95"
                >
                  Novo Agendamento
                </button>
              </div>
            ) : state.viewMode === 'cards' ? (
              /* CARDS GRID VIEW */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
                {filteredAppointments.map(app => (
                  <AppointmentCard
                    key={app.id}
                    appointment={app}
                    clinic={clinics.find(c => c.id === app.clinicId)}
                    onConfirm={(a) => dispatch({ type: 'SET_CONFIRMING_APP', payload: a })}
                    onCancel={(a) => dispatch({ type: 'SET_CANCELING_APP', payload: a })}
                    onDelete={(a) => dispatch({ type: 'SET_DELETING_APP', payload: a })}
                    onReschedule={(a) => dispatch({ type: 'SET_RESCHEDULING_APP', payload: a })}
                    onEdit={(a) => dispatch({ type: 'SET_EDITING_APP', payload: a })}
                  />
                ))}
              </div>
            ) : (
              /* DAILY TIMELINE VIEW */
              <div className="pb-20">
                {defaultClinic ? (
                  <DailyTimeline
                    clinic={defaultClinic}
                    selectedDate={state.dateFilter}
                    appointments={appointments}
                    onConfirm={(a) => dispatch({ type: 'SET_CONFIRMING_APP', payload: a })}
                    onCancel={(a) => dispatch({ type: 'SET_CANCELING_APP', payload: a })}
                    onDelete={(a) => dispatch({ type: 'SET_DELETING_APP', payload: a })}
                    onReschedule={(a) => dispatch({ type: 'SET_RESCHEDULING_APP', payload: a })}
                    onEdit={(a) => dispatch({ type: 'SET_EDITING_APP', payload: a })}
                    onQuickSchedule={(time) => {
                      dispatch({ type: 'RESET_FORM' });
                      dispatch({ type: 'SET_APPOINTMENT_TIME', payload: time });
                      dispatch({ type: 'SET_SHOW_CREATE_MODAL', payload: true });
                    }}
                  />
                ) : (
                  <div className="text-center py-12 text-ink-400 italic text-xs">
                    Nenhuma clínica selecionada para gerar a timeline.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* CREATE MODAL */}
      <AnimatePresence>
        {state.showCreateModal && (
          <CreateAppointmentModal
            clinics={clinics}
            patients={patients}
            templates={templates}
            appointments={appointments}
            selectedClinic={state.selectedClinic}
            setSelectedClinic={(c) => dispatch({ type: 'SET_SELECTED_CLINIC', payload: c })}
            selectedPatient={state.selectedPatient}
            setSelectedPatient={(p) => dispatch({ type: 'SET_SELECTED_PATIENT', payload: p })}
            selectedTemplate={state.selectedTemplate}
            setSelectedTemplate={(t) => dispatch({ type: 'SET_SELECTED_TEMPLATE', payload: t })}
            appointmentDate={state.appointmentDate}
            setAppointmentDate={(d) => dispatch({ type: 'SET_APPOINTMENT_DATE', payload: d })}
            appointmentTime={state.appointmentTime}
            setAppointmentTime={(t) => dispatch({ type: 'SET_APPOINTMENT_TIME', payload: t })}
            appointmentNotes={state.appointmentNotes}
            setAppointmentNotes={(n) => dispatch({ type: 'SET_APPOINTMENT_NOTES', payload: n })}
            appointmentPriority={state.appointmentPriority}
            setAppointmentPriority={(p) => dispatch({ type: 'SET_APPOINTMENT_PRIORITY', payload: p })}
            appointmentRequestingPhysician={state.appointmentRequestingPhysician}
            setAppointmentRequestingPhysician={(dr) => dispatch({ type: 'SET_APPOINTMENT_REQUESTING_PHYSICIAN', payload: dr })}
            appointmentInsurance={state.appointmentInsurance}
            setAppointmentInsurance={(ins) => dispatch({ type: 'SET_APPOINTMENT_INSURANCE', payload: ins })}
            onClose={() => dispatch({ type: 'SET_SHOW_CREATE_MODAL', payload: false })}
            onSave={handleCreateAppointment}
            onQuickPatientRegister={handleQuickPatientRegister}
          />
        )}
      </AnimatePresence>

      {/* CONFIRMATION PACS DIALOG */}
      <AnimatePresence>
        {state.confirmingApp && (
          <ConfirmAppointmentModal
            appointment={state.confirmingApp}
            dicomDevices={getDevicesForClinic(settings.dicomDevices, state.confirmingApp.clinicId)}
            defaultDeviceId={pickDefaultDicomDevice(settings.dicomDevices, state.confirmingApp.clinicId, settings.dicomDefaultDeviceIdByClinic, settings.dicomDefaultDeviceId)?.id}
            onClose={() => dispatch({ type: 'SET_CONFIRMING_APP', payload: null })}
            onConfirm={handleConfirmAppointment}
          />
        )}
      </AnimatePresence>

      {/* EDIT MODAL */}
      <AnimatePresence>
        {state.editingApp && (
          <EditAppointmentModal
            appointment={state.editingApp}
            clinics={clinics}
            patients={patients}
            templates={templates}
            appointments={appointments}
            onClose={() => dispatch({ type: 'SET_EDITING_APP', payload: null })}
            onSave={handleUpdateAppointment}
          />
        )}
      </AnimatePresence>

      {/* RESCHEDULE MODAL */}
      <AnimatePresence>
        {state.reschedulingApp && defaultClinic && (
          <RescheduleModal
            appointment={state.reschedulingApp}
            clinic={defaultClinic}
            appointments={appointments}
            onClose={() => dispatch({ type: 'SET_RESCHEDULING_APP', payload: null })}
            onConfirm={handleRescheduleConfirm}
          />
        )}
      </AnimatePresence>

      {/* CANCELLATION CONFIRMATION DIALOG */}
      <AnimatePresence>
        {state.cancelingApp && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <motion.div 
              initial={{ scale: 0.96, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 15 }}
              className="bg-white rounded-2xl border border-ink-100 shadow-2xl max-w-sm w-full overflow-hidden"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-ink-900 leading-tight">Cancelar Agendamento</h3>
                    <p className="text-[10px] text-ink-400 font-bold uppercase tracking-wider">Esta ação é irreversível</p>
                  </div>
                </div>
                <p className="text-xs text-ink-600 leading-relaxed">
                  Tem certeza que deseja cancelar o agendamento de **{state.cancelingApp.patientName}** para o procedimento de **{state.cancelingApp.examType}**?
                </p>
              </div>
              <div className="px-6 py-4 bg-ink-50 border-t border-ink-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_CANCELING_APP', payload: null })}
                  className="px-4 py-2 border border-ink-200 hover:bg-ink-100 text-ink-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  Manter Ativo
                </button>
                <button
                  type="button"
                  onClick={handleCancelAppointment}
                  className="px-5 py-2.5 bg-rose-650 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
                >
                  Cancelar Agendamento
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETION CONFIRMATION DIALOG */}
      <AnimatePresence>
        {state.deletingApp && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <motion.div 
              initial={{ scale: 0.96, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 15 }}
              className="bg-white rounded-2xl border border-ink-100 shadow-2xl max-w-sm w-full overflow-hidden"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <Trash2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-ink-900 leading-tight">Excluir Agendamento</h3>
                    <p className="text-[10px] text-ink-400 font-bold uppercase tracking-wider">Remoção permanente</p>
                  </div>
                </div>
                <p className="text-xs text-ink-600 leading-relaxed">
                  Tem certeza que deseja **excluir permanentemente** do banco de dados o agendamento de **{state.deletingApp.patientName}**? Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="px-6 py-4 bg-ink-50 border-t border-ink-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_DELETING_APP', payload: null })}
                  className="px-4 py-2 border border-ink-200 hover:bg-ink-100 text-ink-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  Manter
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAppointment}
                  className="px-5 py-2.5 bg-rose-650 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
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
