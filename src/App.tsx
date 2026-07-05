import { useEffect, useState, useRef, ReactNode, lazy, Suspense } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, firestore } from './lib/firebase';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { useApp } from './store/app';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/LoginScreen';
import { LandingScreen } from './components/LandingScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { PageTransition } from './components/PageTransition';
import { Toast } from './components/Toast';
import { CommandPalette } from './components/CommandPalette';
import { CreateExamModal } from './components/CreateExamModal';
import { ClinicSessionModal } from './components/ClinicSessionModal';
import { SupportCenterModal } from './components/SupportCenterModal';
import { BroadcastBanner } from './components/BroadcastBanner';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';
import { OfflineBanner } from './components/OfflineBanner';
import { EmailVerificationBanner } from './components/EmailVerificationBanner';
import { AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

import { classNames } from './utils/format';
import { logger } from './utils/logger';
import { watchSystemTheme } from './utils/theme';
import { useConfirmStore } from './hooks/useConfirm';
import { useSubscription } from './hooks/useSubscription';
import { consumePendingTermsAcceptance } from './lib/legalConsent';
import { useClinicMemberships } from './hooks/useClinicMemberships';
import { useAllAccessibleClinics } from './hooks/useAllAccessibleClinics';
import { ConfirmDialog } from './components/ConfirmDialog';

// ── Eager loads (critical path: Dashboard é a landing view) ──
import { Dashboard } from './modules/dashboard/Dashboard';
import { Worklist } from './modules/worklist/Worklist';

// ── Lazy loads (secondary modules) ──
// ExamEditor é lazy: arrasta o motor de IA + Tiptap + LaudCopilot, só
// necessários ao abrir um exame (não no load inicial).
const ExamEditor = lazy(() => import('./modules/editor/ExamEditor').then(m => ({ default: m.ExamEditor })));
const Patients = lazy(() => import('./modules/patients/Patients').then(m => ({ default: m.Patients })));
const PatientDetail = lazy(() => import('./modules/patients/PatientDetail').then(m => ({ default: m.PatientDetail })));
const Appointments = lazy(() => import('./modules/appointments/Appointments').then(m => ({ default: m.Appointments })));
const Templates = lazy(() => import('./modules/templates/Templates').then(m => ({ default: m.Templates })));
const TemplateEditor = lazy(() => import('./modules/templates/TemplateEditor').then(m => ({ default: m.TemplateEditor })));
const Settings = lazy(() => import('./modules/settings/Settings').then(m => ({ default: m.Settings })));
const DicomControlCenter = lazy(() => import('./modules/dicom/DicomControlCenter').then(m => ({ default: m.DicomControlCenter })));
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
    'exam-editor': view.name === 'exam-editor' ? lazy('Editor de Laudo', <ExamEditor key={view.examId} examId={view.examId} />) : null,
    templates: lazy('Templates', <Templates />),
    'template-editor': view.name === 'template-editor' ? lazy('Editor de Template', <TemplateEditor key={view.templateId} templateId={view.templateId} />) : null,
    settings: lazy('Configurações', <Settings />),
    dicom: lazy('PACS / DICOM', <DicomControlCenter />),
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
  const { showCreateExamModal, setShowCreateExamModal, view, loadSettings, setView } = useApp();
  const { isTrialing, isPastDue, trialDaysLeft } = useSubscription();
  // Popula clinicOwnerMap (clínicas de outros donos compartilhadas via
  // convite) — usado por toda a camada de dados para redirecionar
  // leituras/escritas à subárvore do dono quando o usuário atual é membro,
  // não dono. Ver src/store/clinicAccess.ts.
  useClinicMemberships();

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
      <EmailVerificationBanner />
      <BroadcastBanner />
      
      {isPastDue && (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-md border-b border-rose-700 animate-pulse shrink-0">
          <div className="flex items-center gap-2">
            <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-black shrink-0">Atraso</span>
            <span>Houve um problema com a cobrança da sua assinatura. Regularize seus dados de pagamento para evitar a suspensão dos serviços IA e adicionais.</span>
          </div>
          <button 
            onClick={() => setView({ name: 'settings', activeTab: 'assinatura' })}
            className="bg-white text-rose-700 hover:bg-rose-50 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer"
          >
            Regularizar Assinatura
          </button>
        </div>
      )}
      {isTrialing && (
        <div className="bg-brand-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-md border-b border-brand-700 shrink-0">
          <div className="flex items-center gap-2">
            <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-black shrink-0">Trial</span>
            <span>Você está no Período de Testes. Restam <strong>{trialDaysLeft} dias</strong> de acesso gratuito.</span>
          </div>
          <button 
            onClick={() => setView({ name: 'settings', activeTab: 'assinatura' })}
            className="bg-white text-brand-600 hover:bg-brand-50 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer"
          >
            Ativar Assinatura
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 flex-col md:flex-row overflow-hidden">
        <Sidebar />
        <ViewRenderer />
      </div>
      {view.name !== 'exam-editor' && <BottomNav />}
      <Toast />
      <CommandPalette />
      {showCreateExamModal && <CreateExamModal onClose={() => setShowCreateExamModal(false)} />}
      <ClinicSessionCheck />
      <SupportCenterModal />
      <PWAUpdatePrompt />
      <GlobalConfirmDialog />
    </div>
  );
}

function ClinicSessionCheck() {
  const { selectedClinicId, setSelectedClinic, settings, updateSettings } = useApp();
  const { data: clinics, loading: clinicsLoading } = useAllAccessibleClinics();
  const [showModal, setShowModal] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current || clinicsLoading) return;
    const appState = useApp.getState();
    if (appState.selectedClinicId || appState.settings.defaultClinicId) {
      checked.current = true;
      return;
    }
    if (clinics.length >= 2) {
      checked.current = true;
      setShowModal(true);
    } else if (clinics.length === 1 && clinics[0].shared) {
      // Único acesso é uma clínica compartilhada (0 clínicas próprias) — sem
      // seleção explícita, "todas as clínicas" (null) cairia na própria
      // subárvore vazia do membro, não na do dono.
      checked.current = true;
      setSelectedClinic(clinics[0].id);
    } else {
      checked.current = true;
    }
  }, [clinics, clinicsLoading, setSelectedClinic]);

  function handleSelect(clinicId: string | null, remember: boolean) {
    setSelectedClinic(clinicId);
    if (remember && clinicId) {
      updateSettings({ defaultClinicId: clinicId });
    }
    setShowModal(false);
  }

  if (!showModal) return null;
  const activeClinics = clinics.filter(c => c.active !== false);
  return <ClinicSessionModal clinics={activeClinics} onSelect={handleSelect} />;
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

