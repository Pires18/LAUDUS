import { useState, FormEvent } from 'react';
import { ClinicalRecord, ClinicalRecordType, LabResult, VitalSigns } from '../../../types';
import { Modal } from '../../../components/Modal';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { computeBMI, classifyBMI, RECORD_TYPE_META } from '../utils/clinicalRecords';

interface Props {
  open: boolean;
  type: ClinicalRecordType;
  /** Registro em edição; ausente = criação */
  initial?: ClinicalRecord | null;
  onClose: () => void;
  onSave: (data: {
    type: ClinicalRecordType;
    title?: string;
    text?: string;
    vitals?: VitalSigns;
    labResults?: LabResult[];
    recordDate: number;
  }) => Promise<void>;
}

function toDateInputValue(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const EMPTY_LAB_ROW: LabResult = { name: '', value: '', unit: '', reference: '' };

export function ClinicalRecordModal({ open, type, initial, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [text, setText] = useState(initial?.text ?? '');
  const [recordDate, setRecordDate] = useState(
    toDateInputValue(initial?.recordDate ?? Date.now())
  );
  const [vitals, setVitals] = useState<VitalSigns>(initial?.vitals ?? {});
  const [labResults, setLabResults] = useState<LabResult[]>(
    initial?.labResults?.length ? initial.labResults : [{ ...EMPTY_LAB_ROW }]
  );

  const uv = (k: keyof VitalSigns, raw: string) => {
    const v = raw === '' ? undefined : Number(raw.replace(',', '.'));
    setVitals(prev => ({ ...prev, [k]: v !== undefined && isNaN(v) ? undefined : v }));
  };

  const updateLabRow = (idx: number, field: keyof LabResult, value: string) => {
    setLabResults(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const bmi = computeBMI(vitals.weightKg, vitals.heightCm);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cleanLabs = labResults
      .map(r => ({
        name: r.name.trim(),
        value: r.value.trim(),
        unit: r.unit?.trim() || undefined,
        reference: r.reference?.trim() || undefined,
      }))
      .filter(r => r.name && r.value);

    if (type === 'nota' && !text.trim()) return;
    if (type === 'laboratorio' && cleanLabs.length === 0) return;

    const [y, m, d] = recordDate.split('-').map(Number);
    setSaving(true);
    try {
      await onSave({
        type,
        title: title.trim() || undefined,
        text: text.trim() || undefined,
        vitals: type === 'exame-fisico' ? vitals : undefined,
        labResults: type === 'laboratorio' ? cleanLabs : undefined,
        recordDate: new Date(y, m - 1, d, 12, 0, 0).getTime(),
      });
    } finally {
      setSaving(false);
    }
  }

  const meta = RECORD_TYPE_META[type];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${initial ? 'Editar' : 'Nova entrada'} — ${meta.label}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="label">Título (opcional)</label>
            <input
              className="input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={
                type === 'nota' ? 'Ex: Retorno pós-operatório' :
                type === 'exame-fisico' ? 'Ex: Consulta de rotina' :
                'Ex: Hemograma + perfil tireoidiano'
              }
            />
          </div>
          <div>
            <label className="label">Data do registro</label>
            <input
              type="date"
              className="input"
              value={recordDate}
              onChange={e => setRecordDate(e.target.value)}
              required
            />
          </div>
        </div>

        {type === 'exame-fisico' && (
          <section>
            <h3 className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-3">Sinais Vitais & Antropometria</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="label">PA sist. (mmHg)</label>
                <input type="number" className="input" min={0} value={vitals.paSys ?? ''} onChange={e => uv('paSys', e.target.value)} placeholder="120" />
              </div>
              <div>
                <label className="label">PA diast. (mmHg)</label>
                <input type="number" className="input" min={0} value={vitals.paDia ?? ''} onChange={e => uv('paDia', e.target.value)} placeholder="80" />
              </div>
              <div>
                <label className="label">FC (bpm)</label>
                <input type="number" className="input" min={0} value={vitals.fc ?? ''} onChange={e => uv('fc', e.target.value)} placeholder="72" />
              </div>
              <div>
                <label className="label">FR (irpm)</label>
                <input type="number" className="input" min={0} value={vitals.fr ?? ''} onChange={e => uv('fr', e.target.value)} placeholder="16" />
              </div>
              <div>
                <label className="label">Temp (°C)</label>
                <input type="number" step="0.1" className="input" value={vitals.temp ?? ''} onChange={e => uv('temp', e.target.value)} placeholder="36.5" />
              </div>
              <div>
                <label className="label">SpO₂ (%)</label>
                <input type="number" className="input" min={0} max={100} value={vitals.spo2 ?? ''} onChange={e => uv('spo2', e.target.value)} placeholder="98" />
              </div>
              <div>
                <label className="label">Peso (kg)</label>
                <input type="number" step="0.1" className="input" min={0} value={vitals.weightKg ?? ''} onChange={e => uv('weightKg', e.target.value)} placeholder="70.0" />
              </div>
              <div>
                <label className="label">Altura (cm)</label>
                <input type="number" className="input" min={0} value={vitals.heightCm ?? ''} onChange={e => uv('heightCm', e.target.value)} placeholder="165" />
              </div>
            </div>
            {bmi != null && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-50 border border-brand-100 text-xs font-black text-brand-700">
                IMC: {bmi.toFixed(1)} kg/m² — {classifyBMI(bmi)}
              </div>
            )}
          </section>
        )}

        {type === 'laboratorio' && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Resultados</h3>
              <button
                type="button"
                onClick={() => setLabResults(prev => [...prev, { ...EMPTY_LAB_ROW }])}
                className="px-2.5 py-1.5 rounded-lg bg-ink-900 hover:bg-ink-800 text-white font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all"
              >
                <Plus size={11} />
                Adicionar Exame
              </button>
            </div>
            <div className="space-y-2">
              {labResults.map((row, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_70px_1fr_32px] gap-2 items-end">
                  <div>
                    {idx === 0 && <label className="label">Exame</label>}
                    <input className="input" value={row.name} onChange={e => updateLabRow(idx, 'name', e.target.value)} placeholder="Hemoglobina" />
                  </div>
                  <div>
                    {idx === 0 && <label className="label">Valor</label>}
                    <input className="input" value={row.value} onChange={e => updateLabRow(idx, 'value', e.target.value)} placeholder="12,5" />
                  </div>
                  <div>
                    {idx === 0 && <label className="label">Unid.</label>}
                    <input className="input" value={row.unit ?? ''} onChange={e => updateLabRow(idx, 'unit', e.target.value)} placeholder="g/dL" />
                  </div>
                  <div>
                    {idx === 0 && <label className="label">Referência</label>}
                    <input className="input" value={row.reference ?? ''} onChange={e => updateLabRow(idx, 'reference', e.target.value)} placeholder="12,0–15,5" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setLabResults(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)}
                    className="h-10 w-8 flex items-center justify-center text-ink-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    title="Remover linha"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <label className="label">
            {type === 'nota' ? 'Nota clínica *' :
             type === 'exame-fisico' ? 'Achados do exame físico' :
             'Observações'}
          </label>
          <textarea
            className="input min-h-[110px] resize-none"
            rows={5}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={
              type === 'nota' ? 'Evolução, conduta, impressão clínica...' :
              type === 'exame-fisico' ? 'Inspeção, palpação, ausculta, achados relevantes...' :
              'Interpretação, laboratório de origem, jejum...'
            }
          />
        </section>

        <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-1.5">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {initial ? 'Salvar Alterações' : 'Adicionar ao Prontuário'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
