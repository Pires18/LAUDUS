import { useMemo, useState } from 'react';
import { ClinicalRecord, ClinicalRecordType } from '../../../types';
import { useCollection } from '../../../hooks/useFirestore';
import { addItem, updateItem, deleteItem } from '../../../store/db';
import { useApp } from '../../../store/app';
import { where } from 'firebase/firestore';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ClinicalRecordModal } from './ClinicalRecordModal';
import { RECORD_TYPE_META, vitalsToChips } from '../utils/clinicalRecords';
import { classNames, formatDate } from '../../../utils/format';
import {
  NotebookPen, Stethoscope, FlaskConical, Plus, Loader2, Edit, Trash2, HeartPulse
} from 'lucide-react';

interface Props {
  patientId: string;
}

const TYPE_ICONS: Record<ClinicalRecordType, typeof NotebookPen> = {
  'nota': NotebookPen,
  'exame-fisico': Stethoscope,
  'laboratorio': FlaskConical,
};

const TYPE_STYLES: Record<ClinicalRecordType, { badge: string; icon: string }> = {
  'nota': { badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: 'bg-indigo-50 border-indigo-150 text-indigo-600' },
  'exame-fisico': { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'bg-emerald-50 border-emerald-150 text-emerald-600' },
  'laboratorio': { badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'bg-amber-50 border-amber-150 text-amber-600' },
};

