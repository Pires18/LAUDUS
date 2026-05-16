import { useState, useMemo } from 'react';
import { useApp } from '../../store/app';
import { useCollection } from '../../hooks/useFirestore';
import { PageHeader } from '../../components/PageHeader';
import { Clinic } from '../../types';
import { 
  Plus, Search, Building2, MapPin, Phone, 
  ToggleLeft, ToggleRight, FileText, LayoutList, 
  ChevronRight, CheckCircle2, Globe, Mail, 
  Clock, RotateCcw
} from 'lucide-react';
import { classNames, formatCNPJ, formatPhone } from '../../utils/format';

export function Clinics() {
  const { setView, selectedClinicId, setSelectedClinic } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'todas' | 'ativas' | 'inativas'>('todas');

  const { data: clinics, loading } = useCollection<Clinic>('clinics');

  const filtered = useMemo(() => {
    return clinics.filter((c) => {
      const matchesSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || 
                            (c.cnpj && c.cnpj.includes(search));
      const matchesFilter = filter === 'todas' || 
                            (filter === 'ativas' && c.active) || 
                            (filter === 'inativas' && !c.active);
      return matchesSearch && matchesFilter;
    });
  }, [clinics, search, filter]);

  const stats = useMemo(() => ({
    total: clinics.length,
    active: clinics.filter(c => c.active).length,
    inactive: clinics.filter(c => !c.active).length,
  }), [clinics]);

  return (
    <div className="module-container">
      <div className="max-w-6xl mx-auto w-full animate-fade-in space-y-6">
      <PageHeader
        title="Unidades & Clínicas"
        subtitle="Gerencie as unidades de atendimento e configurações de exportação."
        actions={
          <button className="btn-primary h-11 px-6 rounded-2xl shadow-brand" onClick={() => setView({ name: 'clinic-form' })}>
            <Plus size={18} /> <span className="font-bold text-xs uppercase tracking-widest">Nova Unidade</span>
          </button>
        }
      />

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Sidebar Navigation */}
        <aside className="hidden lg:flex flex-col gap-1 w-64 shrink-0 bg-white p-2 rounded-3xl border border-ink-100 shadow-sm sticky top-24">
          <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest px-4 py-3">Filtrar por Status</p>
          <button
            onClick={() => setFilter('todas')}
            className={classNames(
              "w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all flex items-center justify-between",
              filter === 'todas' ? "bg-brand-50 text-brand-700 border border-brand-100" : "text-ink-600 hover:bg-ink-50"
            )}
          >
            <div className="flex items-center gap-3">
              <LayoutList size={18} />
              Todas
            </div>
            <span className="text-[10px] bg-ink-100 text-ink-600 px-2 py-0.5 rounded-full">{stats.total}</span>
          </button>
          
          <button
            onClick={() => setFilter('ativas')}
            className={classNames(
              "w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all flex items-center justify-between",
              filter === 'ativas' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "text-ink-600 hover:bg-ink-50"
            )}
          >
            <div className="flex items-center gap-3">
              <ToggleRight size={18} />
              Ativas
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{stats.active}</span>
          </button>

          <button
            onClick={() => setFilter('inativas')}
            className={classNames(
              "w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all flex items-center justify-between",
              filter === 'inativas' ? "bg-ink-100 text-ink-900 border border-ink-200" : "text-ink-600 hover:bg-ink-50"
            )}
          >
            <div className="flex items-center gap-3">
              <ToggleLeft size={18} />
              Inativas
            </div>
            <span className="text-[10px] bg-ink-200 text-ink-700 px-2 py-0.5 rounded-full">{stats.inactive}</span>
          </button>
        </aside>

        <div className="flex-1 w-full space-y-6">
          {/* Search Box */}
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                type="text"
                placeholder="Buscar por nome ou CNPJ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-12 py-3 h-14 text-base shadow-sm border-ink-200 focus:border-brand-500 w-full"
              />
            </div>
            {(search || filter !== 'todas') && (
              <button 
                onClick={() => { setSearch(''); setFilter('todas'); }}
                className="p-3 text-ink-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all border border-ink-100 h-14 flex items-center gap-2 shrink-0 px-4"
              >
                <RotateCcw size={18} />
                <span className="text-xs font-bold uppercase tracking-widest">Limpar</span>
              </button>
            )}
          </div>

          {/* Clinics List */}
          <div className="flex flex-col gap-2 pb-12">
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-white border border-ink-100 rounded-2xl animate-pulse" />
              ))
            ) : filtered.length === 0 ? (
              <div className="text-center py-24 bg-white border border-ink-100 rounded-3xl">
                <Building2 size={40} className="mx-auto text-ink-200 mb-3" />
                <p className="text-ink-500 font-medium">Nenhuma clínica encontrada.</p>
                <button onClick={() => setView({ name: 'clinic-form' })} className="mt-4 text-brand-600 font-bold hover:underline text-sm">
                  Cadastrar nova unidade
                </button>
              </div>
            ) : (
              filtered.map((clinic) => {
                const isSelected = selectedClinicId === clinic.id;
                return (
                  <div
                    key={clinic.id}
                    onClick={() => setView({ name: 'clinic-detail', clinicId: clinic.id })}
                    className={classNames(
                      "group flex items-center gap-4 bg-white border rounded-2xl p-4 transition-all duration-200 cursor-pointer",
                      isSelected ? "border-brand-500 shadow-md ring-1 ring-brand-500/20" : "border-ink-100 hover:border-brand-400 hover:shadow-sm"
                    )}
                  >
                    {/* Logo/Icon */}
                    <div className="relative shrink-0">
                      {clinic.logoUrl ? (
                        <img
                          src={clinic.logoUrl}
                          alt={clinic.name}
                          className="w-16 h-16 rounded-xl object-cover border border-ink-100 shadow-sm"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 flex items-center justify-center border border-brand-200">
                          <Building2 size={24} />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute -top-1.5 -right-1.5 bg-brand-600 text-white p-1 rounded-full border-2 border-white shadow-sm">
                          <CheckCircle2 size={10} />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 py-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-black text-ink-900 text-lg leading-tight truncate group-hover:text-brand-600 transition-colors">
                          {clinic.name}
                        </h3>
                        {!clinic.active && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-ink-100 text-ink-500 uppercase tracking-tighter">Inativa</span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {clinic.cnpj && (
                          <div className="flex items-center gap-1 text-[11px] text-ink-500 font-medium">
                            <FileText size={12} className="text-ink-400" />
                            {formatCNPJ(clinic.cnpj)}
                          </div>
                        )}
                        {clinic.address?.city && (
                          <div className="flex items-center gap-1 text-[11px] text-ink-500 font-medium">
                            <MapPin size={12} className="text-brand-500" />
                            {clinic.address.city}/{clinic.address.state}
                          </div>
                        )}
                        {clinic.phone && (
                          <div className="flex items-center gap-1 text-[11px] text-ink-500 font-medium">
                            <Phone size={12} className="text-indigo-500" />
                            {formatPhone(clinic.phone)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions Area */}
                    <div className="hidden sm:flex flex-col items-end gap-2 pr-4">
                      {clinic.googleDocsTemplateId ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                          <CheckCircle2 size={10} /> Template OK
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                          Sem Template
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClinic(isSelected ? null : clinic.id);
                        }}
                        className={classNames(
                          "text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all border",
                          isSelected 
                            ? "bg-brand-600 text-white border-brand-600" 
                            : "bg-white text-ink-600 border-ink-200 hover:bg-ink-50"
                        )}
                      >
                        {isSelected ? 'Selecionada' : 'Selecionar'}
                      </button>
                    </div>

                    <div className="text-ink-300 group-hover:text-brand-500 transition-colors">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
