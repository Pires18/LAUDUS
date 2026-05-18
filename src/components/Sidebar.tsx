import { useState } from 'react';
import { useApp } from '../store/app';
import { useAuth } from '../hooks/useAuth';
import { useAdmin } from '../hooks/useAdmin';
import { useCollection } from '../hooks/useFirestore';
import { Clinic, ExamRequest } from '../types';
import {
  LayoutDashboard, ClipboardList, UserCircle, FileSignature, 
  Calculator, Sparkles, Hospital, Sliders, PanelLeftClose, 
  PanelLeftOpen, ChevronDown, FilePlus, ShieldCheck, LifeBuoy,
  Users, LogOut
} from 'lucide-react';
import { classNames } from '../utils/format';
import { CreateExamModal } from './CreateExamModal';
import { LogoIcon } from './LogoIcon';

const items = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, view: { name: 'dashboard' as const }, roles: ['admin', 'medico', 'recepcao'] },
  { key: 'worklist', label: 'Worklist', icon: ClipboardList, view: { name: 'worklist' as const }, roles: ['admin', 'medico', 'recepcao'] },
  { key: 'patients', label: 'Pacientes', icon: Users, view: { name: 'patients' as const }, roles: ['admin', 'medico', 'recepcao'] },
  { key: 'templates', label: 'Máscaras', icon: FileSignature, view: { name: 'templates' as const }, roles: ['admin', 'medico'] },
  { key: 'calculators', label: 'Calculadoras', icon: Calculator, view: { name: 'calculators' as const }, roles: ['admin', 'medico'] },
  { key: 'clinics', label: 'Clínicas', icon: Hospital, view: { name: 'clinics' as const }, roles: ['admin'] },
  { key: 'settings', label: 'Perfil', icon: UserCircle, view: { name: 'settings' as const }, roles: ['admin', 'medico', 'recepcao'] },
];

