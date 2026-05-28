import { useApp } from '../store/app';
import { useCollection } from '../hooks/useFirestore';
import { ExamRequest } from '../types';
import { LayoutDashboard, LayoutList, FilePlus, Users, UserCircle } from 'lucide-react';
import { classNames } from '../utils/format';

export function BottomNav() {
  const { view, setView, setShowCreateExamModal } = useApp();
  const { data: exams } = useCollection<ExamRequest>('exams');
  const pendingCount = exams.filter(e => e.status === 'pendente').length;

  const navItems = [
    { key: 'dashboard', label: 'Início', icon: LayoutDashboard, view: { name: 'dashboard' as const } },
    { key: 'worklist', label: 'Exames', icon: LayoutList, view: { name: 'worklist' as const }, badge: pendingCount },
    { key: 'new-exam', label: 'Novo', icon: FilePlus, onClick: () => setShowCreateExamModal(true) },
    { key: 'patients', label: 'Pacientes', icon: Users, view: { name: 'patients' as const } },
    { key: 'settings', label: 'Perfil', icon: UserCircle, view: { name: 'settings' as const } },
  ];

  const activeKey = view.name.includes('patient') ? 'patients' :
                    view.name.includes('exam') ? 'worklist' :
                    view.name === 'template-editor' ? 'worklist' :
                    view.name === 'clinic-detail' || view.name === 'clinic-form' ? 'dashboard' :
                    view.name;

  return (
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
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-brand-600 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 shadow-sm ring-2 ring-white animate-scale-in">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
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
  );
}
