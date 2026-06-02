import React from 'react';
import { classNames } from '../../../utils/format';
import { CheckCircle2, Info, AlertCircle, HelpCircle } from 'lucide-react';

interface CategoryOption {
  label: string;
  points?: number;
  value?: any;
  description?: string;
}

interface CategorySelectorProps {
  label: string;
  options: CategoryOption[];
  current: any;
  onSelect: (val: any) => void;
  columns?: 1 | 2 | 3;
}

export function CategorySelector({ label, options, current, onSelect, columns = 2 }: CategorySelectorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-1 h-3 bg-brand-500 rounded-full" />
        <label className="text-[10px] font-black text-ink-900 uppercase tracking-widest">{label}</label>
      </div>
      <div className={classNames(
        "grid gap-2",
        columns === 1 ? "grid-cols-1" : "grid-cols-2"
      )}>
        {options.map((o) => {
          const isSelected = current === (o.points !== undefined ? o.points : o.value);
          return (
            <button
              key={o.label}
              type="button"
              onClick={() => onSelect(o.points !== undefined ? o.points : o.value)}
              className={classNames(
                "flex flex-col items-start text-left p-3 rounded-2xl border-2 transition-all group relative overflow-hidden",
                isSelected 
                  ? "border-brand-500 bg-brand-50 shadow-sm" 
                  : "border-ink-100 bg-white hover:border-ink-200 hover:bg-ink-50/50"
              )}
            >
              <div className="flex items-center justify-between w-full mb-0.5">
                <span className={classNames(
                  "text-[11px] font-bold leading-tight",
                  isSelected ? "text-brand-900" : "text-ink-700"
                )}>
                  {o.label}
                </span>
                {o.points !== undefined && (
                  <span className={classNames(
                    "text-[10px] font-black px-1.5 py-0.5 rounded-lg",
                    isSelected ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-500"
                  )}>
                    {o.points}
                  </span>
                )}
              </div>
              {o.description && (
                <p className="text-[9px] text-ink-400 font-medium leading-tight mt-1">{o.description}</p>
              )}
              {isSelected && (
                <div className="absolute -bottom-1 -right-1 opacity-10">
                   <CheckCircle2 size={32} className="text-brand-500" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ResultCardProps {
  label: string;
  value: string;
  points?: number;
  recommendation?: string;
  variant?: 'brand' | 'emerald' | 'amber' | 'red';
}

export function ResultCard({ label, value, points, recommendation, variant = 'brand' }: ResultCardProps) {
  const styles = {
    brand: "bg-brand-50 border-brand-200 text-brand-900 icon-text-brand-600",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900 icon-text-emerald-600",
    amber: "bg-amber-50 border-amber-200 text-amber-900 icon-text-amber-600",
    red: "bg-red-50 border-red-200 text-red-900 icon-text-red-600",
  }[variant];

  return (
    <div className={classNames("rounded-[2rem] border-2 p-6 flex flex-col gap-4 animate-in slide-in-from-bottom-2 duration-300 shadow-sm", styles)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
           <div className={classNames("w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm", variant === 'brand' ? 'text-brand-600' : '')}>
              <CheckCircle2 size={20} />
           </div>
           <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{label}</p>
              <h3 className="text-xl font-black tracking-tight">{value} {points !== undefined && `(${points} pts)`}</h3>
           </div>
        </div>
      </div>
      
      {recommendation && (
        <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-4 border border-current/10">
           <div className="flex gap-3">
              <Info size={16} className="shrink-0 mt-0.5" />
              <p className="text-xs font-bold leading-relaxed">{recommendation}</p>
           </div>
        </div>
      )}
    </div>
  );
}

export function CalculatorInput({ label, value, onChange, placeholder, type = 'text', suffix }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-12 px-4 bg-white border-2 border-ink-100 rounded-2xl focus:border-brand-500 focus:ring-4 focus:ring-brand-500/5 outline-none transition-all text-sm font-bold"
        />
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-ink-300 uppercase">{suffix}</span>
        )}
      </div>
    </div>
  );
}

export function CalculatorReference({ text, link }: { text: string; link?: string }) {
  return (
    <div className="mt-8 pt-6 border-t border-ink-100 flex items-start gap-3.5 text-xs text-ink-500 font-medium">
      <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 shadow-sm">
        <Info size={16} />
      </div>
      <div className="flex-1 leading-relaxed pt-0.5">
        <span className="font-black text-ink-900 uppercase text-[9px] tracking-widest block mb-1">Referência Científica & Diretriz</span>
        <span>{text}</span>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:text-brand-700 hover:underline font-bold transition-all block sm:inline sm:ml-2 mt-1 sm:mt-0"
          >
            Ver Diretriz original →
          </a>
        )}
      </div>
    </div>
  );
}
