import { useState } from 'react';
import { Building2, Check, Hospital, Users, X } from 'lucide-react';
import { Clinic } from '../types';
import { classNames } from '../utils/format';

interface Props {
  clinics: (Clinic & { shared?: boolean; role?: 'editor' | 'viewer' })[];
  onSelect: (clinicId: string | null, remember: boolean) => void;
}

export function ClinicSessionModal({ clinics, onSelect }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [remember, setRemember] = useState(false);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-ink-100">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center">
              <Hospital size={20} className="text-brand-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-ink-900 leading-none">Selecione a Clínica</h2>
              <p className="text-[11px] text-ink-500 mt-0.5">Em qual unidade você está trabalhando hoje?</p>
            </div>
          </div>
        </div>

        {/* Clinics list */}
        <div className="p-4 space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
          {clinics.map((clinic) => (
            <button
              key={clinic.id}
              onClick={() => onSelect(clinic.id, remember)}
              onMouseEnter={() => setHoveredId(clinic.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={classNames(
                "w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98]",
                hoveredId === clinic.id
                  ? "border-brand-400 bg-brand-50"
                  : "border-ink-100 bg-white hover:border-brand-200 hover:bg-brand-50/40"
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-ink-50 border border-ink-100 flex items-center justify-center overflow-hidden shrink-0">
                {clinic.logoUrl ? (
                  <img src={clinic.logoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Building2 size={18} className="text-ink-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-black text-ink-900 truncate">{clinic.name}</p>
                  {clinic.shared && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 text-[9px] font-black uppercase tracking-wider shrink-0">
                      <Users size={9} /> {clinic.role === 'editor' ? 'Editor' : 'Leitura'}
                    </span>
                  )}
                </div>
                {clinic.address?.city && (
                  <p className="text-[10px] text-ink-500 font-medium truncate mt-0.5">
                    {clinic.address.city}{clinic.address.state ? `/${clinic.address.state}` : ''}
                  </p>
                )}
              </div>
              {hoveredId === clinic.id && (
                <Check size={16} className="text-brand-600 shrink-0" />
              )}
            </button>
          ))}

          {/* All clinics option */}
          <button
            onClick={() => onSelect(null, remember)}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-ink-200 text-left transition-all hover:border-ink-400 hover:bg-ink-50/50 active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-ink-50 border border-ink-100 flex items-center justify-center shrink-0">
              <X size={16} className="text-ink-400" />
            </div>
            <div>
              <p className="text-sm font-black text-ink-700">Todas as clínicas</p>
              <p className="text-[10px] text-ink-500 font-medium mt-0.5">Ver exames de todas as unidades</p>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-4 pb-5 pt-3 border-t border-ink-50">
          <label className="flex items-center gap-2.5 cursor-pointer select-none group">
            <div
              onClick={() => setRemember(r => !r)}
              className={classNames(
                "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
                remember ? "bg-brand-600 border-brand-600" : "border-ink-300 bg-white group-hover:border-brand-400"
              )}
            >
              {remember && <Check size={12} className="text-white" />}
            </div>
            <span className="text-xs font-medium text-ink-600">Lembrar esta escolha como padrão</span>
          </label>
        </div>
      </div>
    </div>
  );
}
