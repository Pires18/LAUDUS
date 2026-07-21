import { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../store/app';
import { useCollection } from '../hooks/useFirestore';
import { useAdmin } from '../hooks/useAdmin';
import { Patient, ExamRequest, ReportTemplate, EXAM_AREAS } from '../types';
import {
  Search, Users, FileText, LayoutList, Settings,
  BrainCircuit, ArrowRight, CornerDownLeft, FilePlus, LayoutDashboard,
  Clock, CheckCircle2, CircleDot
} from 'lucide-react';
import { classNames, calculateAge, formatDateTime } from '../utils/format';
import { motion, AnimatePresence } from 'framer-motion';

interface CommandItem {
  id: string;
  type: 'nav' | 'patient' | 'exam' | 'template';
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  action: () => void;
  status?: string;
}

export function CommandPalette() {
  const { setView, setShowCreateExamModal } = useApp();
  const { role } = useAdmin();
  const isReception = role === 'recepcao';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: patients } = useCollection<Patient>('patients');
  const { data: exams } = useCollection<ExamRequest>('exams');
  const { data: templates } = useCollection<ReportTemplate>('templates');

  const patientMap = useMemo(() => new Map(patients.map(p => [p.id, p])), [patients]);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
        setQuery('');
        setSelectedIdx(0);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build command items
  const navItems: CommandItem[] = useMemo(() => [
    { id: 'nav-dashboard', type: 'nav', label: 'Dashboard', icon: <LayoutDashboard size={16} />, action: () => setView({ name: 'dashboard' }) },
    { id: 'nav-worklist', type: 'nav', label: 'Worklist', icon: <LayoutList size={16} />, action: () => setView({ name: 'worklist' }) },
    // Recepção não cria laudos nem usa máscaras/LAUD.IA
    ...(!isReception ? [
      { id: 'nav-new-exam', type: 'nav' as const, label: 'Novo Laudo', icon: <FilePlus size={16} />, action: () => setShowCreateExamModal(true) },
      { id: 'nav-templates', type: 'nav' as const, label: 'Máscaras', icon: <FileText size={16} />, action: () => setView({ name: 'templates' }) },
      { id: 'nav-laudia', type: 'nav' as const, label: 'LAUD.IA', icon: <BrainCircuit size={16} />, action: () => setView({ name: 'laud-ia' }) },
    ] : []),
    { id: 'nav-patients', type: 'nav', label: 'Pacientes', icon: <Users size={16} />, action: () => setView({ name: 'patients' }) },
    { id: 'nav-settings', type: 'nav', label: 'Configurações', icon: <Settings size={16} />, action: () => setView({ name: 'settings' }) },
  ], [setView, isReception]);

  const allItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [...navItems];

    // Patients
    patients.forEach(p => {
      items.push({
        id: `patient-${p.id}`,
        type: 'patient',
        label: p.name,
        sublabel: `Paciente · ${calculateAge(p.birthDate) || 'Sem DN'}`,
        icon: <Users size={16} className="text-emerald-500" />,
        action: () => setView({ name: 'patient-detail', patientId: p.id }),
      });
    });

    // Exams
    exams.forEach(e => {
      const patient = patientMap.get(e.patientId);
      items.push({
        id: `exam-${e.id}`,
        type: 'exam',
        label: patient?.name || 'Exame',
        sublabel: `${e.examType} · ${formatDateTime(e.createdAt)}`,
        status: e.status,
        icon: e.status === 'finalizado' ? <CheckCircle2 size={16} className="text-emerald-500" /> : 
              e.status === 'em-andamento' ? <CircleDot size={16} className="text-brand-500" /> : 
              <Clock size={16} className="text-amber-500" />,
        action: () => setView({ name: 'exam-editor', examId: e.id }),
      });
    });

    // Templates
    templates.forEach(t => {
      const area = EXAM_AREAS.find(a => a.id === t.area);
      items.push({
        id: `template-${t.id}`,
        type: 'template',
        label: t.name,
        sublabel: `Máscara · ${area?.label || t.area}`,
        icon: <FileText size={16} className="text-indigo-500" />,
        action: () => setView({ name: 'template-editor', templateId: t.id }),
      });
    });

    return items;
  }, [navItems, patients, exams, templates, setView, patientMap]);

  // Filter
  const filtered = useMemo(() => {
    if (!query) return allItems.slice(0, 15);
    const q = query.toLowerCase();
    return allItems.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.sublabel?.toLowerCase().includes(q)
    ).slice(0, 12);
  }, [allItems, query]);

  // Reset selection when query changes
  useEffect(() => setSelectedIdx(0), [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      e.preventDefault();
      filtered[selectedIdx].action();
      setOpen(false);
      setQuery('');
    }
  }

  // Scroll selected into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.children[selectedIdx] as HTMLElement;
    if (selected) selected.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4" onClick={() => setOpen(false)}>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ink-900/60 backdrop-blur-md" 
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-ink-100 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-4 px-6 py-5 border-b border-ink-50">
              <Search size={22} className="text-brand-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Busca universal (paciente, laudo, máscara...)"
                className="flex-1 text-lg text-ink-900 placeholder:text-ink-400 outline-none bg-transparent font-medium"
              />
              <div className="hidden sm:flex items-center gap-2">
                <kbd className="flex items-center gap-0.5 px-2 py-1 rounded-lg border border-ink-100 bg-ink-50 text-[10px] text-ink-500 font-bold">
                  ESC
                </kbd>
              </div>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-3 scrollbar-hide">
              {filtered.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-ink-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search size={24} className="text-ink-300" />
                  </div>
                  <p className="text-ink-600 font-medium">Nenhum resultado para "{query}"</p>
                  <p className="text-ink-400 text-sm mt-1">Tente buscar por outro termo.</p>
                </div>
              )}

              {/* Group Rendering */}
              {['nav', 'patient', 'exam', 'template'].map(type => {
                const groupItems = filtered.filter(i => i.type === type);
                if (groupItems.length === 0) return null;

                const labels = {
                  nav: 'Acesso Rápido',
                  patient: 'Pacientes',
                  exam: 'Exames Recentes',
                  template: 'Modelos de Laudo'
                };

                return (
                  <div key={type} className="mb-4">
                    <div className="px-6 py-2 text-[11px] font-black uppercase tracking-[0.15em] text-ink-400 flex items-center gap-3">
                      <span>{labels[type as keyof typeof labels]}</span>
                      <div className="h-px bg-ink-50 flex-1" />
                    </div>
                    {groupItems.map(item => {
                      const globalIdx = filtered.indexOf(item);
                      return (
                        <CommandRow
                          key={item.id}
                          item={item}
                          isSelected={globalIdx === selectedIdx}
                          onClick={() => { item.action(); setOpen(false); setQuery(''); }}
                          onMouseEnter={() => setSelectedIdx(globalIdx)}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Footer hints */}
            <div className="px-6 py-3 border-t border-ink-50 bg-ink-50/30 flex items-center gap-6 text-[11px] text-ink-500 font-medium">
              <span className="flex items-center gap-1.5"><CornerDownLeft size={12} className="text-ink-300" /> <span className="text-ink-900">Enter</span> para selecionar</span>
              <span className="flex items-center gap-1.5"><span className="text-ink-900">↑↓</span> para navegar</span>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-ink-400">Atalho rápido</span>
                <kbd className="px-2 py-1 rounded-lg border border-ink-200 bg-white font-bold text-[10px] text-ink-900 shadow-sm">⌘ K</kbd>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function CommandRow({ item, isSelected, onClick, onMouseEnter }: {
  item: CommandItem;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={classNames(
        "w-full flex items-center gap-4 px-6 py-3 text-left transition-all duration-200",
        isSelected ? "bg-brand-50/80 translate-x-1" : "text-ink-700 hover:bg-ink-50/50"
      )}
    >
      <div className={classNames(
        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
        isSelected ? "bg-white shadow-sm text-brand-600" : "bg-ink-50 text-ink-400"
      )}>
        {item.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={classNames(
            "text-sm font-bold truncate block",
            isSelected ? "text-brand-900" : "text-ink-900"
          )}>{item.label}</span>
          {item.status && (
            <span className={classNames(
              "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md",
              item.status === 'finalizado' ? "bg-emerald-100 text-emerald-700" : 
              item.status === 'em-andamento' ? "bg-brand-100 text-brand-700" : 
              "bg-amber-100 text-amber-700"
            )}>
              {item.status}
            </span>
          )}
        </div>
        {item.sublabel && <span className="text-[11px] text-ink-400 truncate block font-medium">{item.sublabel}</span>}
      </div>
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
          >
            <ArrowRight size={16} className="shrink-0 text-brand-400" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

