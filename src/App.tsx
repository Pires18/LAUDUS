import { useEffect, useState, ReactNode, lazy, Suspense } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import { useApp } from './store/app';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { PageTransition } from './components/PageTransition';
import { Toast } from './components/Toast';
import { CommandPalette } from './components/CommandPalette';
import { Loader2 } from 'lucide-react';

// ── Eager loads (critical path) ──
import { Dashboard } from './modules/dashboard/Dashboard';
import { Worklist } from './modules/worklist/Worklist';
import { ExamEditor } from './modules/editor/ExamEditor';
import { NewExam } from './modules/forms/NewExam';

// ── Lazy loads (secondary modules) ──
const Patients = lazy(() => import('./modules/patients/Patients').then(m => ({ default: m.Patients })));
const PatientDetail = lazy(() => import('./modules/patients/PatientDetail').then(m => ({ default: m.PatientDetail })));
const Templates = lazy(() => import('./modules/templates/Templates').then(m => ({ default: m.Templates })));
const TemplateEditor = lazy(() => import('./modules/templates/TemplateEditor').then(m => ({ default: m.TemplateEditor })));
const Settings = lazy(() => import('./modules/settings/Settings').then(m => ({ default: m.Settings })));
const LaudIA = lazy(() => import('./modules/laud-ia/LaudIA').then(m => ({ default: m.LaudIA })));
const Calculators = lazy(() => import('./modules/calculators/Calculators').then(m => ({ default: m.Calculators })));
const Clinics = lazy(() => import('./modules/clinics/Clinics').then(m => ({ default: m.Clinics })));
const ClinicDetail = lazy(() => import('./modules/clinics/ClinicDetail').then(m => ({ default: m.ClinicDetail })));
const ClinicForm = lazy(() => import('./modules/clinics/ClinicForm').then(m => ({ default: m.ClinicForm })));

function LazyFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={24} className="animate-spin text-brand-500" />
    </div>
  );
}

function ViewRenderer() {
  const { view } = useApp();

  const views: Record<string, ReactNode> = {
    dashboard: <Dashboard />,
    worklist: <Worklist />,
    patients: <Suspense fallback={<LazyFallback />}><Patients /></Suspense>,
    'patient-detail': view.name === 'patient-detail' ? <Suspense fallback={<LazyFallback />}><PatientDetail patientId={view.patientId} /></Suspense> : null,
    'new-exam': <NewExam />,
    'exam-editor': view.name === 'exam-editor' ? <ExamEditor examId={view.examId} /> : null,
    templates: <Suspense fallback={<LazyFallback />}><Templates /></Suspense>,
    'template-editor': view.name === 'template-editor' ? <Suspense fallback={<LazyFallback />}><TemplateEditor templateId={view.templateId} /></Suspense> : null,
    settings: <Suspense fallback={<LazyFallback />}><Settings /></Suspense>,
    'laud-ia': <Suspense fallback={<LazyFallback />}><LaudIA /></Suspense>,
    calculators: <Suspense fallback={<LazyFallback />}><Calculators /></Suspense>,
    clinics: <Suspense fallback={<LazyFallback />}><Clinics /></Suspense>,
    'clinic-detail': view.name === 'clinic-detail' ? <Suspense fallback={<LazyFallback />}><ClinicDetail clinicId={view.clinicId} /></Suspense> : null,
    'clinic-form': view.name === 'clinic-form' ? <Suspense fallback={<LazyFallback />}><ClinicForm clinicId={view.clinicId} /></Suspense> : null,
  };

  const isFullBleed = view.name === 'exam-editor';

  return (
    <main className={isFullBleed ? 'flex-1 min-w-0' : 'flex-1 min-w-0 p-4 md:p-6 lg:p-8 pb-24 md:pb-8'}>
      <div key={view.name} className={isFullBleed ? 'h-screen' : 'mx-auto'}>
        {views[view.name] ?? null}
      </div>
    </main>
  );
}

function AuthenticatedApp() {
  const { loadSettings } = useApp();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-ink-50/30">
      <Sidebar />
      <ViewRenderer />
      <BottomNav />
      <Toast />
      <CommandPalette />
    </div>
  );
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
  return <AuthenticatedApp />;
}
