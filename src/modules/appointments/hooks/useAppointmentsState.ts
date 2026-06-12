import { useReducer } from 'react';
import { Appointment, Patient, ReportTemplate, Clinic, ExamArea } from '../../../types';
import { getLocalDateStr } from '../utils/scheduleUtils';

export type ViewMode = 'cards' | 'timeline';

export interface AppointmentFormState {
  // Navigation & Filters
  activeTab: 'agendamentos' | 'configuracao';
  search: string;
  statusFilter: 'todos' | 'agendado' | 'confirmado' | 'cancelado';
  dateFilter: string;
  viewMode: ViewMode;

  // Modals & Action targets
  showCreateModal: boolean;
  confirmingApp: Appointment | null;
  cancelingApp: Appointment | null;
  deletingApp: Appointment | null;
  reschedulingApp: Appointment | null;

  // Creation modal form state
  modalStep: 1 | 2 | 3;
  patientSearch: string;
  templateSearch: string;
  showQuickPatient: boolean;
  
  // Quick patient fields
  newPatientName: string;
  newPatientBirthDate: string;
  newPatientGender: 'M' | 'F' | 'O';
  newPatientPhone: string;
  newPatientCPF: string;
  newPatientInsurance: string;

  selectedArea: ExamArea | 'todas';
  selectedPatient: Patient | null;
  selectedClinic: Clinic | null;
  selectedTemplate: ReportTemplate | null;
  appointmentDate: string;
  appointmentTime: string;
  appointmentNotes: string;
  appointmentPriority: 'normal' | 'urgente';
  appointmentRequestingPhysician: string;
  appointmentInsurance: string;

  // Global redirect / device settings
  autoRedirectToReport: boolean;
  selectedConfirmDeviceId: string;

  // Configuration tab state
  configClinicId: string;
}

export type AppointmentAction =
  | { type: 'SET_ACTIVE_TAB'; payload: 'agendamentos' | 'configuracao' }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_STATUS_FILTER'; payload: 'todos' | 'agendado' | 'confirmado' | 'cancelado' }
  | { type: 'SET_DATE_FILTER'; payload: string }
  | { type: 'SET_VIEW_MODE'; payload: ViewMode }
  | { type: 'SET_SHOW_CREATE_MODAL'; payload: boolean }
  | { type: 'SET_CONFIRMING_APP'; payload: Appointment | null }
  | { type: 'SET_CANCELING_APP'; payload: Appointment | null }
  | { type: 'SET_DELETING_APP'; payload: Appointment | null }
  | { type: 'SET_RESCHEDULING_APP'; payload: Appointment | null }
  | { type: 'SET_MODAL_STEP'; payload: 1 | 2 | 3 }
  | { type: 'SET_PATIENT_SEARCH'; payload: string }
  | { type: 'SET_TEMPLATE_SEARCH'; payload: string }
  | { type: 'SET_SHOW_QUICK_PATIENT'; payload: boolean }
  | { type: 'SET_NEW_PATIENT_FIELD'; payload: { field: string; value: any } }
  | { type: 'SET_SELECTED_AREA'; payload: ExamArea | 'todas' }
  | { type: 'SET_SELECTED_PATIENT'; payload: Patient | null }
  | { type: 'SET_SELECTED_CLINIC'; payload: Clinic | null }
  | { type: 'SET_SELECTED_TEMPLATE'; payload: ReportTemplate | null }
  | { type: 'SET_APPOINTMENT_DATE'; payload: string }
  | { type: 'SET_APPOINTMENT_TIME'; payload: string }
  | { type: 'SET_APPOINTMENT_NOTES'; payload: string }
  | { type: 'SET_APPOINTMENT_PRIORITY'; payload: 'normal' | 'urgente' }
  | { type: 'SET_APPOINTMENT_REQUESTING_PHYSICIAN'; payload: string }
  | { type: 'SET_APPOINTMENT_INSURANCE'; payload: string }
  | { type: 'SET_AUTO_REDIRECT'; payload: boolean }
  | { type: 'SET_CONFIRM_DEVICE_ID'; payload: string }
  | { type: 'SET_CONFIG_CLINIC_ID'; payload: string }
  | { type: 'RESET_FORM' };

