import { useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { classNames } from '../../../../utils/format';

// Primitivas de formulário do AdminFinanceiro — extraídas (autocontidas).
export const FormLabel = ({ children }: { children: ReactNode }) => (
  <label className="text-[10px] font-black uppercase tracking-widest text-ink-400 block mb-1">{children}</label>
);

export function NumInput({ label, hint, value, onChange, step = 1 }: { label: string; hint?: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <FormLabel>{label}</FormLabel>
      <input type="number" min={0} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="input h-9 text-sm w-full" />
      {hint && <p className="text-[9px] text-ink-400 mt-0.5">{hint}</p>}
    </div>
  );
}

export function BoolToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      className={classNames(
        'flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all select-none',
        value ? 'bg-brand-50 border-brand-200' : 'bg-ink-50 border-ink-100'
      )}
      onClick={() => onChange(!value)}
    >
      <span className="text-[10px] font-bold text-ink-700">{label}</span>
      <MiniToggle value={value} onChange={() => {}} />
    </div>
  );
}

export function MiniToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onChange(!value); }}
      className={classNames('w-9 h-5 rounded-full relative transition-all flex-shrink-0', value ? 'bg-brand-600' : 'bg-ink-300')}
    >
      <div className={classNames('w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all shadow-sm', value ? 'left-[18px]' : 'left-[3px]')} />
    </button>
  );
}

export function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <FormLabel>{label}</FormLabel>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="input h-10 text-sm w-full" />
    </div>
  );
}

export function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <FormLabel>{label}</FormLabel>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          className="input h-10 text-sm w-full pr-10"
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 transition-colors"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

