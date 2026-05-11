import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { CALCULATORS } from './registry';
import { Calculator } from 'lucide-react';

export function Calculators() {
  return (
    <div className="max-w-5xl mx-auto py-8">
      <PageHeader
        title="Biblioteca de Calculadoras"
        subtitle="Explore e teste os módulos de cálculos clínicos complexos disponíveis para integração nas máscaras."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {CALCULATORS.map(calc => (
          <div key={calc.id} className="card overflow-hidden flex flex-col shadow-soft border border-ink-200">
            <div className="p-5 border-b border-ink-100 bg-white">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                  <Calculator size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-ink-900 text-lg">{calc.name}</h3>
                  <span className="text-[10px] uppercase font-bold text-ink-400 bg-ink-100 px-2 py-0.5 rounded">ID: {calc.id}</span>
                </div>
              </div>
              <p className="text-sm text-ink-500 mt-2">{calc.description}</p>
            </div>
            
            <div className="bg-ink-50/50 p-5 flex-1 border-b border-ink-100">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-4 text-center">Demonstração Interativa</h4>
              <DemoWrapper Component={calc.component} />
            </div>

            <div className="p-4 bg-white text-xs text-ink-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
              Pronta para ser adicionada no Editor de Máscaras (Tipo: "Calculadora Integrada")
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoWrapper({ Component }: { Component: React.FC<any> }) {
  const [val, setVal] = useState<any>({});
  return <Component value={val} onChange={setVal} />;
}
