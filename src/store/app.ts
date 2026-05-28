import { create } from 'zustand';
import { User } from 'firebase/auth';
import { AppSettings, Patient } from '../types';
import { getSettings, saveSettings } from './db';

type View =
  | { name: 'dashboard' }
  | { name: 'worklist' }
  | { name: 'patients' }
  | { name: 'patient-detail'; patientId: string }
  | { name: 'exam-editor'; examId: string }
  | { name: 'templates' }
  | { name: 'template-editor'; templateId?: string }
  | { name: 'settings' }
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
}

export const useApp = create<AppState>((set, get) => ({
  // ── Auth ──
  user: null,
  setUser: (u) => set({ user: u }),

  // ── Navigation ──
  view: { name: 'dashboard' },
  setView: (v) => set({ view: v }),

  // ── Clinic context ──
  selectedClinicId: null,
  setSelectedClinic: (id) => set({ selectedClinicId: id }),

  // ── Settings ──
  settings: { 
    geminiModel: 'gemini-3.5-flash', 
    aiProvider: 'gemini', 
    anthropicModel: 'claude-3-5-sonnet-latest' 
  },
  loadSettings: async () => {
    try {
      const s = await getSettings();
      set({ settings: s });
      // Se tem clínica padrão nas settings, seta como selecionada
      if (s.defaultClinicId) {
        set({ selectedClinicId: s.defaultClinicId });
      }
    } catch (err) {
      console.warn('[App] Erro ao carregar settings:', err);
    }
  },
  updateSettings: async (patch) => {
    const next = { ...get().settings, ...patch };
    await saveSettings(next);
    set({ settings: next });
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
}));
