import { useState, useMemo } from 'react';
import { useApp } from '../../store/app';
import { useCollection } from '../../hooks/useFirestore';
import { PageHeader } from '../../components/PageHeader';
import { Clinic } from '../../types';
import { 
  Plus, Search, Building2, MapPin, Phone, 
  ToggleLeft, ToggleRight, FileText, LayoutList, 
  ChevronRight, CheckCircle2, RotateCcw, X
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
      <div className="max-w-7xl mx-auto w-full animate-fade-in space-y-5">
        
        {/* ─── COMPACT HEADER ─── */}
        <div className="bg-white border border-ink-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shrink-0">
                <Building2 size={18} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-black text-ink-900 tracking-tight leading-none">Unidades & Clínicas</h1>
                <p className="text-[11px] text-ink-500 font-medium mt-0.5">Gerencie as unidades de atendimento e configurações de exportação.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setView({ name: 'clinic-form' })}
                className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Plus size={11} />
                Nova Unidade
              </button>
            </div>
          </div>
        </div>

        {/* ─── PILL TAB BAR ─── */}
        <div className="flex items-center gap-1.5 bg-ink-100 p-1 rounded-2xl border border-ink-200/50 overflow-x-auto">
          <button
            onClick={() => setFilter('todas')}
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all duration-200 whitespace-nowrap flex-shrink-0',
              filter === 'todas'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-ink-500 hover:text-ink-800 hover:bg-white/70'
            )}
          >
            <LayoutList size={13} />
            Todas ({stats.total})
          </button>
          <button
            onClick={() => setFilter('ativas')}
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all duration-200 whitespace-nowrap flex-shrink-0',
              filter === 'ativas'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-ink-500 hover:text-ink-800 hover:bg-white/70'
            )}
          >
            <ToggleRight size={13} />
            Ativas ({stats.active})
          </button>
          <button
            onClick={() => setFilter('inativas')}
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all duration-200 whitespace-nowrap flex-shrink-0',
              filter === 'inativas'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-ink-500 hover:text-ink-800 hover:bg-white/70'
            )}
          >
            <ToggleLeft size={13} />
            Inativas ({stats.inactive})
          </button>
        </div>

        {/* ─── SEARCH BAR ─── */}
        <div className="bg-white border border-ink-200 rounded-2xl shadow-sm p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou CNPJ..."
              className="w-full h-9 pl-9 pr-3 bg-ink-50 border border-ink-200 focus:border-brand-400 rounded-xl focus:ring-2 focus:ring-brand-400/10 outline-none transition-all text-sm text-ink-800 placeholder-ink-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600">
                <X size={13} />
              </button>
            )}
          </div>
          {(search || filter !== 'todas') && (
            <button
              onClick={() => { setSearch(''); setFilter('todas'); }}
              className="h-9 px-3 rounded-xl border border-ink-200 text-ink-500 hover:bg-ink-50 font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
            >
              <RotateCcw size={12} />
              Limpar Filtros
            </button>
          )}
        </div>

        {/* ─── CLINICS LIST ─── */}
        <div className="flex flex-col gap-3 pb-8">
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-white border border-ink-150 rounded-2xl animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 bg-white border border-ink-200 rounded-2xl shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-ink-50 flex items-center justify-center mx-auto mb-3 border border-ink-100">
                <Building2 size={20} className="text-ink-300" />
              </div>
              <p className="text-sm font-bold text-ink-400">Nenhuma clínica encontrada.</p>
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
                    "group flex items-center gap-4 bg-white border rounded-2xl p-4 transition-all duration-300 cursor-pointer shadow-sm",
                    isSelected ? "border-brand-500 ring-1 ring-brand-500/20" : "border-ink-200 hover:border-brand-400 hover:shadow-md hover:bg-brand-50/10"
                  )}
                >
                  {/* Logo/Icon */}
                  <div className="relative shrink-0">
                    {clinic.logoUrl ? (
                      <img
                        src={clinic.logoUrl}
                        alt={clinic.name}
                        className="w-14 h-14 rounded-xl object-cover border border-ink-200 shadow-sm"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 flex items-center justify-center border border-brand-200">
                        <Building2 size={20} />
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute -top-1.5 -right-1.5 bg-brand-600 text-white p-1 rounded-full border-2 border-white shadow-sm">
                        <CheckCircle2 size={9} />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 py-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-black text-ink-900 text-base leading-tight truncate group-hover:text-brand-600 transition-colors">
                        {clinic.name}
                      </h3>
                      {!clinic.active && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-ink-100 text-ink-500 uppercase tracking-widest border border-ink-200">Inativa</span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {clinic.cnpj && (
                        <div className="flex items-center gap-1 text-[11px] text-ink-500 font-medium font-mono">
                          <FileText size={11} className="text-ink-400" />
                          {formatCNPJ(clinic.cnpj)}
                        </div>
                      )}
                      {clinic.address?.city && (
                        <div className="flex items-center gap-1 text-[11px] text-ink-500 font-medium">
                          <MapPin size={11} className="text-brand-500" />
                          {clinic.address.city}/{clinic.address.state}
                        </div>
                      )}
                      {clinic.phone && (
                        <div className="flex items-center gap-1 text-[11px] text-ink-500 font-medium">
                          <Phone size={11} className="text-indigo-500" />
                          {formatPhone(clinic.phone)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="hidden sm:flex flex-col items-end gap-2 pr-2" onClick={(e) => e.stopPropagation()}>
                    {clinic.googleDocsTemplateId ? (
                      <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100/50 flex items-center gap-1 uppercase tracking-widest">
                        Template OK
                      </span>
                    ) : (
                      <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100/50 uppercase tracking-widest">
                        Sem Template
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setSelectedClinic(isSelected ? null : clinic.id);
                      }}
                      className={classNames(
                        "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg transition-all border shadow-sm",
                        isSelected 
                          ? "bg-brand-600 text-white border-brand-600" 
                          : "bg-white text-ink-600 border-ink-200 hover:bg-ink-50"
                      )}
                    >
                      {isSelected ? 'Selecionada' : 'Selecionar'}
                    </button>
                  </div>

                  <div className="text-ink-300 group-hover:text-brand-500 transition-colors pr-2">
                    <ChevronRight size={16} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
