import { useEffect, useState, ReactNode, lazy, Suspense } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, firestore } from './lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useApp } from './store/app';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/LoginScreen';
import { LicenseActivationScreen } from './components/LicenseActivationScreen';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { PageTransition } from './components/PageTransition';
import { Toast } from './components/Toast';
import { CommandPalette } from './components/CommandPalette';
import { CreateExamModal } from './components/CreateExamModal';
import { SupportCenterModal } from './components/SupportCenterModal';
import { BroadcastBanner } from './components/BroadcastBanner';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';
import { OfflineBanner } from './components/OfflineBanner';
import { AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

import { classNames } from './utils/format';
import { logger } from './utils/logger';
import { useConfirmStore } from './hooks/useConfirm';
import { ConfirmDialog } from './components/ConfirmDialog';

// ── Eager loads (critical path) ──
import { Dashboard } from './modules/dashboard/Dashboard';
import { Worklist } from './modules/worklist/Worklist';
import { ExamEditor } from './modules/editor/ExamEditor';

// ── Lazy loads (secondary modules) ──
const Patients = lazy(() => import('./modules/patients/Patients').then(m => ({ default: m.Patients })));
const PatientDetail = lazy(() => import('./modules/patients/PatientDetail').then(m => ({ default: m.PatientDetail })));
const Appointments = lazy(() => import('./modules/appointments/Appointments').then(m => ({ default: m.Appointments })));
const Templates = lazy(() => import('./modules/templates/Templates').then(m => ({ default: m.Templates })));
const TemplateEditor = lazy(() => import('./modules/templates/TemplateEditor').then(m => ({ default: m.TemplateEditor })));
const Settings = lazy(() => import('./modules/settings/Settings').then(m => ({ default: m.Settings })));
const LaudIA = lazy(() => import('./modules/laud-ia/LaudIA').then(m => ({ default: m.LaudIA })));
const Calculators = lazy(() => import('./modules/calculators/Calculators').then(m => ({ default: m.Calculators })));
const Clinics = lazy(() => import('./modules/clinics/Clinics').then(m => ({ default: m.Clinics })));
const ClinicDetail = lazy(() => import('./modules/clinics/ClinicDetail').then(m => ({ default: m.ClinicDetail })));
const ClinicForm = lazy(() => import('./modules/clinics/ClinicForm').then(m => ({ default: m.ClinicForm })));
const Admin = lazy(() => import('./modules/admin/Admin').then(m => ({ default: m.Admin })));

function LazyFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={24} className="animate-spin text-brand-500" />
    </div>
  );
}

function ViewRenderer() {
  const { view } = useApp();

  function lazy(label: string, node: ReactNode) {
    return <ErrorBoundary inline label={label}><Suspense fallback={<LazyFallback />}>{node}</Suspense></ErrorBoundary>;
  }

  const views: Record<string, ReactNode> = {
    dashboard: <ErrorBoundary inline label="Dashboard"><Dashboard /></ErrorBoundary>,
    worklist: <ErrorBoundary inline label="Worklist"><Worklist /></ErrorBoundary>,
    patients: lazy('Pacientes', <Patients />),
    appointments: lazy('Agenda', <Appointments />),
    'patient-detail': view.name === 'patient-detail' ? lazy('Paciente', <PatientDetail key={view.patientId} patientId={view.patientId} />) : null,
    'exam-editor': view.name === 'exam-editor' ? <ErrorBoundary inline label="Editor de Laudo"><ExamEditor key={view.examId} examId={view.examId} /></ErrorBoundary> : null,
    templates: lazy('Templates', <Templates />),
    'template-editor': view.name === 'template-editor' ? lazy('Editor de Template', <TemplateEditor key={view.templateId} templateId={view.templateId} />) : null,
    settings: lazy('Configurações', <Settings />),
    'laud-ia': lazy('LAUD.IA', <LaudIA />),
    calculators: lazy('Calculadoras', <Calculators />),
    clinics: lazy('Clínicas', <Clinics />),
    'clinic-detail': view.name === 'clinic-detail' ? lazy('Clínica', <ClinicDetail key={view.clinicId} clinicId={view.clinicId} />) : null,
    'clinic-form': view.name === 'clinic-form' ? lazy('Formulário de Clínica', <ClinicForm key={view.clinicId} clinicId={view.clinicId} />) : null,
    admin: lazy('Administração', <Admin />),
  };

  const isFullBleed = view.name === 'exam-editor';

  return (
    <main
      className={classNames(
        "flex-1 min-w-0 min-h-0 relative",
        isFullBleed
          ? "flex flex-col overflow-hidden"
          : "overflow-y-auto custom-scrollbar"
      )}
      style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      <AnimatePresence mode="wait">
        <PageTransition key={view.name} id={view.name} fullBleed={isFullBleed}>
          {views[view.name] ?? null}
        </PageTransition>
      </AnimatePresence>
    </main>
  );
}
function AuthenticatedApp() {
  const { showCreateExamModal, setShowCreateExamModal, view, loadSettings } = useApp();

  useEffect(() => {
    loadSettings();
    
    // Atualiza apenas o último login do usuário ativo
    const syncUserLogin = async () => {
      const user = auth.currentUser;
      if (!user) return;
      
      const userRef = doc(firestore, 'users', user.uid);
      await setDoc(userRef, { 
        lastLogin: Date.now(),
        updatedAt: Date.now() 
      }, { merge: true });
    };
    
    syncUserLogin();
  }, [loadSettings]);

  return (
    <div
      className="flex flex-col overflow-hidden bg-ink-50/30"
      style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <OfflineBanner />
      <BroadcastBanner />
      <div className="flex flex-1 min-h-0 flex-col md:flex-row overflow-hidden">
        <Sidebar />
        <ViewRenderer />
      </div>
      {view.name !== 'exam-editor' && <BottomNav />}
      <Toast />
      <CommandPalette />
      {showCreateExamModal && <CreateExamModal onClose={() => setShowCreateExamModal(false)} />}
      <SupportCenterModal />
      <PWAUpdatePrompt />
      <GlobalConfirmDialog />
    </div>
  );
}

