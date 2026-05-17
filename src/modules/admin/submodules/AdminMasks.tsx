import { useState } from 'react';
import { useApp } from '../../../store/app';
import { useCollection } from '../../../hooks/useFirestore';
import { ReportTemplate, EXAM_AREAS, ExamArea } from '../../../types';
import { genId, addItemWithId, deleteItem } from '../../../store/db';
import { Search, Plus, FileSignature, Trash2, Copy, LayoutGrid } from 'lucide-react';
import { AreaIcon } from '../../../components/AreaIcon';
import { classNames } from '../../../utils/format';

export function AdminMasks() {
  const { setView, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<string>('todas');

  // Máscaras padrão são aquelas sem clinicId
  const { data: allTemplates, loading } = useCollection<ReportTemplate>('templates');
  const templates = allTemplates.filter(t => !t.clinicId);

  const filtered = templates.filter(t => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (areaFilter !== 'todas' && t.area !== areaFilter) return false;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-ink-900">Máscaras Padrão do Sistema</h3>
          <p className="text-sm text-ink-500">Gerencie os modelos base disponíveis para todos os usuários.</p>
        </div>
        <button className="btn-primary" onClick={handleCreateNew}>
          <Plus size={18} />
          Nova Máscara Padrão
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
            {filtered.map((template) => (
              <div
                key={template.id}
                onClick={() => setView({ name: 'template-editor', templateId: template.id })}
                className="group bg-white p-5 rounded-3xl border border-ink-100 hover:border-brand-300 hover:shadow-premium transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-ink-50 text-ink-400">
                    <AreaIcon area={template.area} size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-ink-900 group-hover:text-brand-700 transition-colors">{template.name}</h4>
                    <p className="text-[10px] text-ink-400 font-black uppercase tracking-widest">{template.area}</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button className="p-2 text-ink-400 hover:text-brand-600">
                    <Copy size={16} />
                  </button>
                  <button 
                    className="p-2 text-ink-400 hover:text-red-600"
                    onClick={(e) => { e.stopPropagation(); deleteItem('templates', template.id); showToast('Máscara removida', 'success'); }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && !loading && (
              <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-ink-100 border-dashed">
                <FileSignature size={40} className="text-ink-200 mx-auto mb-3" />
                <p className="text-ink-400">Nenhuma máscara padrão cadastrada.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