export function Sidebar() {
  const { 
    view, setView, selectedClinicId, setSelectedClinic, 
    showToast, setShowCreateExamModal, setShowSupportModal, settings 
  } = useApp();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const [collapsed, setCollapsed] = useState(false);
  const [showClinicDropdown, setShowClinicDropdown] = useState(false);

  const { data: clinics } = useCollection<Clinic>('clinics');
  const { data: exams } = useCollection<ExamRequest>('exams');

  const selectedClinic = clinics.find(c => c.id === selectedClinicId);
  const pendingCount = exams.filter(e => e.status === 'pendente' && (!selectedClinicId || e.clinicId === selectedClinicId)).length;

  return (
    <aside
      className={classNames(
        'hidden md:flex shrink-0 border-r border-ink-100 bg-white flex-col h-full transition-all duration-300 ease-in-out',
        collapsed ? 'w-[64px]' : 'w-60'
      )}
    >
      {/* Logo / Brand */}
      <div className="p-3 border-b border-ink-100 bg-brand-50/30">
        <div className={classNames(
          'flex items-center',
          collapsed ? 'justify-center' : 'gap-3'
        )}>
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-md shrink-0 ring-2 ring-brand-100 overflow-hidden">
            <LogoIcon size={32} />
          </div>
          {!collapsed && (
            <div className="animate-fade-in flex-1 min-w-0 py-1">
              <h1 className="text-xl font-black text-ink-900 leading-none tracking-tighter select-none">
                LAUD<span className="text-brand-600">.US</span>
              </h1>
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
                <Hospital size={16} className="text-brand-600 shrink-0" />
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
                <ClipboardList size={14} /> Todas as Clínicas
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
                      <Hospital size={14} className={selectedClinicId === c.id ? "text-brand-600" : "text-ink-400"} />
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
        <button
          onClick={() => setShowCreateExamModal(true)}
          className={classNames(
            'w-full flex items-center rounded-lg text-sm font-bold transition-all duration-200 mb-4 bg-brand-600 text-white shadow-md hover:bg-brand-700',
            collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
          )}
        >
          <FilePlus size={collapsed ? 18 : 16} className="shrink-0" />
          {!collapsed && <span className="animate-fade-in">Novo Laudo</span>}
        </button>

        {items.filter(item => item.roles.includes(settings.currentRole || 'medico')).map(item => {
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
      
      {/* Admin Quick Access (Bottom) */}
      {isAdmin && (
        <div className="px-3 pb-4">
          <button
            onClick={() => setView({ name: 'admin' })}
            title={collapsed ? 'Administração' : undefined}
            className={classNames(
              'w-full flex items-center rounded-[1.5rem] transition-all duration-500 relative overflow-hidden group shadow-premium',
              collapsed ? 'justify-center p-3.5' : 'gap-3 px-5 py-4',
              view.name === 'admin'
                ? 'bg-ink-900 text-white ring-4 ring-brand-500/20'
                : 'bg-white text-brand-700 border-2 border-brand-100 hover:border-brand-500 hover:shadow-xl'
            )}
          >
            <ShieldCheck size={collapsed ? 24 : 18} className={classNames("shrink-0 transition-transform group-hover:scale-110", view.name === 'admin' ? "text-brand-400" : "text-brand-600")} />
            {!collapsed && (
              <div className="flex flex-col items-start leading-none">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] animate-fade-in">Administração</span>
                <span className="text-[8px] text-ink-400 font-bold mt-1 group-hover:text-brand-500 transition-colors uppercase tracking-widest">Master Panel</span>
              </div>
            )}
            {view.name !== 'admin' && !collapsed && (
              <div className="ml-auto w-2 h-2 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(var(--brand-500-rgb),0.5)] animate-pulse" />
            )}
          </button>
        </div>
      )}

      {/* User Profile + Collapse Toggle */}
      <div className="border-t border-ink-100 bg-ink-50/10">
        {collapsed && (
          <div className="flex flex-col items-center py-4 border-b border-ink-100/60 gap-3 animate-fade-in">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                onClick={() => setView({ name: 'settings' })}
                alt=""
                className="w-8 h-8 rounded-full border border-ink-200 object-cover cursor-pointer hover:scale-110 transition-transform shadow-sm"
                title="Meu Perfil"
              />
            ) : (
              <div
                onClick={() => setView({ name: 'settings' })}
                className="w-8 h-8 rounded-full bg-ink-200 flex items-center justify-center text-ink-600 font-black shadow-inner text-xs cursor-pointer hover:scale-110 transition-transform border border-ink-200"
                title="Meu Perfil"
              >
                {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
            )}
            <button
              onClick={signOut}
              className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all duration-300 flex items-center justify-center border border-rose-100 shadow-sm hover:scale-110 active:scale-95"
              title="Sair da Conta"
            >
              <LogOut size={13} />
            </button>
          </div>
        )}

        {!collapsed && (
          <div className="p-4 animate-fade-in">
            <div 
              onClick={() => setView({ name: 'settings' })}
              className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white border border-transparent hover:border-ink-200/50 hover:shadow-soft transition-all duration-300 group cursor-pointer"
              title="Acessar Meu Perfil"
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full border-2 border-white shadow-md object-cover group-hover:scale-105 transition-transform" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-ink-200 flex items-center justify-center text-ink-600 font-black shadow-inner text-xs group-hover:scale-105 transition-transform border-2 border-white">
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-ink-900 truncate group-hover:text-brand-600 transition-colors">
                  {user?.displayName || 'Usuário'}
                </p>
                <p className="text-[10px] text-ink-500 truncate font-semibold">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-3 text-ink-400 hover:text-ink-800 hover:bg-ink-100/30 transition-all text-[10px] font-bold uppercase tracking-widest border-t border-ink-100/30"
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : (
            <>
              <PanelLeftClose size={16} />
              <span>Recolher Menu</span>
            </>
          )}
        </button>

        {!collapsed && (
          <div className="px-5 pb-5 animate-fade-in flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-[9px] bg-white text-ink-600 px-3 py-1.5 rounded-full font-black border border-ink-100 shadow-sm uppercase tracking-widest">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_#10b981]" />
                Online
              </span>
              <button 
                onClick={() => setShowSupportModal(true)}
                className="flex-1 flex items-center justify-center gap-2 text-[9px] bg-brand-50 text-brand-700 px-3 py-1.5 rounded-full font-black border border-brand-100 shadow-sm uppercase tracking-widest hover:bg-brand-600 hover:text-white transition-all active:scale-95"
              >
                <LifeBuoy size={12} />
                Suporte
              </button>
            </div>
            
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-[10px] bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white font-black uppercase tracking-widest transition-all duration-300 border border-rose-100/60 shadow-sm hover:shadow-md active:scale-95 mt-1"
              title="Encerrar Sessão"
            >
              <LogOut size={13} />
              <span>Sair da Conta</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
