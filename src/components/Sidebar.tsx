import { useState } from 'react';
import { useApp } from '../store/app';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useFirestore';
import { Clinic, ExamRequest } from '../types';
import {
  LayoutList, Users, FileText, Settings as SettingsIcon, FilePlus, Activity,
  PanelLeftClose, PanelLeftOpen, Building2, ChevronDown, BrainCircuit, LayoutDashboard
} from 'lucide-react';
import { classNames } from '../utils/format';

const items = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, view: { name: 'dashboard' as const } },
  { key: 'worklist', label: 'Worklist', icon: LayoutList, view: { name: 'worklist' as const } },
  { key: 'new-exam', label: 'Novo Laudo', icon: FilePlus, view: { name: 'new-exam' as const } },
  { key: 'patients', label: 'Pacientes', icon: Users, view: { name: 'patients' as const } },
  { key: 'templates', label: 'Máscaras', icon: FileText, view: { name: 'templates' as const } },
  { key: 'calculators', label: 'Calculadoras', icon: Activity, view: { name: 'calculators' as const } },
  { key: 'laud-ia', label: 'LAUD.IA', icon: BrainCircuit, view: { name: 'laud-ia' as const } },
  { key: 'clinics', label: 'Clínicas', icon: Building2, view: { name: 'clinics' as const } },
  { key: 'settings', label: 'Configurações', icon: SettingsIcon, view: { name: 'settings' as const } },
];

export function Sidebar() {
  const { view, setView, selectedClinicId, setSelectedClinic, showToast } = useApp();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [showClinicDropdown, setShowClinicDropdown] = useState(false);

  const { data: clinics } = useCollection<Clinic>('clinics');
  const { data: exams } = useCollection<ExamRequest>('exams');

  const selectedClinic = clinics.find(c => c.id === selectedClinicId);
  const pendingCount = exams.filter(e => e.status === 'pendente' && (!selectedClinicId || e.clinicId === selectedClinicId)).length;

  return (
    <aside
      className={classNames(
        'hidden md:flex shrink-0 border-r border-ink-100 bg-white flex-col h-screen sticky top-0 transition-all duration-300 ease-in-out',
        collapsed ? 'w-[68px]' : 'w-64'
      )}
    >
      {/* Logo / Brand */}
      <div className="p-4 border-b border-ink-100 bg-brand-50/30">
        <div className={classNames(
          'flex items-center',
          collapsed ? 'justify-center' : 'gap-3'
        )}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-indigo-700 flex items-center justify-center shadow-md shrink-0 ring-2 ring-white">
            <Activity size={20} className="text-white" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in flex-1 min-w-0">
              <h1 className="text-lg font-black text-ink-900 leading-tight tracking-tight">
                LAUD<span className="text-brand-600">.US</span>
              </h1>
              <p className="text-[10px] text-brand-600 font-bold uppercase tracking-widest">
                DIGITAL PLATFORM
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Clinic Selector */}
      {!collapsed && clinics.length > 0 && (
        <div className="p-3 border-b border-ink-50 relative">
          <button
            onClick={() => setShowClinicDropdown(!showClinicDropdown)}
            className="w-full flex items-center justify-between bg-ink-50 hover:bg-ink-100 px-3 py-2 rounded-lg transition-colors border border-ink-200"
          >
            <div className="flex items-center gap-2 truncate">
              {selectedClinic?.logoUrl ? (
                <img src={selectedClinic.logoUrl} alt="" className="w-5 h-5 rounded-md object-cover" />
              ) : (
                <Building2 size={16} className="text-brand-600 shrink-0" />
              )}
              <span className="text-xs font-semibold text-ink-900 truncate">
                {selectedClinic ? selectedClinic.name : 'Todas as Clínicas'}
              </span>
            </div>
            <ChevronDown size={14} className="text-ink-500 shrink-0" />
          </button>

          {showClinicDropdown && (
            <div className="absolute top-full left-3 right-3 mt-1 bg-white border border-ink-200 shadow-lg rounded-xl overflow-hidden z-50">
              <button
                onClick={() => { setSelectedClinic(null); setShowClinicDropdown(false); showToast('Filtro removido', 'info'); }}
                className={classNames(
                  "w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2",
                  !selectedClinicId ? "bg-brand-50 text-brand-700 font-medium" : "hover:bg-ink-50 text-ink-700"
                )}
              >
                <LayoutList size={14} /> Todas as Clínicas
              </button>
              <div className="max-h-48 overflow-y-auto">
                {clinics.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedClinic(c.id); setShowClinicDropdown(false); showToast(`Filtrando: ${c.name}`, 'info'); }}
                    className={classNames(
                      "w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 truncate",
                      selectedClinicId === c.id ? "bg-brand-50 text-brand-700 font-medium" : "hover:bg-ink-50 text-ink-700"
                    )}
                  >
                    {c.logoUrl ? (
                      <img src={c.logoUrl} alt="" className="w-4 h-4 rounded object-cover" />
                    ) : (
                      <Building2 size={14} className={selectedClinicId === c.id ? "text-brand-600" : "text-ink-400"} />
                    )}
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items.map(item => {
          const isActive = view.name === item.key ||
            (item.key === 'patients' && view.name === 'patient-detail') ||
            (item.key === 'templates' && view.name === 'template-editor') ||
            (item.key === 'worklist' && view.name === 'exam-editor') ||
            (item.key === 'clinics' && (view.name === 'clinic-detail' || view.name === 'clinic-form'));
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => setView(item.view)}
              title={collapsed ? item.label : undefined}
              className={classNames(
                'w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 relative',
                collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
                isActive
                  ? 'bg-brand-50 text-brand-700 shadow-soft'
                  : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
              )}
            >
              <Icon size={collapsed ? 18 : 16} className="shrink-0" />
              {!collapsed && <span className="animate-fade-in">{item.label}</span>}
              {!collapsed && item.key === 'worklist' && pendingCount > 0 && (
                <span className="ml-auto bg-brand-100 text-brand-700 py-0.5 px-2 rounded-full text-[10px] font-bold animate-fade-in">
                  {pendingCount}
                </span>
              )}
              {collapsed && item.key === 'worklist' && pendingCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-brand-500 rounded-full ring-2 ring-white" />
              )}
            </button>
          );
        })}
      </nav>

      {/* User Profile + Collapse Toggle */}
      <div className="border-t border-ink-100 bg-ink-50/20">
        {!collapsed && (
          <div className="p-4 border-b border-ink-50 animate-fade-in">
            <div className="flex items-center gap-3">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full border-2 border-white shadow-soft object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-ink-200 flex items-center justify-center text-ink-600 font-bold shadow-soft">
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ink-900 truncate">
                  {user?.displayName || 'Usuário'}
                </p>
                <p className="text-[11px] text-ink-500 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-3 text-ink-400 hover:text-ink-700 hover:bg-ink-100/50 transition-colors text-xs"
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : (
            <>
              <PanelLeftClose size={14} />
              <span className="font-medium">Recolher Barra Lateral</span>
            </>
          )}
        </button>

        {!collapsed && (
          <div className="px-4 pb-4 animate-fade-in text-center">
            <span className="inline-flex items-center gap-1.5 text-[9px] bg-white text-ink-500 px-2.5 py-1 rounded-full font-bold border border-ink-100 shadow-sm uppercase tracking-wider">
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              Sistema Online
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