const getInitialState = (defaultClinic: Clinic | null, defaultDeviceId: string): AppointmentFormState => ({
  activeTab: 'agendamentos',
  search: '',
  statusFilter: 'todos',
  dateFilter: getLocalDateStr(new Date()),
  viewMode: 'cards',

  showCreateModal: false,
  confirmingApp: null,
  cancelingApp: null,
  deletingApp: null,
  reschedulingApp: null,

  modalStep: 1,
  patientSearch: '',
  templateSearch: '',
  showQuickPatient: false,
  newPatientName: '',
  newPatientBirthDate: '',
  newPatientGender: 'F',
  newPatientPhone: '',
  newPatientCPF: '',
  newPatientInsurance: '',

  selectedArea: 'todas',
  selectedPatient: null,
  selectedClinic: defaultClinic,
  selectedTemplate: null,
  appointmentDate: getLocalDateStr(new Date()),
  appointmentTime: '',
  appointmentNotes: '',
  appointmentPriority: 'normal',
  appointmentRequestingPhysician: '',
  appointmentInsurance: '',

  autoRedirectToReport: true,
  selectedConfirmDeviceId: defaultDeviceId,
  configClinicId: defaultClinic?.id || '',
});

function appointmentReducer(state: AppointmentFormState, action: AppointmentAction): AppointmentFormState {
  switch (action.type) {
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_SEARCH':
      return { ...state, search: action.payload };
    case 'SET_STATUS_FILTER':
      return { ...state, statusFilter: action.payload };
    case 'SET_DATE_FILTER':
      return { ...state, dateFilter: action.payload };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };
    case 'SET_SHOW_CREATE_MODAL':
      return { ...state, showCreateModal: action.payload };
    case 'SET_CONFIRMING_APP':
      return { ...state, confirmingApp: action.payload };
    case 'SET_CANCELING_APP':
      return { ...state, cancelingApp: action.payload };
    case 'SET_DELETING_APP':
      return { ...state, deletingApp: action.payload };
    case 'SET_RESCHEDULING_APP':
      return { ...state, reschedulingApp: action.payload };
    case 'SET_MODAL_STEP':
      return { ...state, modalStep: action.payload };
    case 'SET_PATIENT_SEARCH':
      return { ...state, patientSearch: action.payload };
    case 'SET_TEMPLATE_SEARCH':
      return { ...state, templateSearch: action.payload };
    case 'SET_SHOW_QUICK_PATIENT':
      return { ...state, showQuickPatient: action.payload };
    case 'SET_NEW_PATIENT_FIELD':
      return {
        ...state,
        [action.payload.field]: action.payload.value,
      };
    case 'SET_SELECTED_AREA':
      return { ...state, selectedArea: action.payload };
    case 'SET_SELECTED_PATIENT':
      return { ...state, selectedPatient: action.payload };
    case 'SET_SELECTED_CLINIC':
      return { ...state, selectedClinic: action.payload };
    case 'SET_SELECTED_TEMPLATE':
      return { ...state, selectedTemplate: action.payload };
    case 'SET_APPOINTMENT_DATE':
      return { ...state, appointmentDate: action.payload };
    case 'SET_APPOINTMENT_TIME':
      return { ...state, appointmentTime: action.payload };
    case 'SET_APPOINTMENT_NOTES':
      return { ...state, appointmentNotes: action.payload };
    case 'SET_APPOINTMENT_PRIORITY':
      return { ...state, appointmentPriority: action.payload };
    case 'SET_APPOINTMENT_REQUESTING_PHYSICIAN':
      return { ...state, appointmentRequestingPhysician: action.payload };
    case 'SET_APPOINTMENT_INSURANCE':
      return { ...state, appointmentInsurance: action.payload };
    case 'SET_AUTO_REDIRECT':
      return { ...state, autoRedirectToReport: action.payload };
    case 'SET_CONFIRM_DEVICE_ID':
      return { ...state, selectedConfirmDeviceId: action.payload };
    case 'SET_CONFIG_CLINIC_ID':
      return { ...state, configClinicId: action.payload };
    case 'RESET_FORM':
      return {
        ...state,
        modalStep: 1,
        patientSearch: '',
        templateSearch: '',
        showQuickPatient: false,
        newPatientName: '',
        newPatientBirthDate: '',
        newPatientGender: 'F',
        newPatientPhone: '',
        newPatientCPF: '',
        newPatientInsurance: '',
        selectedPatient: null,
        selectedTemplate: null,
        appointmentDate: getLocalDateStr(new Date()),
        appointmentTime: '',
        appointmentNotes: '',
        appointmentPriority: 'normal',
        appointmentRequestingPhysician: '',
        appointmentInsurance: '',
      };
    default:
      return state;
  }
}

export function useAppointmentsState(defaultClinic: Clinic | null, defaultDeviceId: string) {
  const [state, dispatch] = useReducer(
    appointmentReducer,
    getInitialState(defaultClinic, defaultDeviceId)
  );

  return { state, dispatch };
}