export function ClinicalRecordsSection({ patientId }: Props) {
  const { showToast, selectedClinicId } = useApp();
  const [typeFilter, setTypeFilter] = useState<ClinicalRecordType | 'todos'>('todos');
  const [modalType, setModalType] = useState<ClinicalRecordType | null>(null);
  const [editingRecord, setEditingRecord] = useState<ClinicalRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<ClinicalRecord | null>(null);

  const { data: records, loading } = useCollection<ClinicalRecord>('clinical_records', {
    constraints: [where('patientId', '==', patientId)],
  });

  const sorted = useMemo(() => {
    const filtered = typeFilter === 'todos' ? records : records.filter(r => r.type === typeFilter);
    return [...filtered].sort((a, b) => (b.recordDate || b.createdAt || 0) - (a.recordDate || a.createdAt || 0));
  }, [records, typeFilter]);

  const countsByType = useMemo(() => ({
    'nota': records.filter(r => r.type === 'nota').length,
    'exame-fisico': records.filter(r => r.type === 'exame-fisico').length,
    'laboratorio': records.filter(r => r.type === 'laboratorio').length,
  }), [records]);

  async function handleSave(data: Omit<ClinicalRecord, 'id' | 'patientId' | 'clinicId' | 'createdAt' | 'updatedAt'>) {
    try {
      if (editingRecord) {
        await updateItem('clinical_records', editingRecord.id, data as any);
        showToast('Registro atualizado', 'success');
      } else {
        await addItem('clinical_records', {
          ...data,
          patientId,
          clinicId: selectedClinicId || undefined,
        } as any);
        showToast('Registro adicionado ao prontuário', 'success');
      }
      setModalType(null);
      setEditingRecord(null);
    } catch {
      showToast('Erro ao salvar registro', 'error');
    }
  }

  async function handleConfirmDelete() {
    if (!deletingRecord) return;
    try {
      await deleteItem('clinical_records', deletingRecord.id);
      showToast('Registro excluído', 'success');
    } catch {
      showToast('Erro ao excluir registro', 'error');
    } finally {
      setDeletingRecord(null);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-ink-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-ink-100 bg-ink-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-150 text-rose-600 flex items-center justify-center">
            <HeartPulse size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest leading-none">Prontuário Clínico</h3>
            <p className="text-[9px] text-ink-400 font-bold uppercase tracking-widest mt-1">
              Notas, exames físicos e laboratório
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(RECORD_TYPE_META) as ClinicalRecordType[]).map(t => {
            const Icon = TYPE_ICONS[t];
            return (
              <button
                key={t}
                onClick={() => { setEditingRecord(null); setModalType(t); }}
                className="h-8 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider bg-ink-900 hover:bg-ink-800 text-white transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Plus size={10} />
                <Icon size={11} />
                {RECORD_TYPE_META[t].addLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-5 py-3 border-b border-ink-50 flex flex-wrap gap-1.5">
        {([
          { id: 'todos' as const, label: `Tudo (${records.length})` },
          { id: 'nota' as const, label: `Notas (${countsByType['nota']})` },
          { id: 'exame-fisico' as const, label: `Exame Físico (${countsByType['exame-fisico']})` },
          { id: 'laboratorio' as const, label: `Laboratório (${countsByType['laboratorio']})` },
        ]).map(f => (
          <button
            key={f.id}
            onClick={() => setTypeFilter(f.id)}
            className={classNames(
              "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border",
              typeFilter === f.id
                ? "bg-ink-900 border-ink-900 text-white shadow-sm"
                : "bg-ink-50 border-ink-200 text-ink-500 hover:bg-ink-100"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Records list */}
      {loading ? (
        <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-ink-300" /></div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-10">
          <NotebookPen size={22} className="mx-auto text-ink-300 mb-2" />
          <p className="text-sm text-ink-500">
            {records.length === 0
              ? 'Nenhum registro no prontuário. Adicione notas clínicas, exames físicos ou resultados laboratoriais.'
              : 'Nenhum registro deste tipo.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-ink-50">
          {sorted.map(record => {
            const Icon = TYPE_ICONS[record.type];
            const styles = TYPE_STYLES[record.type];
            const chips = record.type === 'exame-fisico' ? vitalsToChips(record.vitals) : [];
            return (
              <div key={record.id} className="p-4 group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3 min-w-0 flex-1">
                    <div className={classNames("w-10 h-10 rounded-xl border flex items-center justify-center shrink-0", styles.icon)}>
                      <Icon size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={classNames("px-1.5 py-0.5 rounded border text-[9px] uppercase font-bold tracking-wider", styles.badge)}>
                          {RECORD_TYPE_META[record.type].label}
                        </span>
                        <span className="text-xs font-black text-ink-700">{formatDate(record.recordDate)}</span>
                        {record.title && (
                          <span className="text-sm font-bold text-ink-900 truncate">{record.title}</span>
                        )}
                      </div>

                      {chips.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {chips.map(c => (
                            <span key={c.label} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-ink-50 border border-ink-100 text-[10px] font-bold text-ink-700">
                              <span className="text-ink-400 font-black uppercase">{c.label}</span>
                              {c.value}
                            </span>
                          ))}
                        </div>
                      )}

                      {record.type === 'laboratorio' && record.labResults && record.labResults.length > 0 && (
                        <div className="mt-2 overflow-x-auto">
                          <table className="text-xs border-collapse min-w-[320px]">
                            <thead>
                              <tr className="text-[9px] font-black text-ink-400 uppercase tracking-widest text-left">
                                <th className="py-1 pr-4">Exame</th>
                                <th className="py-1 pr-4">Resultado</th>
                                <th className="py-1 pr-4">Referência</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-ink-50">
                              {record.labResults.map((r, i) => (
                                <tr key={i}>
                                  <td className="py-1 pr-4 font-bold text-ink-800">{r.name}</td>
                                  <td className="py-1 pr-4 font-black text-ink-900">
                                    {r.value}{r.unit ? ` ${r.unit}` : ''}
                                  </td>
                                  <td className="py-1 pr-4 text-ink-500">{r.reference || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {record.text && (
                        <p className="mt-2 text-xs text-ink-700 leading-relaxed whitespace-pre-wrap">{record.text}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => { setEditingRecord(record); setModalType(record.type); }}
                      className="p-2 text-ink-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all"
                      title="Editar registro"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => setDeletingRecord(record)}
                      className="p-2 text-ink-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      title="Excluir registro"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalType && (
        <ClinicalRecordModal
          key={editingRecord?.id || `new-${modalType}`}
          open
          type={modalType}
          initial={editingRecord}
          onClose={() => { setModalType(null); setEditingRecord(null); }}
          onSave={handleSave}
        />
      )}

      <ConfirmDialog
        open={deletingRecord !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingRecord(null)}
        title="Excluir registro do prontuário"
        message={
          <span>
            Tem certeza que deseja excluir este registro
            ({deletingRecord ? RECORD_TYPE_META[deletingRecord.type].label : ''} de{' '}
            {deletingRecord ? formatDate(deletingRecord.recordDate) : ''})?
            Esta ação não pode ser desfeita.
          </span>
        }
        confirmLabel="Excluir"
        variant="danger"
      />
    </div>
  );
}
