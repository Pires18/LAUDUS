import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from 'firebase/auth';
import { AppSettings, Patient, ExamStatus } from '../types';
import { getSettings, saveSettings, migrateLegacyAnthropicModel } from './db';
import { logger } from '../utils/logger';
import { setTheme } from '../utils/theme';

type View =
  | { name: 'dashboard' }
  | { name: 'worklist' }
  | { name: 'patients' }
  | { name: 'appointments' }
  | { name: 'patient-detail'; patientId: string }
  | { name: 'exam-editor'; examId: string }
  | { name: 'templates' }
  | { name: 'template-editor'; templateId?: string }
  | { name: 'settings'; activeTab?: string }
  | { name: 'dicom' }
  | { name: 'laud-ia' }
  | { name: 'calculators' }
  | { name: 'clinics' }
  | { name: 'clinic-detail'; clinicId: string }
  | { name: 'clinic-form'; clinicId?: string }
  | { name: 'admin'; activeTab?: string };

interface AppState {
  // ── Auth ──
  user: User | null;
  setUser: (u: User | null) => void;
  profile: any | null;
  setProfile: (p: any | null) => void;

  // ── Navigation ──
  view: View;
  setView: (v: View) => void;

  // ── Clinic context ──
  selectedClinicId: string | null; // null = todas as clínicas
  setSelectedClinic: (id: string | null) => void;

  // ── Settings ──
  settings: AppSettings;
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;

  // ── Toast/feedback ──
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;

  // ── Global Modals ──
  showCreateExamModal: boolean;
  setShowCreateExamModal: (val: boolean) => void;
  showSupportModal: boolean;
  setShowSupportModal: (val: boolean) => void;
  createExamDefaultPatient: Patient | null;
  setCreateExamDefaultPatient: (p: Patient | null) => void;

  // ── Templates Filter State ──
  templateSearch: string;
  setTemplateSearch: (s: string) => void;
  templateAreaFilter: string;
  setTemplateAreaFilter: (a: string) => void;

  // ── Worklist Filter State ──
  worklistStatusFilter: ExamStatus | 'todos';
  setWorklistStatusFilter: (s: ExamStatus | 'todos') => void;
  worklistAreaFilter: string;
  setWorklistAreaFilter: (a: string) => void;
  worklistDateFilter: 'todos' | 'hoje' | 'semana' | 'mes';
  setWorklistDateFilter: (d: 'todos' | 'hoje' | 'semana' | 'mes') => void;
  worklistSearch: string;
  setWorklistSearch: (s: string) => void;

  // ── Patients Filter State ──
  patientsSearch: string;
  setPatientsSearch: (s: string) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
  // ── Auth ──
  user: null,
  setUser: (u) => set({ user: u }),
  profile: null,
  setProfile: (p) => set({ profile: p }),

  // ── Navigation ──
  view: { name: 'dashboard' },
  setView: (v) => set({ view: v }),

  // ── Clinic context ──
  selectedClinicId: null,
  setSelectedClinic: (id) => set({ selectedClinicId: id }),

  // ── Settings ──
  settings: {
    geminiModel: 'gemini-2.5-flash',
    aiProvider: 'anthropic',
    anthropicModel: 'claude-sonnet-4-6'
  },
  loadSettings: async () => {
    try {
      const s = await getSettings();
      // Migrate legacy Anthropic model names to current default
      migrateLegacyAnthropicModel(s);
      set({ settings: s });
      // Aplica o tema salvo do usuário (mantém localStorage em sincronia).
      if (s.theme) setTheme(s.theme);
      // Se tem clínica padrão nas settings, seta como selecionada
      if (s.defaultClinicId) {
        set({ selectedClinicId: s.defaultClinicId });
      }
    } catch (err) {
      logger.warn('[App] Erro ao carregar settings:', err);
    }
  },
  updateSettings: async (patch) => {
    const next = { ...get().settings, ...patch };
    // Aplica o tema na hora (antes do await) para resposta imediata da UI.
    if (patch.theme) setTheme(patch.theme);
    set({ settings: next });
    await saveSettings(next);
  },

  // ── Toast ──
  toast: null,
  showToast: (message, type = 'info') => {
    set({ toast: { message, type } });
    setTimeout(() => {
      if (get().toast?.message === message) set({ toast: null });
    }, 3500);
  },
  clearToast: () => set({ toast: null }),

  // ── Global Modals ──
  showCreateExamModal: false,
  setShowCreateExamModal: (val) => set({ showCreateExamModal: val }),
  showSupportModal: false,
  setShowSupportModal: (val) => set({ showSupportModal: val }),
  createExamDefaultPatient: null,
  setCreateExamDefaultPatient: (p) => set({ createExamDefaultPatient: p }),

  // ── Templates Filter State ──
  templateSearch: '',
  setTemplateSearch: (s) => set({ templateSearch: s }),
  templateAreaFilter: 'todas',
  setTemplateAreaFilter: (a) => set({ templateAreaFilter: a }),

  // ── Worklist Filter State ──
  worklistStatusFilter: 'todos',
  setWorklistStatusFilter: (s) => set({ worklistStatusFilter: s }),
  worklistAreaFilter: 'todas',
  setWorklistAreaFilter: (a) => set({ worklistAreaFilter: a }),
  worklistDateFilter: 'todos',
  setWorklistDateFilter: (d) => set({ worklistDateFilter: d }),
  worklistSearch: '',
  setWorklistSearch: (s) => set({ worklistSearch: s }),

  // ── Patients Filter State ──
  patientsSearch: '',
  setPatientsSearch: (s) => set({ patientsSearch: s }),
    }),
    {
      name: 'laudus-storage',
      // Define quais propriedades devem ser persistidas localmente
      partialize: (state) => ({
        worklistStatusFilter: state.worklistStatusFilter,
        worklistAreaFilter: state.worklistAreaFilter,
        worklistDateFilter: state.worklistDateFilter,
        worklistSearch: state.worklistSearch,
        patientsSearch: state.patientsSearch,
        templateSearch: state.templateSearch,
        templateAreaFilter: state.templateAreaFilter,
      }),
    }
  )
);
