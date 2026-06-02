import { useState } from 'react';
import { useApp } from '../../../store/app';
import { useCollection } from '../../../hooks/useFirestore';
import { ReportTemplate, EXAM_AREAS, ExamArea, Clinic } from '../../../types';
import { genId, addItemWithId, deleteItem, updateItem } from '../../../store/db';
import { Search, Plus, FileSignature, Trash2, Copy, LayoutGrid } from 'lucide-react';
import { AreaIcon } from '../../../components/AreaIcon';
import { classNames } from '../../../utils/format';

export function AdminMasks() {
  const { setView, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<string>('todas');
  const [typeFilter, setTypeFilter] = useState<'all' | 'system' | 'clinics'>('all');

  const { data: allTemplates, loading } = useCollection<ReportTemplate>('templates');
  const { data: clinics } = useCollection<Clinic>('clinics');

  const filtered = allTemplates.filter(t => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (areaFilter !== 'todas' && t.area !== areaFilter) return false;
    if (typeFilter === 'system' && t.clinicId) return false;
    if (typeFilter === 'clinics' && !t.clinicId) return false;
    return true;
  });

  async function handleCreateNew() {
    const id = genId();
    await addItemWithId('templates', id, {
      name: 'Nova Máscara Padrão',
      area: areaFilter !== 'todas' ? areaFilter as ExamArea : 'medicina-interna',
      title: 'TÍTULO DO LAUDO',
      technique: 'Exame realizado...',
      analysisTemplate: '',
      conclusionTemplate: '',
      recommendationsTemplate: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    setView({ name: 'template-editor', templateId: id });
  }

  async function handleChangeClinic(templateId: string, clinicId: string) {
    try {
      await updateItem('templates', templateId, { clinicId: clinicId || null });
      showToast(clinicId ? 'Máscara vinculada à clínica com sucesso!' : 'Máscara alterada para Padrão do Sistema!', 'success');
    } catch {
      showToast('Erro ao atualizar vínculo da máscara', 'error');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-ink-900">Gerenciador de Máscaras Clínicas</h3>
          <p className="text-sm text-ink-500">Publique e adeque os modelos de laudos padrões e específicos para as clínicas.</p>
        </div>
        <button className="btn-primary shrink-0 self-start md:self-auto shadow-lg shadow-brand-500/20" onClick={handleCreateNew}>
          <Plus size={18} />
          Nova Máscara Padrão
        </button>
      </div>

      {/* Mask Type Filters */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit border border-slate-200/60 shadow-sm">
        <button
          onClick={() => setTypeFilter('all')}
          className={classNames(
            "px-4 py-2.5 text-xs font-black uppercase tracking-tight rounded-xl transition-all",
            typeFilter === 'all' ? "bg-white text-brand-600 shadow-sm border border-slate-200/10" : "text-slate-500 hover:text-slate-700"
          )}
        >
          🌐 Todas ({allTemplates.length})
        </button>
        <button
          onClick={() => setTypeFilter('system')}
          className={classNames(
            "px-4 py-2.5 text-xs font-black uppercase tracking-tight rounded-xl transition-all",
            typeFilter === 'system' ? "bg-white text-brand-600 shadow-sm border border-slate-200/10" : "text-slate-500 hover:text-slate-700"
          )}
        >
          ⭐ Padrão do Sistema ({allTemplates.filter(t => !t.clinicId).length})
        </button>
        <button
          onClick={() => setTypeFilter('clinics')}
          className={classNames(
            "px-4 py-2.5 text-xs font-black uppercase tracking-tight rounded-xl transition-all",
            typeFilter === 'clinics' ? "bg-white text-brand-600 shadow-sm border border-slate-200/10" : "text-slate-500 hover:text-slate-700"
          )}
        >
          🏢 Exclusivas de Clínicas ({allTemplates.filter(t => t.clinicId).length})
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <aside className="w-full lg:w-64 shrink-0 space-y-1">
          <button
            onClick={() => setAreaFilter('todas')}
            className={classNames(
              "w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-3",
              areaFilter === 'todas' ? "bg-ink-900 text-white shadow-md" : "text-ink-600 hover:bg-ink-50"
            )}
          >
            <LayoutGrid size={16} /> Todas
          </button>
          {EXAM_AREAS.map((area) => (
            <button
              key={area.id}
              onClick={() => setAreaFilter(area.id)}
              className={classNames(
                "w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-3",
                areaFilter === area.id ? "bg-brand-50 text-brand-700 border border-brand-100" : "text-ink-600 hover:bg-ink-50"
              )}
            >
              <AreaIcon area={area.id} size={16} />
              {area.label}
            </button>
          ))}
        </aside>

        <div className="flex-1 w-full space-y-6">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar máscara padrão..."
              className="w-full h-12 pl-12 pr-4 bg-white border border-ink-100 rounded-2xl focus:ring-2 focus:ring-brand-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((template) => {
              const clinicName = template.clinicId
                ? clinics.find(c => c.id === template.clinicId)?.name || 'Clínica Exclusiva'
                : null;

              return (
                <div
                  key={template.id}
                  onClick={() => setView({ name: 'template-editor', templateId: template.id })}
                  className="group bg-white p-6 rounded-[2rem] border border-ink-100 hover:border-brand-300 hover:shadow-premium transition-all cursor-pointer flex flex-col justify-between min-h-[140px] space-y-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-2xl bg-ink-50 text-ink-400">
                        <AreaIcon area={template.area} size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-ink-900 group-hover:text-brand-700 transition-colors leading-tight">{template.name}</h4>
                        <p className="text-[9px] text-ink-400 font-black uppercase tracking-widest mt-1">{template.area}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                      <button
                        title="Duplicar Máscara"
                        className="p-2 text-ink-400 hover:text-brand-600"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const id = genId();
                          const { id: _, ...rest } = template;
                          await addItemWithId('templates', id, {
                            ...rest,
                            name: `${template.name} (Cópia)`,
                            createdAt: Date.now(),
                            updatedAt: Date.now()
                          });
                          showToast('Máscara duplicada com sucesso!', 'success');
                        }}
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        title="Excluir Máscara"
                        className="p-2 text-ink-400 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Tem certeza de que deseja remover esta máscara definitivamente?')) {
                            deleteItem('templates', template.id);
                            showToast('Máscara removida com sucesso!', 'success');
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-50 flex items-center justify-between gap-3 flex-wrap">
                    {clinicName ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        {clinicName}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Padrão do Sistema
                      </span>
                    )}

                    <div className="relative z-10" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={template.clinicId || ''}
                        onChange={(e) => handleChangeClinic(template.id, e.target.value)}
                        className="px-2.5 py-1 bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-600 rounded-lg outline-none focus:border-brand-500"
                      >
                        <option value="">⭐ Padrão do Sistema</option>
                        {clinics.map((c) => (
                          <option key={c.id} value={c.id}>🏢 {c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && !loading && (
              <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-ink-100 border-dashed">
                <FileSignature size={40} className="text-ink-200 mx-auto mb-3" />
                <p className="text-ink-400">Nenhuma máscara cadastrada com os filtros aplicados.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
