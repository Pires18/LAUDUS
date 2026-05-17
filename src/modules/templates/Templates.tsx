import { useApp } from '../../store/app';
import { useCollection } from '../../hooks/useFirestore';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ReportTemplate, EXAM_AREAS, Clinic, ExamArea } from '../../types';
import { addItemWithId, deleteItem, genId, countWhere } from '../../store/db';
import { useState, useMemo } from 'react';
import { 
  Plus, Search, FileSignature, Trash2, Copy,
  RotateCcw, LayoutGrid
} from 'lucide-react';

import { AreaIcon } from '../../components/AreaIcon';
import { CardSkeleton } from '../../components/SkeletonLoader';
import { classNames } from '../../utils/format';



export function Templates() {
  const { setView, showToast, selectedClinicId } = useApp();
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<string>('todas');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; examCount: number } | null>(null);


  const { data: templates, loading } = useCollection<ReportTemplate>('templates');
  const { data: clinics } = useCollection<Clinic>('clinics');

  const clinicMap = useMemo(() => new Map(clinics.map((c) => [c.id, c])), [clinics]);

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
      <div className="max-w-7xl mx-auto w-full animate-fade-in space-y-6">
      <PageHeader
        title="Máscaras de Laudo"
        subtitle="Gerencie modelos e padrões diagnósticos"
        actions={
          <button className="btn-primary group h-12 px-6 shadow-premium" onClick={handleCreateNew}>
            <Plus size={20} className="group-hover:rotate-90 transition-transform" /> 
            <span className="font-bold uppercase tracking-widest text-xs">Nova Máscara</span>
          </button>
        }
      />

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Sidebar Áreas (Desktop) */}
        <aside className="hidden lg:flex flex-col gap-1 w-72 shrink-0 bg-white p-3 rounded-[2.5rem] border border-ink-100 shadow-sm sticky top-24">
          <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest px-5 py-4">Áreas do Sistema</p>
          <button
            onClick={() => setAreaFilter('todas')}
            className={classNames(
              "w-full px-5 py-4 rounded-2xl text-sm font-black transition-all flex items-center gap-4 uppercase tracking-widest",
              areaFilter === 'todas' 
                ? "bg-ink-900 text-white shadow-lg" 
                : "text-ink-600 hover:bg-ink-50"
            )}
          >
            <LayoutGrid size={18} />
            Todas
          </button>
          {EXAM_AREAS.map((area) => {
            const isActive = areaFilter === area.id;
            return (
              <button
                key={area.id}
                onClick={() => setAreaFilter(area.id)}
                className={classNames(
                  "w-full px-5 py-4 rounded-2xl text-sm font-black transition-all flex items-center gap-4 uppercase tracking-widest group",
                  isActive 
                    ? "bg-brand-50 text-brand-700 border border-brand-100 shadow-sm" 
                    : "text-ink-600 hover:bg-ink-50"
                )}
              >
                <div className={classNames(
                  "p-2 rounded-xl transition-all shadow-inner", 
                  isActive ? area.color : "bg-ink-50 text-ink-400 group-hover:bg-ink-100"
                )}>
                  <AreaIcon area={area.id} size={18} />
                </div>
                <span className="truncate">{area.label}</span>
              </button>
            );
          })}


        </aside>

        <div className="flex-1 w-full space-y-6">
          {/* Search and Mobile Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center bg-white p-4 rounded-3xl border border-ink-100 shadow-sm">
            <div className="relative flex-1 w-full flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar máscara por nome..."
                  className="w-full h-14 pl-12 pr-4 bg-ink-50 border border-ink-100 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none transition-all font-medium text-sm"
                />
              </div>
              {(search || areaFilter !== 'todas') && (
                <button 
                  onClick={() => { setSearch(''); setAreaFilter('todas'); }}
                  className="p-3 text-ink-400 hover:text-brand-600 hover:bg-brand-50 rounded-2xl transition-all border border-ink-100 h-14 w-14 flex items-center justify-center shrink-0"
                  title="Limpar Filtros"
                >
                  <RotateCcw size={20} />
                </button>
              )}
            </div>
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {loading ? (
              [1, 2, 3, 4, 5, 6].map((i) => <CardSkeleton key={i} />)
            ) : sorted.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-ink-100">
                <div className="w-16 h-16 rounded-3xl bg-ink-50 flex items-center justify-center mx-auto mb-4">
                  <FileSignature size={32} className="text-ink-200" />
                </div>
                <p className="text-ink-400 font-medium">Nenhuma máscara encontrada.</p>
                <button onClick={handleCreateNew} className="text-brand-600 font-black text-xs uppercase tracking-widest mt-4 hover:underline">
                  + Criar Modelo Base
                </button>
              </div>
            ) : (
              sorted.map((template) => {
                const area = EXAM_AREAS.find(a => a.id === template.area);
                const clinic = template.clinicId ? clinicMap.get(template.clinicId) : null;

                return (
                  <div
                    key={template.id}
                    onClick={() => setView({ name: 'template-editor', templateId: template.id })}
                    className="group bg-white p-6 rounded-3xl border border-ink-100 hover:border-brand-300 hover:shadow-premium transition-all cursor-pointer flex flex-col relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-brand-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="flex justify-between items-start mb-4">
                    <div className={classNames("p-3 rounded-2xl shadow-inner", area?.color || "bg-ink-100 text-ink-400")}>
                      <AreaIcon area={template.area} size={24} />
                    </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={(e) => handleDuplicate(template, e)}
                          className="p-2 rounded-xl text-ink-400 hover:text-brand-600 hover:bg-brand-50"
                          title="Duplicar"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          onClick={(e) => handleRequestDelete(template.id, template.name, e)}
                          className="p-2 rounded-xl text-ink-400 hover:text-red-600 hover:bg-red-50"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <h4 className="font-black text-ink-900 mb-1 line-clamp-2 leading-snug group-hover:text-brand-700 transition-colors">
                      {template.name}
                    </h4>
                    
                    <div className="flex flex-wrap gap-2 mt-auto pt-4">
                       {area && <span className={classNames("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border", area.color)}>
                         {area.label}
                       </span>}
                       {clinic && <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-ink-50 text-ink-500 border border-ink-100">
                         {clinic.name}
                       </span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
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
    </div>
  );
}
