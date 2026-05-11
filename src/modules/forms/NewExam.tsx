import { useState, useMemo } from 'react';
import { useApp } from '../../store/app';
import { useCollection } from '../../hooks/useFirestore';
import { addItemWithId, generateStandardId } from '../../store/db';
import { PageHeader } from '../../components/PageHeader';
import { Patient, ReportTemplate, EXAM_AREAS, Clinic } from '../../types';
import { Search, ArrowRight, UserPlus, FileText, CheckCircle2, Building2 } from 'lucide-react';

export function NewExam() {
  const { setView, showToast, selectedClinicId } = useApp();
  
  // States para o Wizard
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [examClinicId, setExamClinicId] = useState<string | null>(selectedClinicId);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [searchPatient, setSearchPatient] = useState('');

  // Firestore Data
  const { data: clinics } = useCollection<Clinic>('clinics');
  const { data: patients, loading: loadingPatients } = useCollection<Patient>('patients');
  const { data: templates } = useCollection<ReportTemplate>('templates');

  const filteredPatients = patients.filter(
    (p) =>
      !searchPatient ||
      p.name.toLowerCase().includes(searchPatient.toLowerCase()) ||
      p.cpf?.includes(searchPatient)
  );

  // Filtra templates considerando a área selecionada E a clínica (mostra os globais e os da clínica)
  const availableTemplates = useMemo(() => {
    return templates.filter(t => {
      if (t.area !== area) return false;
      if (t.clinicId && t.clinicId !== examClinicId) return false; // Exclui de outras clínicas
      return true;
    });
  }, [templates, area, examClinicId]);

  async function handleCreate() {
    if (!patientId || !area || !templateId) return;

    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    const examId = generateStandardId('EXA');
    await addItemWithId('exams', examId, {
      patientId,
      clinicId: examClinicId || undefined,
      area: template.area,
      examType: template.name,
      templateId: template.id,
      status: 'pendente',
      formData: {},
      reportContent: '',
    });

    showToast('Exame criado com sucesso', 'success');
    setView({ name: 'exam-editor', examId });
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <PageHeader
        title="Novo Laudo"
        subtitle="Siga os passos para iniciar um novo exame"
      />

      {/* ─── WIZARD PROGRESS ─── */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-ink-100 -z-10" />
        {[
          { num: 1, label: 'Clínica' },
          { num: 2, label: 'Paciente' },
          { num: 3, label: 'Área' },
          { num: 4, label: 'Máscara' },
        ].map((s) => (
          <div key={s.num} className="flex flex-col items-center gap-2 bg-ink-50/80 px-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step > s.num
                  ? 'bg-emerald-500 text-white'
                  : step === s.num
                  ? 'bg-brand-600 text-white shadow-lg ring-4 ring-brand-100'
                  : 'bg-white text-ink-400 border-2 border-ink-200'
              }`}
            >
              {step > s.num ? <CheckCircle2 size={16} /> : s.num}
            </div>
            <span
              className={`text-xs font-medium ${
                step >= s.num ? 'text-ink-900' : 'text-ink-400'
              }`}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <div className="card p-6 shadow-medium relative overflow-hidden">
        {/* ─── STEP 1: CLÍNICA ─── */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="text-lg font-semibold text-ink-900 mb-4">Selecione a Clínica</h2>
            {clinics.length === 0 ? (
              <div className="text-center py-8 bg-ink-50 rounded-xl border border-ink-100">
                <Building2 size={24} className="mx-auto text-ink-400 mb-2" />
                <p className="text-sm text-ink-600 font-medium">Nenhuma clínica cadastrada.</p>
                <p className="text-xs text-ink-400 mb-4">Você pode pular este passo se não usar clínicas.</p>
                <button className="btn-secondary" onClick={() => setStep(2)}>
                  Pular passo
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => setExamClinicId(null)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    examClinicId === null
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-ink-100 hover:border-ink-300'
                  }`}
                >
                  <Building2 size={20} className={examClinicId === null ? 'text-brand-600 mb-2' : 'text-ink-400 mb-2'} />
                  <div className="font-medium text-ink-900 text-sm">Sem Clínica Vinculada</div>
                  <div className="text-xs text-ink-500 mt-1">Laudo genérico</div>
                </button>
                
                {clinics.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setExamClinicId(c.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all flex items-start gap-3 ${
                      examClinicId === c.id
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-ink-100 hover:border-ink-300'
                    }`}
                  >
                    {c.logoUrl ? (
                      <img src={c.logoUrl} alt={c.name} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-ink-100 flex items-center justify-center shrink-0">
                        <Building2 size={16} className="text-ink-400" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-ink-900 text-sm">{c.name}</div>
                      <div className="text-xs text-ink-500 mt-1 truncate max-w-[140px]">{c.address?.city || 'Sem cidade'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-4 border-t border-ink-100">
              <button className="btn-primary" onClick={() => setStep(2)}>
                Próximo <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: PACIENTE ─── */}
        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="text-lg font-semibold text-ink-900 mb-4">Selecione o Paciente</h2>
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  value={searchPatient}
                  onChange={(e) => setSearchPatient(e.target.value)}
                  placeholder="Buscar paciente cadastrado..."
                  className="input pl-10"
                />
              </div>
              <button
                className="btn-secondary whitespace-nowrap"
                onClick={() => setView({ name: 'patients' })}
              >
                <UserPlus size={16} /> Cadastrar Novo
              </button>
            </div>

            <div className="border border-ink-200 rounded-xl max-h-[300px] overflow-y-auto mb-6">
              {loadingPatients ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-ink-50 rounded animate-pulse" />)}
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className="p-8 text-center text-ink-500 text-sm">
                  Nenhum paciente encontrado.
                </div>
              ) : (
                <div className="divide-y divide-ink-100">
                  {filteredPatients.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPatientId(p.id)}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${
                        patientId === p.id ? 'bg-brand-50' : 'hover:bg-ink-50'
                      }`}
                    >
                      <div>
                        <div className="font-medium text-ink-900">{p.name}</div>
                        <div className="text-xs text-ink-500">
                          {p.cpf ? `CPF: ${p.cpf}` : 'Sem CPF'} • DN: {p.birthDate || 'N/A'}
                        </div>
                      </div>
                      {patientId === p.id && <CheckCircle2 className="text-brand-600" size={20} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4 border-t border-ink-100">
              <button className="btn-secondary" onClick={() => setStep(1)}>Voltar</button>
              <button className="btn-primary" disabled={!patientId} onClick={() => setStep(3)}>
                Próximo <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: ÁREA ─── */}
        {step === 3 && (
          <div className="animate-fade-in">
            <h2 className="text-lg font-semibold text-ink-900 mb-4">Qual a área do exame?</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              {EXAM_AREAS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setArea(a.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    area === a.id
                      ? 'border-brand-500 bg-brand-50 shadow-sm'
                      : 'border-ink-100 hover:border-ink-300'
                  }`}
                >
                  <div className="font-medium text-ink-900 text-sm mb-1">{a.label}</div>
                  <div className={`chip inline-flex text-[10px] ${a.color}`}>Selecionar</div>
                </button>
              ))}
            </div>

            <div className="flex justify-between pt-4 border-t border-ink-100">
              <button className="btn-secondary" onClick={() => setStep(2)}>Voltar</button>
              <button className="btn-primary" disabled={!area} onClick={() => setStep(4)}>
                Próximo <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 4: MÁSCARA ─── */}
        {step === 4 && (
          <div className="animate-fade-in">
            <h2 className="text-lg font-semibold text-ink-900 mb-1">Escolha a Máscara</h2>
            <p className="text-sm text-ink-500 mb-4">
              Baseada na área selecionada
              {examClinicId && ` e nas máscaras da clínica selecionada`}.
            </p>

            <div className="border border-ink-200 rounded-xl max-h-[300px] overflow-y-auto mb-6">
              {availableTemplates.length === 0 ? (
                <div className="p-8 text-center text-ink-500 text-sm">
                  Nenhuma máscara encontrada para esta área.
                  <br />
                  <button
                    className="text-brand-600 hover:underline mt-2"
                    onClick={() => setView({ name: 'templates' })}
                  >
                    Criar nova máscara
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-ink-100">
                  {availableTemplates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTemplateId(t.id)}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${
                        templateId === t.id ? 'bg-brand-50' : 'hover:bg-ink-50'
                      }`}
                    >
                      <div>
                        <div className="font-medium text-ink-900 flex items-center gap-2">
                          <FileText size={16} className="text-ink-400" />
                          {t.name}
                        </div>
                        <div className="text-xs text-ink-500 mt-1 pl-6 flex items-center gap-2">
                          {t.formFields.length} campos de formulário
                          {t.clinicId && (
                            <span className="bg-ink-100 text-ink-600 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                              <Building2 size={10} /> Máscara de Clínica
                            </span>
                          )}
                        </div>
                      </div>
                      {templateId === t.id && <CheckCircle2 className="text-brand-600" size={20} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4 border-t border-ink-100">
              <button className="btn-secondary" onClick={() => setStep(3)}>Voltar</button>
              <button className="btn-primary" disabled={!templateId} onClick={handleCreate}>
                Criar Laudo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
