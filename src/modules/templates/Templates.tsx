import { useApp } from '../../store/app';
import { useCollection } from '../../hooks/useFirestore';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ReportTemplate, EXAM_AREAS, Clinic, ExamArea } from '../../types';
import { addItemWithId, deleteItem, genId, countWhere, updateItem } from '../../store/db';
import { useState } from 'react';
import { 
  Plus, Search, FileSignature, Trash2, Copy,
  RotateCcw, LayoutGrid, X
} from 'lucide-react';

import { AreaIcon } from '../../components/AreaIcon';
import { CardSkeleton } from '../../components/SkeletonLoader';
import { classNames } from '../../utils/format';



export function Templates() {
  const { 
    setView, 
    showToast, 
    selectedClinicId,
    templateSearch: search,
    setTemplateSearch: setSearch,
    templateAreaFilter: areaFilter,
    setTemplateAreaFilter: setAreaFilter
  } = useApp();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; examCount: number } | null>(null);


  const { data: templates, loading } = useCollection<ReportTemplate>('templates');
  const { data: clinics } = useCollection<Clinic>('clinics');

  const filtered = templates.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (areaFilter !== 'todas' && t.area !== areaFilter) return false;
    if (selectedClinicId && t.clinicId !== selectedClinicId && t.clinicId) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  async function handleCreateNew() {
    const id = genId();
    await addItemWithId('templates', id, {
      name: 'Nova Máscara',
      area: areaFilter !== 'todas' ? areaFilter as ExamArea : 'medicina-interna',
      title: 'TÍTULO DO LAUDO',
      technique: 'Exame realizado com equipamento...',
      analysisTemplate: 'Fígado: dimensões normais, contornos regulares, ecotextura homogênea.',
      conclusionTemplate: 'Exame ecográfico sem alterações significativas.',
      recommendationsTemplate: '',
      clinicId: selectedClinicId || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    setView({ name: 'template-editor', templateId: id });
  }

  async function handleDuplicate(template: ReportTemplate, e: React.MouseEvent) {
    e.stopPropagation();
    const id = genId();
    const { id: _, createdAt, updatedAt, ...rest } = template;
    await addItemWithId('templates', id, {
      ...rest,
      name: `${template.name} (Cópia)`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    showToast('Máscara duplicada', 'success');
  }

  async function handleRequestDelete(id: string, name: string, e: React.MouseEvent) {
    e.stopPropagation();
    const examCount = await countWhere('exams', 'templateId', id);
    setDeleteTarget({ id, name, examCount });
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.examCount > 0) {
      showToast(`Máscara usada em ${deleteTarget.examCount} exame(s).`, 'error');
      setDeleteTarget(null);
      return;
    }
    try {
      await deleteItem('templates', deleteTarget.id);
      showToast('Máscara excluída', 'success');
    } catch {
      showToast('Erro ao excluir máscara', 'error');
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="module-container">
      <div className="max-w-7xl mx-auto w-full animate-fade-in space-y-5">
        
        {/* ─── COMPACT HEADER ─── */}
        <div className="bg-white border border-ink-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shrink-0">
                <FileSignature size={18} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-black text-ink-900 tracking-tight leading-none">Máscaras de Laudo</h1>
                <p className="text-[11px] text-ink-500 font-medium mt-0.5">Gerencie modelos e padrões diagnósticos</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCreateNew}
                className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Plus size={11} />
                Nova Máscara
              </button>
            </div>
          </div>
        </div>

        {/* ─── PILL TAB BAR ─── */}
        <div className="flex items-center gap-1.5 bg-ink-100 p-1 rounded-2xl border border-ink-200/50 overflow-x-auto">
          <button
            onClick={() => setAreaFilter('todas')}
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all duration-200 whitespace-nowrap flex-shrink-0',
              areaFilter === 'todas'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-ink-500 hover:text-ink-800 hover:bg-white/70'
            )}
          >
            <LayoutGrid size={13} />
            Todas
          </button>
          {EXAM_AREAS.map((area) => {
            const isActive = areaFilter === area.id;
            return (
              <button
                key={area.id}
                onClick={() => setAreaFilter(area.id)}
                className={classNames(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all duration-200 whitespace-nowrap flex-shrink-0',
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-ink-500 hover:text-ink-800 hover:bg-white/70'
                )}
              >
                <AreaIcon area={area.id} size={13} />
                {area.label}
              </button>
            );
          })}
        </div>

        {/* ─── SEARCH & FILTER SUMMARY ─── */}
        <div className="bg-white border border-ink-200 rounded-2xl shadow-sm p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar máscara por nome..."
              className="w-full h-9 pl-9 pr-3 bg-ink-50 border border-ink-200 focus:border-brand-400 rounded-xl focus:ring-2 focus:ring-brand-400/10 outline-none transition-all text-sm text-ink-800 placeholder-ink-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600">
                <X size={13} />
              </button>
            )}
          </div>
          {(search || areaFilter !== 'todas') && (
            <button
              onClick={() => { setSearch(''); setAreaFilter('todas'); }}
              className="h-9 px-3 rounded-xl border border-ink-200 text-ink-500 hover:bg-ink-50 font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
            >
              <RotateCcw size={12} />
              Limpar Filtros
            </button>
          )}
        </div>

        {/* ─── TEMPLATES GRID ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            [1, 2, 3, 4, 5, 6].map((i) => <CardSkeleton key={i} />)
          ) : sorted.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-ink-200 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-ink-50 flex items-center justify-center mx-auto mb-3 border border-ink-100">
                <FileSignature size={20} className="text-ink-300" />
              </div>
              <p className="text-sm font-bold text-ink-400">Nenhuma máscara encontrada.</p>
              <button onClick={handleCreateNew} className="text-brand-600 font-black text-[10px] uppercase tracking-widest mt-4 hover:underline">
                + Criar Modelo Base
              </button>
            </div>
          ) : (
            sorted.map((template: any) => {
              const area = EXAM_AREAS.find(a => a.id === template.area);
              async function handleTemplateClick() {
                if (template.isSystem) {
                  showToast('Duplicando máscara oficial para sua biblioteca...', 'info');
                  const id = genId();
                  const { id: _, createdAt, updatedAt, isSystem, ...rest } = template;
                  try {
                    await addItemWithId('templates', id, {
                      ...rest,
                      name: `${template.name} (Personalizada)`,
                      createdAt: Date.now(),
                      updatedAt: Date.now()
                    });
                    showToast('Cópia criada! Agora você pode editá-la.', 'success');
                    setView({ name: 'template-editor', templateId: id });
                  } catch {
                    showToast('Erro ao duplicar máscara', 'error');
                  }
                  return;
                }
                setView({ name: 'template-editor', templateId: template.id });
              }

              return (
                <div
                  key={template.id}
                  onClick={handleTemplateClick}
                  className="group bg-white p-5 rounded-2xl border border-ink-200 hover:border-brand-400 hover:shadow-md transition-all cursor-pointer flex flex-col relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className={classNames("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-inner", area?.color || "bg-ink-100 text-ink-400")}>
                      <AreaIcon area={template.area} size={16} />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={(e) => handleDuplicate(template, e)}
                        className="p-1.5 rounded-xl text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        title="Duplicar"
                      >
                        <Copy size={14} />
                      </button>
                      {!template.isSystem && (
                        <button
                          onClick={(e) => handleRequestDelete(template.id, template.name, e)}
                          className="p-1.5 rounded-xl text-ink-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <h4 className="font-black text-ink-900 mb-1.5 line-clamp-2 leading-snug group-hover:text-brand-700 transition-colors text-sm">
                    {template.name}
                  </h4>
                  
                  <div className="flex items-center justify-between gap-2 mt-auto pt-4 border-t border-ink-50 flex-wrap">
                    <div className="flex flex-wrap gap-1.5">
                      {template.isSystem && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100/50">
                          Padrão
                        </span>
                      )}
                      {!template.isSystem && !template.clinicId && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100/50">
                          🌐 Global
                        </span>
                      )}
                      {area && (
                        <span className={classNames("text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border", area.color)}>
                          {area.label}
                        </span>
                      )}
                    </div>

                    {!template.isSystem && (
                      <div className="relative z-10" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={template.clinicId || ''}
                          onChange={async (e) => {
                            const newClinicId = e.target.value || null;
                            try {
                              await updateItem('templates', template.id, { clinicId: newClinicId });
                              showToast(newClinicId ? 'Máscara vinculada à clínica!' : 'Máscara disponível em todas as clínicas!', 'success');
                            } catch {
                              showToast('Erro ao atualizar vínculo da clínica', 'error');
                            }
                          }}
                          className="px-2 py-1 bg-ink-50 border border-ink-200 text-[10px] font-black text-ink-500 rounded-lg outline-none focus:border-brand-500 cursor-pointer"
                        >
                          <option value="">🌐 Global</option>
                          {clinics.map((c) => (
                            <option key={c.id} value={c.id}>🏢 {c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Excluir Máscara"
        message={`Deseja excluir "${deleteTarget?.name}"? Esta ação é irreversível.`}
        confirmLabel="Excluir Definitivamente"
        variant="danger"
      />
    </div>
  );
}