function GlobalConfirmDialog() {
  const { isOpen, options, handleConfirm, handleCancel } = useConfirmStore();
  return (
    <ConfirmDialog
      open={isOpen}
      title={options.title}
      message={options.message}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      variant={options.variant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}

/**
 * Barreira de controle de acesso por licença ativa.
 * Impede a entrada de usuários inativos ou com licença expirada.
 */
function UserAccessGate({ children }: { children: ReactNode }) {
  const { user } = useApp();
  const [checking, setChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [expiredPlanName, setExpiredPlanName] = useState<string | undefined>(undefined);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        setIsAllowed(false);
        setChecking(false);
        return;
      }

      try {
        const userRef = doc(firestore, 'users', user.uid);
        const snap = await getDoc(userRef);

        // Se o usuário existir e for admin (Super Admin Bypass baseado em role, não em email hardcoded)
        if (snap.exists() && snap.data().role === 'admin') {
          setIsAllowed(true);
          setChecking(false);
          return;
        }

        // Acesso para desenvolvimento (Bypass DEV)
        if (import.meta.env.DEV && user.uid === 'dev-admin-uid') {
          setIsAllowed(true);
          setChecking(false);
          return;
        }

        // O sistema não usa mais pré-cadastro manual (que causaria Permission Denied no Firebase)
        // Se o usuário já existir no banco (criado pelo auto-cadastro com licença), tudo certo.
        // Se não existir, ele será barrado a não ser que use a tela de ativação de licença.
        if (!snap.exists()) {
          logger.warn('[AUTH] Usuário autenticado, mas não possui documento no Firestore. Deve ativar licença.');
          // Sem documento: Usuário novo real - precisa de ativação por chave
          setIsAllowed(false);
          setIsExpired(false);
        } else {
          const data = snap.data();
          if (data.active === false) {
            setIsAllowed(false);
            setIsExpired(false);
          } else if (data.licenseExpiresAt && data.licenseExpiresAt < Date.now()) {
            // Licença expirada
            setIsAllowed(false);
            setIsExpired(true);
            setExpiredPlanName(data.licensePlanName);
          } else {
            // Licença ativa e acesso liberado
            setIsAllowed(true);
          }
        }
      } catch (err) {
        logger.error('[AccessGate] Erro ao validar licença:', err);
        setIsAllowed(false);
      } finally {
        setChecking(false);
      }
    };

    checkAccess();
  }, [user, reloadTrigger]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <div className="text-center space-y-4">
          <Loader2 size={36} className="animate-spin text-brand-500 mx-auto" />
          <p className="text-ink-400 text-[10px] tracking-[0.2em] font-black uppercase">Homologando Acesso Clínico...</p>
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <LicenseActivationScreen
        isExpired={isExpired}
        expiredPlanName={expiredPlanName}
        onActivated={() => setReloadTrigger(prev => prev + 1)}
      />
    );
  }

  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900">
      <div className="text-center">
        <Loader2 size={40} className="animate-spin text-white/70 mx-auto mb-4" />
        <p className="text-brand-100/60 text-sm">Carregando LAUD.US...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthRouter />
    </ErrorBoundary>
  );
}

function AuthRouter() {
  const { user, setUser } = useApp();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, [setUser]);

  if (!authChecked) return <LoadingScreen />;
  if (!user) return <LoginScreen />;
  return (
    <UserAccessGate>
      <AuthenticatedApp />
    </UserAccessGate>
  );
}