function UserAccessGate({ children }: { children: ReactNode }) {
  const { user } = useApp();
  const [checking, setChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAllowed(false);
      setChecking(false);
      useApp.getState().setProfile(null);
      return;
    }

    const userRef = doc(firestore, 'users', user.uid);

    // Rede de segurança: nunca travar eternamente na tela de homologação.
    let gateTimer: any;

    const unsub = onSnapshot(userRef, async (snap) => {
      try {
        let userData = snap.exists() ? snap.data() : null;

        const SUPER_ADMIN_EMAIL = 'matheuskpires@gmail.com';
        const isSuperAdminEmail = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

        if (!userData) {
          logger.info('[AUTH] Novo usuário detectado. Provisionando perfil de testes (Trial)...');
          const now = Date.now();
          const pendingTerms = consumePendingTermsAcceptance();
          userData = {
            name: user.displayName || user.email?.split('@')[0] || 'Médico',
            email: user.email,
            role: isSuperAdminEmail ? 'admin' : 'medico',
            active: true,
            subscriptionStatus: 'trialing',
            createdAt: now,
            updatedAt: now,
            reportsUsedThisMonth: 0,
            reportsQuota: 100,
            clinicsQuota: 5,
            // Google OAuth não passa pelo checkbox de cadastro (fluxo direto);
            // só e-mail/senha grava aceite explícito registrado no LoginScreen.
            ...(pendingTerms ? { termsAcceptedAt: pendingTerms.termsAcceptedAt, termsVersion: pendingTerms.termsVersion } : {}),
          };
          await setDoc(userRef, userData);
        } else if (isSuperAdminEmail && userData.role !== 'admin') {
          logger.info('[AUTH] Promovendo Super Admin no Firestore...');
          try {
            userData.role = 'admin';
            await setDoc(userRef, { role: 'admin' }, { merge: true });
          } catch (clientErr) {
            logger.warn('[AUTH] Falha ao promover via client-side (regras de segurança). Tentando via API...', clientErr);
            try {
              const idToken = await user.getIdToken();
              const response = await fetch('/api/promote-admin', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ userId: user.uid, email: user.email }),
              });
              if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Erro na API de promoção.');
              }
              logger.info('[AUTH] Promoção via API concluída.');
            } catch (apiErr) {
              logger.error('[AUTH] Falha crítica ao promover Super Admin via API:', apiErr);
            }
          }
        }

        // Sincroniza o perfil do usuário no Zustand store
        useApp.getState().setProfile(userData);

        if (userData.role === 'admin') {
          setIsAllowed(true);
        } else if (import.meta.env.DEV && user.uid === 'dev-admin-uid') {
          setIsAllowed(true);
        } else if (userData.active === false) {
          setIsAllowed(false);
        } else {
          const hasLegacyLicense = userData.licenseExpiresAt && userData.licenseExpiresAt > Date.now();
          const isAllowedStatus = ['trialing', 'active', 'past_due'].includes(userData.subscriptionStatus);
          
          if (isAllowedStatus || hasLegacyLicense) {
            setIsAllowed(true);
          } else {
            setIsAllowed(false);
          }
        }
      } catch (err) {
        logger.error('[AccessGate] Erro ao validar acesso:', err);
        setIsAllowed(false);
      } finally {
        setChecking(false);
        clearTimeout(gateTimer);
      }
    }, (err) => {
      logger.error('[AccessGate] Listener do Firestore falhou:', err);
      setIsAllowed(false);
      setChecking(false);
      clearTimeout(gateTimer);
    });

    // Se o Firestore não responder em 15s (ex.: env do Firebase quebrada no
    // build), libera a UI em vez de congelar para sempre na homologação.
    gateTimer = setTimeout(() => {
      logger.warn('[AccessGate] Timeout ao validar acesso — liberando a UI.');
      setChecking(false);
    }, 15000);

    return () => { unsub(); clearTimeout(gateTimer); };
  }, [user]);

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
    return <OnboardingScreen />;
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

// Deslogado: landing institucional é a tela inicial; "Entrar"/"Cadastre-se"
// revela o formulário dentro do mesmo app (mesmo domínio/deploy). Remonta do
// zero sempre que `user` vira null (login OU logout), então sempre volta
// para a landing por padrão — nunca fica "preso" na tela de login.
function UnauthenticatedGate() {
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);
  if (authMode) return <LoginScreen initialMode={authMode} onBack={() => setAuthMode(null)} />;
  return <LandingScreen onEnter={setAuthMode} />;
}

function AuthRouter() {
  const { user, setUser } = useApp();
  const [authChecked, setAuthChecked] = useState(false);

  // Reage a mudanças do tema do SO quando a preferência é "system".
  useEffect(() => {
    return watchSystemTheme(() => useApp.getState().settings.theme || 'system');
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, [setUser]);

  if (!authChecked) return <LoadingScreen />;
  if (!user) return <UnauthenticatedGate />;
  return (
    <UserAccessGate>
      <AuthenticatedApp />
    </UserAccessGate>
  );
}
