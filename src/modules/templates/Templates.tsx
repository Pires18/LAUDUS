import { useApp } from '../../store/app';
import { useCollection } from '../../hooks/useFirestore';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ReportTemplate, EXAM_AREAS, Clinic } from '../../types';
import { addItemWithId, deleteItem, genId, countWhere } from '../../store/db';
import { useState, useMemo } from 'react';
import { Plus, Search, FileText, Trash2, Copy, Edit2, Building2 } from 'lucide-react';

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
    if (selectedClinicId && t.clinicId !== selectedClinicId && t.clinicId) return false; // Mostra globais (sem clinicId) ou da clínica selecionada
    return true;
  });

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  async function handleCreateNew() {
    const id = genId();
    await addItemWithId('templates', id, {
      name: 'Nova Máscara',
      area: 'medicina-interna',
      title: 'TÍTULO DO LAUDO',
      technique: 'Exame realizado com equipamento...',
      analysisTemplate: 'Fígado: dimensões normais, contornos regulares, ecotextura homogênea.\n\nVesícula biliar: ausência de cálculos.',
      conclusionTemplate: 'Exame ecográfico sem alterações significativas.',
      recommendationsTemplate: '',
      formFields: [],
      clinicId: selectedClinicId || undefined, // Atribui à clínica selecionada por padrão
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
    <div>
      <PageHeader
        title="Máscaras"
        subtitle={`${templates.length} modelo(s) cadastrado(s)`}
        actions={
          <button className="btn-primary" onClick={handleCreateNew}>
            <Plus size={16} /> Nova Máscara
          </button>
        }
      />

      {selectedClinicId && (
        <div className="mb-4 bg-brand-50 border border-brand-200 rounded-lg p-3 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2 text-brand-700">
            <Building2 size={16} />
            Mostrando máscaras da clínica <strong>{clinicMap.get(selectedClinicId)?.name}</strong> e máscaras globais.
          </div>
        </div>
      )}

      <div className="card mb-4 p-3 flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar máscara..."
            className="input pl-9"
          />
        </div>
        <select
          className="input w-48 text-sm"
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
        >
          <option value="todas">Todas as Áreas</option>
          {EXAM_AREAS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          [1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card p-5 animate-pulse h-[140px]">
              <div className="h-5 bg-ink-100 rounded w-3/4 mb-3" />
              <div className="h-4 bg-ink-100 rounded w-1/4 mb-4" />
              <div className="h-8 bg-ink-100 rounded w-full mt-auto" />
            </div>
          ))
        ) : sorted.length === 0 ? (
          <div className="col-span-full card p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-ink-50 flex items-center justify-center mx-auto mb-4">
              <FileText size={28} className="text-ink-300" />
            </div>
            <p className="text-sm text-ink-600 font-medium mb-1">
              {templates.length === 0 ? 'Nenhuma máscara cadastrada' : 'Nenhum resultado'}
            </p>
            <p className="text-xs text-ink-400 mb-4">
              Crie suas máscaras base para gerar laudos rapidamente.
            </p>
            {templates.length === 0 && (
              <button className="btn-primary" onClick={handleCreateNew}>
                <Plus size={15} /> Criar Primeira Máscara
              </button>
            )}
          </div>
        ) : (
          sorted.map((t) => {
            const area = EXAM_AREAS.find((a) => a.id === t.area);
            const clinic = t.clinicId ? clinicMap.get(t.clinicId) : null;
            return (
              <div
                key={t.id}
                className="card p-5 group hover:border-brand-300 hover:shadow-medium transition-all cursor-pointer flex flex-col"
                onClick={() => setView({ name: 'template-editor', templateId: t.id })}
              >
                <div className="flex items-start justify-between mb-3">
                  {area && (
                    <span className={`chip ${area.color} text-[10px] py-0.5 px-2`}>
                      {area.label}
                    </span>
                  )}
                  {clinic ? (
                    <span className="text-[10px] bg-ink-100 text-ink-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Building2 size={10} /> Clínica Específica
                    </span>
                  ) : (
                    <span className="text-[10px] bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full">
                      Global
                    </span>
                  )}
                </div>
                
                <h3 className="font-semibold text-ink-900 mb-1 leading-tight group-hover:text-brand-600 transition-colors">
                  {t.name}
                </h3>
                
                {t.description && (
                  <p className="text-xs text-ink-500 line-clamp-2 mt-1">{t.description}</p>
                )}

                <div className="mt-auto pt-4 flex items-center justify-between border-t border-ink-50">
                  <div className="text-[11px] text-ink-400 font-medium">
                    {t.formFields.length} campos de formulário
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => handleDuplicate(t, e)}
                      className="p-1.5 text-ink-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                      title="Duplicar"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={(e) => handleRequestDelete(t.id, t.name, e)}
                      className="p-1.5 text-ink-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Excluir máscara"
        message={
          deleteTarget?.examCount ? (
            <span>
              A máscara <strong>{deleteTarget.name}</strong> está vinculada a{' '}
              <strong>{deleteTarget.examCount} exame(s)</strong>. Exclua os exames
              primeiro para poder remover a máscara.
            </span>
          ) : (
            <span>
              Tem certeza que deseja excluir a máscara <strong>{deleteTarget?.name}</strong>?
            </span>
          )
        }
        confirmLabel={deleteTarget?.examCount ? 'Entendido' : 'Excluir'}
        variant={deleteTarget?.examCount ? 'warning' : 'danger'}
      />
    </div>
  );
}
