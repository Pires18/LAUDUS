import { useState } from 'react';
import { useApp } from '../../store/app';
import { useCollection } from '../../hooks/useFirestore';
import { PageHeader } from '../../components/PageHeader';
import { Clinic } from '../../types';
import { Plus, Search, Building2, MapPin, Phone, ToggleLeft, ToggleRight } from 'lucide-react';
import { classNames } from '../../utils/format';

export function Clinics() {
  const { setView, showToast, selectedClinicId, setSelectedClinic } = useApp();
  const [search, setSearch] = useState('');

  const { data: clinics, loading } = useCollection<Clinic>('clinics');

  const filtered = clinics.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Clínicas"
        subtitle={`${clinics.length} clínica(s) cadastrada(s)`}
        actions={
          <button className="btn-primary" onClick={() => setView({ name: 'clinic-form' })}>
            <Plus size={16} /> Nova Clínica
          </button>
        }
      />

      {/* Search */}
      <div className="card mb-4 p-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar clínica..."
            className="input pl-9"
          />
        </div>
      </div>

      {/* Clinics grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-5 bg-ink-100 rounded w-2/3 mb-3" />
              <div className="h-3 bg-ink-100 rounded w-1/2 mb-2" />
              <div className="h-3 bg-ink-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-ink-50 flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} className="text-ink-300" />
          </div>
          <p className="text-sm text-ink-600 font-medium mb-1">
            {clinics.length === 0 ? 'Nenhuma clínica cadastrada' : 'Nenhum resultado'}
          </p>
          <p className="text-xs text-ink-400 mb-4">
            {clinics.length === 0
              ? 'Cadastre sua primeira clínica para começar a organizar seus laudos.'
              : 'Tente ajustar o termo de busca.'}
          </p>
          {clinics.length === 0 && (
            <button className="btn-primary" onClick={() => setView({ name: 'clinic-form' })}>
              <Plus size={15} /> Cadastrar Primeira Clínica
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((clinic) => {
            const isSelected = selectedClinicId === clinic.id;
            return (
              <div
                key={clinic.id}
                onClick={() => setView({ name: 'clinic-detail', clinicId: clinic.id })}
                className={classNames(
                  'card p-5 cursor-pointer transition-all duration-300 hover:shadow-medium group relative',
                  isSelected && 'ring-2 ring-brand-500 ring-offset-2'
                )}
              >
                {/* Active indicator */}
                <div className="absolute top-4 right-4">
                  {clinic.active ? (
                    <span className="chip bg-emerald-50 text-emerald-700">
                      <ToggleRight size={14} /> Ativa
                    </span>
                  ) : (
                    <span className="chip bg-ink-100 text-ink-500">
                      <ToggleLeft size={14} /> Inativa
                    </span>
                  )}
                </div>

                {/* Logo + Name */}
                <div className="flex items-start gap-3 mb-3">
                  {clinic.logoUrl ? (
                    <img
                      src={clinic.logoUrl}
                      alt={clinic.name}
                      className="w-12 h-12 rounded-lg object-cover border border-ink-100 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center shrink-0">
                      <Building2 size={20} className="text-brand-600" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-semibold text-ink-900 truncate">{clinic.name}</h3>
                    {clinic.cnpj && (
                      <p className="text-xs text-ink-500 font-mono">{clinic.cnpj}</p>
                    )}
                  </div>
                </div>

                {/* Address */}
                {clinic.address?.city && (
                  <div className="flex items-center gap-1.5 text-xs text-ink-500 mb-1">
                    <MapPin size={12} />
                    <span>
                      {[clinic.address.city, clinic.address.state].filter(Boolean).join('/')}
                    </span>
                  </div>
                )}

                {/* Phone */}
                {clinic.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-ink-500">
                    <Phone size={12} />
                    <span>{clinic.phone}</span>
                  </div>
                )}

                {/* Quick select button */}
                <div className="mt-3 pt-3 border-t border-ink-50 flex items-center justify-between">
                  <span className="text-[11px] text-ink-400">
                    {clinic.googleDocsTemplateId ? '📄 Template vinculado' : 'Sem template'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedClinic(isSelected ? null : clinic.id);
                      showToast(
                        isSelected ? 'Filtro de clínica removido' : `Filtrando por: ${clinic.name}`,
                        'info'
                      );
                    }}
                    className={classNames(
                      'text-[11px] px-2.5 py-1 rounded-md font-medium transition-all',
                      isSelected
                        ? 'bg-brand-600 text-white'
                        : 'bg-ink-50 text-ink-600 hover:bg-ink-100'
                    )}
                  >
                    {isSelected ? '✓ Selecionada' : 'Selecionar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
