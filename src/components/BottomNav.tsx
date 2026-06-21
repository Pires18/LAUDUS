import { useState } from 'react';
import { useApp } from '../store/app';
import { useCollection } from '../hooks/useFirestore';
import { ExamRequest } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useAdmin } from '../hooks/useAdmin';
import { useSubscription } from '../hooks/useSubscription';
import {
  LayoutDashboard, ClipboardList, FilePlus, Users,
  UserCircle, CalendarDays, FileSignature, Sparkles,
  Calculator, Hospital, ShieldCheck, LifeBuoy, LogOut,
  Menu, X, Database
} from 'lucide-react';
import { classNames } from '../utils/format';
import { motion, AnimatePresence } from 'framer-motion';

export function BottomNav() {
  const { view, setView, setShowCreateExamModal, setShowSupportModal, settings } = useApp();
  const { user, signOut } = useAuth();
  const { isAdmin, role } = useAdmin();
  const { hasPacs, hasCalculators, hasAppointments, hasClinics } = useSubscription();
  
  const { data: exams } = useCollection<ExamRequest>('exams');
  const pendingCount = exams.filter(e => e.status === 'pendente').length;

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Active view matches
  const isMenuViewActive = ['appointments', 'templates', 'laud-ia', 'calculators', 'clinics', 'settings', 'admin', 'template-editor', 'clinic-detail', 'clinic-form', 'dicom'].includes(view.name);
  
  const activeKey = isMenuViewActive ? 'menu' :
                    view.name.includes('patient') ? 'patients' :
                    view.name.includes('exam') || view.name === 'worklist' ? 'worklist' :
                    view.name;

  const navItems = [
    { key: 'dashboard', label: 'Início', icon: LayoutDashboard, view: { name: 'dashboard' as const } },
    { key: 'worklist', label: 'Exames', icon: ClipboardList, view: { name: 'worklist' as const }, badge: pendingCount },
    { key: 'new-exam', label: 'Novo', icon: FilePlus, onClick: () => setShowCreateExamModal(true) },
    { key: 'patients', label: 'Pacientes', icon: Users, view: { name: 'patients' as const } },
    { key: 'menu', label: 'Mais', icon: Menu, onClick: () => setIsMenuOpen(true) },
  ];

  const menuItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, view: { name: 'dashboard' as const }, roles: ['admin', 'medico', 'recepcao'] },
    { key: 'worklist', label: 'Worklist', icon: ClipboardList, view: { name: 'worklist' as const }, roles: ['admin', 'medico', 'recepcao'] },
    { key: 'appointments', label: 'Agendamentos', icon: CalendarDays, view: { name: 'appointments' as const }, roles: ['admin', 'medico', 'recepcao'] },
    { key: 'patients', label: 'Pacientes', icon: Users, view: { name: 'patients' as const }, roles: ['admin', 'medico', 'recepcao'] },
    { key: 'templates', label: 'Máscaras', icon: FileSignature, view: { name: 'templates' as const }, roles: ['admin', 'medico'] },
    { key: 'laud-ia', label: 'LaudIA', icon: Sparkles, view: { name: 'laud-ia' as const }, roles: ['admin', 'medico'] },
    { key: 'calculators', label: 'Calculadoras', icon: Calculator, view: { name: 'calculators' as const }, roles: ['admin', 'medico'] },
    { key: 'clinics', label: 'Clínicas', icon: Hospital, view: { name: 'clinics' as const }, roles: ['admin', 'medico', 'recepcao'] },
    { key: 'dicom', label: 'PACS / DICOM', icon: Database, view: { name: 'dicom' as const }, roles: ['admin', 'medico'] },
    { key: 'settings', label: 'Meu Perfil', icon: UserCircle, view: { name: 'settings' as const }, roles: ['admin', 'medico', 'recepcao'] },
  ];

  const allowedMenuItems = menuItems
    .filter(item => item.roles.includes(role || 'medico'))
    .filter(item => {
      if (item.key === 'dicom') return hasPacs;
      if (item.key === 'calculators') return hasCalculators;
      if (item.key === 'appointments') return hasAppointments;
      if (item.key === 'clinics') return hasClinics;
      return true;
    });

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-ink-100/80 z-50 flex justify-around items-center"
        style={{
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.5rem)',
          paddingTop: '0.5rem',
        }}
      >
        {navItems.map((item) => {
          const isActive = activeKey === item.key;
          const isNew = item.key === 'new-exam';
          const Icon = item.icon;

          return (
            <button
              key={item.key}
              id={`bottom-nav-${item.key}`}
              onClick={() => item.onClick ? item.onClick() : setView(item.view!)}
              className={classNames(
                "flex flex-col items-center justify-center gap-0.5 relative transition-all duration-200",
                "min-w-[56px] min-h-[56px]",
                isActive && !isNew ? "text-brand-600" : isNew ? "text-white" : "text-ink-400",
              )}
              aria-label={item.label}
            >
              {/* New exam — floating action button style */}
              {isNew ? (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/30 -mt-5 active:scale-95 transition-transform border-4 border-white">
                  <Icon size={26} strokeWidth={2.5} />
                </div>
              ) : (
                <>
                  {/* Active pill background */}
                  <div className={classNames(
                    "relative flex items-center justify-center w-12 h-8 rounded-2xl transition-all duration-300",
                    isActive ? "bg-brand-100 bottom-nav-pill" : ""
                  )}>
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />

                    {/* Badge for pending count */}
                    {item.badge && item.badge > 0 ? (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-brand-600 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 shadow-sm ring-2 ring-white animate-scale-in">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    ) : null}
                  </div>
                  <span className={classNames(
                    "text-[10px] font-semibold tracking-tight leading-none",
                    isActive ? "font-black" : ""
                  )}>
                    {item.label}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Slide-Up Bottom Drawer Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-[100] md:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm"
            />

            {/* Menu Drawer */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl border-t border-ink-100 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            >
              {/* Drag indicator & Header */}
              <div className="flex flex-col items-center pt-3 pb-2 px-6 border-b border-ink-50 bg-ink-50/5 flex-shrink-0">
                <div className="w-12 h-1 bg-ink-200 rounded-full mb-3" />
                <div className="w-full flex items-center justify-between">
                  <h3 className="text-base font-black text-ink-900 uppercase tracking-wider">Menu Principal</h3>
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="p-2 hover:bg-ink-100 rounded-xl text-ink-400"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* User Profile Card inside Menu */}
              <div className="p-5 border-b border-ink-50 bg-ink-50/10 flex items-center gap-3">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full border-2 border-white shadow-md object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-black shadow-md text-sm border-2 border-white">
                    {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-ink-900 truncate">
                    {user?.displayName || 'Usuário'}
                  </p>
                  <p className="text-xs text-ink-500 truncate font-semibold">
                    {user?.email}
                  </p>
                </div>
              </div>

              {/* Modules Grid */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-3 gap-4">
                  {allowedMenuItems.map((item) => {
                    const isActive = view.name === item.key ||
                      (item.key === 'patients' && view.name === 'patient-detail') ||
                      (item.key === 'templates' && view.name === 'template-editor') ||
                      (item.key === 'worklist' && view.name === 'exam-editor') ||
                      (item.key === 'clinics' && (view.name === 'clinic-detail' || view.name === 'clinic-form'));
                    
                    const Icon = item.icon;
                    const isLaudIA = item.key === 'laud-ia';

                    return (
                      <button
                        key={item.key}
                        onClick={() => {
                          setView(item.view);
                          setIsMenuOpen(false);
                        }}
                        className={classNames(
                          "flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all duration-200 gap-2 relative group",
                          isActive
                            ? "bg-brand-50 border-brand-200 text-brand-700 font-bold shadow-sm"
                            : isLaudIA
                              ? "bg-violet-50/50 border-violet-100 text-violet-600 hover:bg-violet-50"
                              : "bg-white border-ink-100 text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                        )}
                      >
                        <Icon size={24} className={isActive ? "text-brand-600" : isLaudIA ? "text-violet-500" : "text-ink-500"} />
                        <span className="text-[10px] font-bold leading-tight truncate w-full">{item.label}</span>
                        
                        {isLaudIA && (
                          <span className="absolute -top-1 -right-1 text-[8px] bg-violet-100 text-violet-600 px-1 rounded-full font-black">IA</span>
                        )}
                      </button>
                    );
                  })}

                  {/* Administration tab inside drawer */}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setView({ name: 'admin' });
                        setIsMenuOpen(false);
                      }}
                      className={classNames(
                        "flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all duration-200 gap-2 relative group",
                        view.name === 'admin'
                          ? "bg-ink-900 border-ink-900 text-white font-bold shadow-sm"
                          : "bg-white border-ink-100 text-ink-750 hover:bg-ink-50"
                      )}
                    >
                      <ShieldCheck size={24} className={view.name === 'admin' ? "text-ink-300" : "text-ink-500"} />
                      <span className="text-[10px] font-bold leading-tight truncate w-full">Admin</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Actions Footer inside Menu */}
              <div className="p-6 border-t border-ink-100 bg-ink-50/30 flex flex-col gap-3 flex-shrink-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1.5rem)' }}>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setShowSupportModal(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 text-xs bg-white text-ink-700 px-4 py-3.5 rounded-2xl font-bold border border-ink-200 uppercase tracking-widest hover:bg-ink-50 transition-all active:scale-95 shadow-sm"
                  >
                    <LifeBuoy size={16} />
                    Suporte
                  </button>
                  <button
                    onClick={signOut}
                    className="flex-1 flex items-center justify-center gap-2 text-xs bg-rose-50 text-rose-600 px-4 py-3.5 rounded-2xl font-bold border border-rose-100 uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all active:scale-95 shadow-sm"
                  >
                    <LogOut size={16} />
                    Sair
                  </button>
                </div>
                <div className="text-center">
                  <span className="text-[8px] font-black text-ink-300 uppercase tracking-[0.2em]">
                    LAUD.US v2.0 · LAUD.IA v2.0
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
