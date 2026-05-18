import { useState } from 'react';
import { useApp } from '../store/app';
import { LayoutDashboard, LayoutList, FilePlus, Users, UserCircle } from 'lucide-react';
import { classNames } from '../utils/format';
import { CreateExamModal } from './CreateExamModal';

export function BottomNav() {
  const { view, setView, setShowCreateExamModal } = useApp();

  const navItems = [
    { key: 'dashboard', label: 'Início', icon: LayoutDashboard, view: { name: 'dashboard' as const } },
    { key: 'worklist', label: 'Exames', icon: LayoutList, view: { name: 'worklist' as const } },
    { key: 'new-exam', label: 'Novo', icon: FilePlus, onClick: () => setShowCreateExamModal(true) },
    { key: 'patients', label: 'Pacientes', icon: Users, view: { name: 'patients' as const } },
    { key: 'settings', label: 'Perfil', icon: UserCircle, view: { name: 'settings' as const } },
  ];

  const activeKey = view.name.includes('patient') ? 'patients' : 
                    view.name.includes('exam') ? 'worklist' : 
                    view.name;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-ink-100 px-6 py-2 pb-safe z-50 flex justify-between items-center">
      {navItems.map((item) => {
        const isActive = activeKey === item.key;
        const Icon = item.icon;
        
        return (
          <button
            key={item.key}
            onClick={() => item.onClick ? item.onClick() : setView(item.view!)}
            className={classNames(
              "flex flex-col items-center gap-1 transition-all duration-200",
              isActive ? "text-brand-600 scale-110" : "text-ink-400"
            )}
          >
            <div className={classNames(
              "p-1.5 rounded-xl transition-all duration-300",
              item.key === 'new-exam' ? "bg-brand-600 text-white shadow-lg shadow-brand-200 -mt-6 p-3" :
              isActive ? "bg-brand-50 shadow-soft" : ""
            )}>
              <Icon size={item.key === 'new-exam' ? 24 : 20} strokeWidth={isActive || item.key === 'new-exam' ? 2.5 : 2} />
            </div>
            <span className={classNames(
              "text-[10px] font-semibold uppercase tracking-tight mt-0.5",
              item.key === 'new-exam' ? "text-brand-700" : ""
            )}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
