import { useState, FormEvent } from 'react';
import { Patient } from '../../types';

interface Props {
  initial?: Partial<Patient>;
  onSubmit: (data: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export function PatientForm({ initial, onSubmit, onCancel }: Props) {
  const [data, setData] = useState({
    name: initial?.name ?? '',
    birthDate: initial?.birthDate ?? '',
    cpf: initial?.cpf ?? '',
    rg: initial?.rg ?? '',
    gender: initial?.gender ?? 'F' as 'M' | 'F' | 'O',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    address: {
      street: initial?.address?.street ?? '',
      number: initial?.address?.number ?? '',
      complement: initial?.address?.complement ?? '',
      neighborhood: initial?.address?.neighborhood ?? '',
      city: initial?.address?.city ?? '',
      state: initial?.address?.state ?? '',
      zipCode: initial?.address?.zipCode ?? '',
    },
    insurance: initial?.insurance ?? '',
    insuranceNumber: initial?.insuranceNumber ?? '',
    history: initial?.history ?? '',
    notes: initial?.notes ?? '',
  });

  const [submitted, setSubmitted] = useState(false);
  const nameInvalid = submitted && !data.name.trim();

  const u = (k: keyof typeof data, v: any) => setData(d => ({ ...d, [k]: v }));
  const ua = (k: keyof typeof data.address, v: any) =>
    setData(d => ({ ...d, address: { ...d.address, [k]: v } }));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!data.name.trim()) return;
    onSubmit(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section>
        <h3 className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-4">Identificação</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-1 md:col-span-2">
            <label className="label">Nome completo *</label>
            <input
              className={`input ${nameInvalid ? 'border-rose-400 focus:border-rose-500' : ''}`}
              required
              value={data.name}
              onChange={e => u('name', e.target.value)}
              aria-invalid={nameInvalid}
            />
            {nameInvalid && (
              <p className="text-[11px] font-bold text-rose-600 mt-1">Informe o nome completo do paciente.</p>
            )}
          </div>
          <div>
            <label className="label">Data de nascimento</label>
            <input type="date" className="input" value={data.birthDate} onChange={e => u('birthDate', e.target.value)} />
          </div>
          <div>
            <label className="label">Sexo</label>
            <select className="input" value={data.gender} onChange={e => u('gender', e.target.value)}>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
              <option value="O">Outro</option>
            </select>
          </div>
          <div>
            <label className="label">CPF</label>
            <input className="input" value={data.cpf} onChange={e => u('cpf', e.target.value)} />
          </div>
          <div>
            <label className="label">RG</label>
            <input className="input" value={data.rg} onChange={e => u('rg', e.target.value)} />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-4">Contato</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Telefone</label>
            <input className="input" value={data.phone} onChange={e => u('phone', e.target.value)} />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input type="email" className="input" value={data.email} onChange={e => u('email', e.target.value)} />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-4">Endereço</h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="col-span-1 md:col-span-4">
            <label className="label">Logradouro</label>
            <input className="input" value={data.address.street} onChange={e => ua('street', e.target.value)} />
          </div>
          <div className="col-span-1 md:col-span-1">
            <label className="label">Número</label>
            <input className="input" value={data.address.number} onChange={e => ua('number', e.target.value)} />
          </div>
          <div className="col-span-1 md:col-span-1">
            <label className="label">CEP</label>
            <input className="input" value={data.address.zipCode} onChange={e => ua('zipCode', e.target.value)} />
          </div>
          <div className="col-span-1 md:col-span-2">
            <label className="label">Complemento</label>
            <input className="input" value={data.address.complement} onChange={e => ua('complement', e.target.value)} />
          </div>
          <div className="col-span-1 md:col-span-2">
            <label className="label">Bairro</label>
            <input className="input" value={data.address.neighborhood} onChange={e => ua('neighborhood', e.target.value)} />
          </div>
          <div className="col-span-1 md:col-span-1">
            <label className="label">Cidade</label>
            <input className="input" value={data.address.city} onChange={e => ua('city', e.target.value)} />
          </div>
          <div className="col-span-1 md:col-span-1">
            <label className="label">UF</label>
            <input className="input" maxLength={2} value={data.address.state} onChange={e => ua('state', e.target.value.toUpperCase())} />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-4">Convênio</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Convênio</label>
            <input className="input" value={data.insurance} onChange={e => u('insurance', e.target.value)} />
          </div>
          <div>
            <label className="label">Nº carteirinha</label>
            <input className="input" value={data.insuranceNumber} onChange={e => u('insuranceNumber', e.target.value)} />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-4">Histórico clínico</h3>
        <textarea
          className="input min-h-[80px] resize-none"
          rows={3}
          placeholder="Antecedentes relevantes, comorbidades, cirurgias prévias..."
          value={data.history}
          onChange={e => u('history', e.target.value)}
        />
      </section>

      <section>
        <h3 className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-4">Observações</h3>
        <textarea
          className="input min-h-[60px] resize-none"
          rows={2}
          value={data.notes}
          onChange={e => u('notes', e.target.value)}
        />
      </section>

      <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary">Salvar Paciente</button>
      </div>
    </form>
  );
}
