import { useState, useEffect, useRef } from 'react';
import { Modal } from '../../../components/Modal';
import { ExamRequest, Patient, ReportTemplate, Clinic, AppSettings } from '../../../types';
import { updateItem, getItem } from '../../../store/db';
import { ClipboardList, ShieldCheck, Printer, RotateCcw, Check, FileText, UserCog, Loader2 } from 'lucide-react';
import { useCollection } from '../../../hooks/useFirestore';
import { useApp } from '../../../store/app';
import { getInitialReportContent } from '../../templates/utils';

export interface AnamnesisField {
  label: string;
  value: string;
  isStructured: boolean;
  rawLine: string;
}

export function parseAnamnesis(text: string): AnamnesisField[] {
  if (!text) return [];
  const lines = text.split('\n');
  return lines.map(line => {
    const match = line.match(/^([^:[\]]+):\s*\[([^\]]*)\]\s*$/);
    if (match) {
      return {
        label: match[1].trim(),
        value: match[2],
        isStructured: true,
        rawLine: line
      };
    }
    return {
      label: '',
      value: line,
      isStructured: false,
      rawLine: line
    };
  });
}

export function serializeAnamnesis(fields: AnamnesisField[]): string {
  return fields.map(field => {
    if (field.isStructured) {
      return `${field.label}: [${field.value}]`;
    }
    return field.value;
  }).join('\n');
}

interface Props {
  open: boolean;
  onClose: () => void;
  exam: ExamRequest;
  patient: Patient;
  template?: ReportTemplate | null;
  initialTab?: 'metadata' | 'anamnesis' | 'consent';
  clinic?: Clinic | null;
  settings?: AppSettings;
}

export function AnamnesisConsentModal({ open, onClose, exam, patient, template: initialTemplate, initialTab = 'metadata', clinic, settings }: Props) {
  const [activeTab, setActiveTab] = useState<'metadata' | 'anamnesis' | 'consent'>(initialTab);
  const [template, setTemplate] = useState<ReportTemplate | null>(initialTemplate || null);

  const { showToast } = useApp();
  const { data: clinics } = useCollection<Clinic>('clinics');
  const { data: allTemplates } = useCollection<ReportTemplate>('templates');
  const currentRole = settings?.currentRole || 'medico';
  const isEditable = exam.status !== 'finalizado' && currentRole !== 'recepcao';

  // Local state for fields
  const [anamnesis, setAnamnesis] = useState(exam.anamnesis ?? '');
  const [consentTerm, setConsentTerm] = useState(exam.consentTerm ?? '');
  const [consentAccepted, setConsentAccepted] = useState(exam.consentAccepted ?? false);
  const [viewMode, setViewMode] = useState<'form' | 'text'>('form');

  const isAnamnesisDirtyRef = useRef(false);
  const isConsentDirtyRef = useRef(false);
  const isAnamnesisFocusedRef = useRef(false);
  const isConsentFocusedRef = useRef(false);
  const anamnesisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (anamnesisTimerRef.current) clearTimeout(anamnesisTimerRef.current);
      if (consentTimerRef.current) clearTimeout(consentTimerRef.current);
    };
  }, []);

  // Metadata tab states
  const [requestingPhysician, setRequestingPhysician] = useState(exam.requestingPhysician || '');
  const [clinicId, setClinicId] = useState(exam.clinicId || '');
  const [examTemplateId, setExamTemplateId] = useState(exam.templateId || '');
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  useEffect(() => {
    setRequestingPhysician(exam.requestingPhysician || '');
    setClinicId(exam.clinicId || '');
    setExamTemplateId(exam.templateId || '');
  }, [patient, exam]);

  // Set default view mode based on structured fields
  useEffect(() => {
    if (open) {
      const fields = parseAnamnesis(exam.anamnesis || template?.anamnesisTemplate || '');
      const hasStructured = fields.some(f => f.isStructured);
      setViewMode(hasStructured ? 'form' : 'text');
    }
  }, [open, exam.templateId]);

  // Sync with exam data updates
  useEffect(() => {
    if (!isAnamnesisDirtyRef.current && !isAnamnesisFocusedRef.current) {
      setAnamnesis(exam.anamnesis ?? '');
    }
    if (!isConsentDirtyRef.current && !isConsentFocusedRef.current) {
      setConsentTerm(exam.consentTerm ?? '');
    }
    setConsentAccepted(exam.consentAccepted ?? false);
  }, [exam.anamnesis, exam.consentTerm, exam.consentAccepted]);

  // Load template dynamically if not provided as prop
  useEffect(() => {
    if (open && !template && exam.templateId) {
      getItem<ReportTemplate>('templates', exam.templateId).then((t) => {
        if (t) {
          setTemplate(t);
          // Auto-fill if empty
          if (!exam.anamnesis && t.anamnesisTemplate) {
            setAnamnesis(t.anamnesisTemplate);
            updateItem('exams', exam.id, { anamnesis: t.anamnesisTemplate });
          }
          if (!exam.consentTerm && t.consentTemplate) {
            setConsentTerm(t.consentTemplate);
            updateItem('exams', exam.id, { consentTerm: t.consentTemplate });
          }
        }
      });
    }
  }, [open, exam.templateId, template, exam.id, exam.anamnesis, exam.consentTerm]);

  // Sync active tab prop
  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  const handleSaveAnamnesis = (val: string) => {
    setAnamnesis(val);
    isAnamnesisDirtyRef.current = true;
    if (anamnesisTimerRef.current) clearTimeout(anamnesisTimerRef.current);
    
    anamnesisTimerRef.current = setTimeout(async () => {
      try {
        await updateItem('exams', exam.id, { anamnesis: val });
      } finally {
        isAnamnesisDirtyRef.current = false;
      }
    }, 800);
  };

  const handleBlurAnamnesis = async (val: string) => {
    isAnamnesisFocusedRef.current = false;
    if (isAnamnesisDirtyRef.current) {
      if (anamnesisTimerRef.current) clearTimeout(anamnesisTimerRef.current);
      try {
        await updateItem('exams', exam.id, { anamnesis: val });
      } finally {
        isAnamnesisDirtyRef.current = false;
      }
    }
  };

  const handleSaveConsentTerm = (val: string) => {
    setConsentTerm(val);
    isConsentDirtyRef.current = true;
    if (consentTimerRef.current) clearTimeout(consentTimerRef.current);
    
    consentTimerRef.current = setTimeout(async () => {
      try {
        await updateItem('exams', exam.id, { consentTerm: val });
      } finally {
        isConsentDirtyRef.current = false;
      }
    }, 800);
  };

  const handleBlurConsentTerm = async (val: string) => {
    isConsentFocusedRef.current = false;
    if (isConsentDirtyRef.current) {
      if (consentTimerRef.current) clearTimeout(consentTimerRef.current);
      try {
        await updateItem('exams', exam.id, { consentTerm: val });
      } finally {
        isConsentDirtyRef.current = false;
      }
    }
  };

  const handleToggleConsent = async (checked: boolean) => {
    setConsentAccepted(checked);
    await updateItem('exams', exam.id, {
      consentAccepted: checked,
      consentAcceptedAt: checked ? Date.now() : null,
    });
  };

  const handleRestoreAnamnesis = async () => {
    if (!template?.anamnesisTemplate) return;
    if (window.confirm('Deseja restaurar a anamnese para o padrão da máscara?')) {
      setAnamnesis(template.anamnesisTemplate);
      await updateItem('exams', exam.id, { anamnesis: template.anamnesisTemplate });
    }
  };

  const handleRestoreConsent = async () => {
    if (!template?.consentTemplate) return;
    if (window.confirm('Deseja restaurar o termo de consentimento para o padrão da máscara?')) {
      setConsentTerm(template.consentTemplate);
      await updateItem('exams', exam.id, { consentTerm: template.consentTemplate });
    }
  };

  const handleSaveMetadata = async () => {
    try {
      setLoadingMetadata(true);
      await updateItem('exams', exam.id, {
        requestingPhysician: requestingPhysician,
        clinicId: clinicId
      });
      showToast('Dados do exame atualizados com sucesso!', 'success');
    } catch (err) {
      showToast('Erro ao atualizar dados do exame.', 'error');
    } finally {
      setLoadingMetadata(false);
    }
  };

  const printDocument = (title: string, content: string, showSignature: boolean) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const physicianName = settings?.physicianName || 'Médico Executante';
    const physicianCRM = settings?.physicianCRM ? `CRM ${settings.physicianCRM}` : '';
    const clinicName = clinic?.name || settings?.clinicName || 'Clínica';
    const logoHtml = clinic?.logoUrl ? `<img src="${clinic.logoUrl}" alt="${clinicName}" class="logo" />` : `<h2>${clinicName}</h2>`;
    const patientDoc = patient.cpf ? `CPF: ${patient.cpf}` : (patient.rg ? `RG: ${patient.rg}` : 'Documento não informado');

    const signatureBlock = showSignature
      ? `
        <div class="signature-container">
          <div class="sig-box">
            <div class="line"></div>
            <p><strong>${patient.name}</strong></p>
            <p>Assinatura do Paciente (ou Responsável)</p>
            <p>${patientDoc}</p>
          </div>
          <div class="sig-box">
            <div class="line"></div>
            <p><strong>${physicianName}</strong></p>
            <p>Assinatura do Médico Executante</p>
            <p>${physicianCRM}</p>
          </div>
        </div>
      `
      : '';

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #111827; line-height: 1.6; font-size: 13px; max-width: 800px; margin: 0 auto; }
            .header-top { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px; }
            .header-top .logo { max-height: 50px; max-width: 200px; object-fit: contain; }
            .header-top .clinic-info { text-align: right; font-size: 11px; color: #6b7280; }
            .doc-title { text-align: center; margin-bottom: 30px; }
            .doc-title h1 { margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; color: #111827; }
            .metadata { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; padding: 20px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; }
            .metadata div p { margin: 4px 0; font-size: 12px; }
            .metadata strong { color: #374151; display: inline-block; width: 90px; }
            .content { white-space: pre-wrap; margin-bottom: 50px; text-align: justify; font-size: 13px; color: #374151; }
            .signature-container { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 80px; page-break-inside: avoid; }
            .sig-box { text-align: center; }
            .sig-box .line { border-top: 1px solid #000; margin-bottom: 12px; width: 100%; }
            .sig-box p { margin: 4px 0; font-size: 11px; color: #4b5563; }
            .sig-box strong { color: #111827; font-size: 12px; }
            @media print {
              body { padding: 0; max-width: 100%; }
              .metadata { background: none; border: 1px solid #d1d5db; }
              .header-top { border-bottom-color: #d1d5db; }
            }
          </style>
        </head>
        <body>
          <div class="header-top">
            <div>${logoHtml}</div>
            <div class="clinic-info">
              <p>Documento digital emitido em ${new Date().toLocaleString('pt-BR')}</p>
              <p>ID do Exame: ${(exam.friendlyId || exam.id).toUpperCase()}</p>
            </div>
          </div>
          
          <div class="doc-title">
            <h1>${title}</h1>
          </div>

          <div class="metadata">
            <div>
              <p><strong>Paciente:</strong> ${patient.name}</p>
              <p><strong>Nascimento:</strong> ${patient.birthDate ? new Date(patient.birthDate).toLocaleDateString('pt-BR') : 'Não informado'}</p>
              <p><strong>Gênero:</strong> ${patient.gender === 'M' ? 'Masculino' : patient.gender === 'F' ? 'Feminino' : 'Outro'}</p>
              <p><strong>Convênio:</strong> ${patient.insurance || 'Particular'}</p>
            </div>
            <div>
              <p><strong>Procedimento:</strong> ${exam.examType}</p>
              <p><strong>Especialidade:</strong> ${exam.area.replace(/-/g, ' ').toUpperCase()}</p>
              <p><strong>Médico(a):</strong> ${physicianName}</p>
              <p><strong>CRM:</strong> ${physicianCRM || 'Não informado'}</p>
            </div>
          </div>

          <div class="content">${content || 'Nenhum conteúdo registrado.'}</div>
          
          ${signatureBlock}
          
          <script>
            setTimeout(() => { window.print(); window.close(); }, 500);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ficha & Configurações do Exame"
      size="lg"
    >
      <div className="flex flex-col h-full space-y-4">
        {/* Navigation Tabs inside Modal */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
          <button
            onClick={() => setActiveTab('metadata')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'metadata'
                ? 'bg-white text-brand-650 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCog size={14} />
            Dados do Exame
          </button>
          <button
            onClick={() => setActiveTab('anamnesis')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'anamnesis'
                ? 'bg-white text-brand-650 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardList size={14} />
            Anamnese
          </button>
          <button
            onClick={() => setActiveTab('consent')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'consent'
                ? 'bg-white text-brand-650 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck size={14} />
            Termo de Consentimento
          </button>
        </div>

        {/* Tab 0: Metadata (Dados do Exame) */}
        {activeTab === 'metadata' && (
          <div className="flex-1 flex flex-col space-y-4 min-h-[350px]">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <UserCog size={16} className="text-brand-500" />
              <span className="text-xs font-bold text-slate-700">Configuração de Identificação & Unidade</span>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Médico Solicitante</label>
                  <input 
                    type="text"
                    className="h-10 px-3 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-xl text-xs font-semibold outline-none transition-all text-slate-850 shadow-sm disabled:opacity-60" 
                    value={requestingPhysician} 
                    onChange={e => setRequestingPhysician(e.target.value)}
                    disabled={!isEditable}
                  />
                </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Clínica</label>
                <select 
                  className="h-10 px-3 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-xl text-xs font-semibold outline-none transition-all text-slate-850 shadow-sm disabled:opacity-60" 
                  value={clinicId} 
                  onChange={e => setClinicId(e.target.value)}
                  disabled={!isEditable}
                >
                  <option value="">Selecione uma clínica</option>
                  {clinics.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-400 mt-1 ml-1 italic">
                  * Alterar a clínica afeta o template e a pasta de exportação do Google Docs.
                </p>
              </div>

              <div className="flex flex-col space-y-1.5 pt-2 border-t border-slate-100">
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Tipo de Exame (Máscara)</label>
                <select 
                  className="h-10 px-3 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-xl text-xs font-semibold outline-none transition-all text-slate-850 shadow-sm disabled:opacity-60" 
                  value={examTemplateId} 
                  onChange={async (e) => {
                    const newTemplateId = e.target.value;
                    const newTemplate = allTemplates.find(t => t.id === newTemplateId);
                    if (newTemplateId !== exam.templateId && newTemplate) {
                      const confirm = window.confirm(
                        'CUIDADO: Alterar o exame reiniciará o laudo para o padrão da nova máscara e apagará as informações atuais e o histórico do copiloto. Deseja prosseguir?'
                      );
                      if (confirm) {
                        try {
                          setLoadingMetadata(true);
                          await updateItem('exams', exam.id, {
                            templateId: newTemplate.id,
                            examType: newTemplate.name,
                            area: newTemplate.area,
                            reportContent: getInitialReportContent(newTemplate),
                            chatHistory: [],
                            anamnesis: newTemplate.anamnesisTemplate || '',
                            consentTerm: newTemplate.consentTemplate || ''
                          });
                          showToast('Exame alterado e reiniciado com sucesso!', 'success');
                          onClose();
                        } catch (err) {
                          showToast('Erro ao alterar exame.', 'error');
                        } finally {
                          setLoadingMetadata(false);
                        }
                      } else {
                        setExamTemplateId(exam.templateId || '');
                      }
                    }
                  }}
                  disabled={!isEditable}
                >
                  <option value="">Selecione um exame</option>
                  {allTemplates.slice().sort((a,b) => a.name.localeCompare(b.name)).map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.area})</option>
                  ))}
                </select>
                <p className="text-[9px] text-amber-600 mt-1 ml-1 font-bold">
                  * A troca de exame apaga o texto atual do laudo e o histórico do copiloto.
                </p>
              </div>
            </div>

            {isEditable && (
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={handleSaveMetadata}
                  disabled={loadingMetadata}
                  className="px-6 h-10 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 transition-all active:scale-95"
                >
                  {loadingMetadata ? <Loader2 size={14} className="animate-spin" /> : 'Salvar Alterações'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 1: Anamnesis */}
        {activeTab === 'anamnesis' && (() => {
          const fields = parseAnamnesis(anamnesis);
          const hasStructured = fields.some(f => f.isStructured);
          const structuredFields = fields.filter(f => f.isStructured);
          const unstructuredLines = fields.filter(f => !f.isStructured).map(f => f.value).join('\n').trim();

          const handleFieldChange = (idx: number, newVal: string) => {
            const updated = [...fields];
            updated[idx].value = newVal;
            handleSaveAnamnesis(serializeAnamnesis(updated));
          };

          const handleUnstructuredChange = (newUnstructured: string) => {
            const structuredPart = fields
              .filter(f => f.isStructured)
              .map(f => `${f.label}: [${f.value}]`)
              .join('\n');
            
            const newText = structuredPart 
              ? structuredPart + '\n' + newUnstructured
              : newUnstructured;
              
            handleSaveAnamnesis(newText);
          };

          return (
            <div className="flex-1 flex flex-col space-y-3 min-h-[350px]">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-brand-500" />
                    <span className="text-xs font-bold text-slate-700">Anamnese do Paciente</span>
                  </div>
                  
                  {hasStructured && (
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px]">
                      <button
                        onClick={() => setViewMode('form')}
                        className={`px-2 py-1 font-bold rounded-md transition-all ${
                          viewMode === 'form'
                            ? 'bg-white text-brand-650 shadow-sm border border-slate-200/50'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Formulário
                      </button>
                      <button
                        onClick={() => setViewMode('text')}
                        className={`px-2 py-1 font-bold rounded-md transition-all ${
                          viewMode === 'text'
                            ? 'bg-white text-brand-650 shadow-sm border border-slate-200/50'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Texto Livre
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {template?.anamnesisTemplate && isEditable && (
                    <button
                      onClick={handleRestoreAnamnesis}
                      title="Restaurar anamnese padrão da máscara"
                      className="text-[10px] font-black text-slate-500 hover:text-brand-600 flex items-center gap-1 uppercase tracking-wider transition-colors border border-slate-200 bg-slate-50 hover:bg-brand-50 px-2 py-1.5 rounded-lg"
                    >
                      <RotateCcw size={11} />
                      Restaurar Padrão
                    </button>
                  )}
                  <button
                    onClick={() => printDocument('Anamnese de Exame', anamnesis, false)}
                    className="text-[10px] font-black text-white bg-slate-900 hover:bg-slate-800 flex items-center gap-1.5 uppercase tracking-wider transition-all px-3 py-1.5 rounded-lg shadow-sm"
                  >
                    <Printer size={11} />
                    Imprimir
                  </button>
                </div>
              </div>

              {viewMode === 'form' && hasStructured ? (
                <div className="flex-1 flex flex-col space-y-4 min-h-[350px] overflow-y-auto max-h-[400px] pr-1">
                  {/* Form Fields Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    {fields.map((field, idx) => {
                      if (!field.isStructured) return null;
                      return (
                        <div key={idx} className="flex flex-col space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                            {field.label}
                          </label>
                          <input
                            type="text"
                            value={field.value}
                            disabled={!isEditable}
                            onFocus={() => isAnamnesisFocusedRef.current = true}
                            onBlur={() => handleBlurAnamnesis(serializeAnamnesis(fields))}
                            onChange={(e) => handleFieldChange(idx, e.target.value)}
                            className="h-10 px-3 bg-white border border-slate-200 focus:border-brand-500 rounded-xl text-xs font-semibold outline-none transition-all text-slate-850 shadow-sm disabled:opacity-60"
                            placeholder={`Preencher ${field.label.toLowerCase()}...`}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Additional Free Text Notes */}
                  <div className="flex flex-col space-y-1.5 flex-1 min-h-[120px]">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      Anotações Adicionais / Observações
                    </label>
                    <textarea
                      value={unstructuredLines}
                      disabled={!isEditable}
                      onFocus={() => isAnamnesisFocusedRef.current = true}
                      onBlur={() => handleBlurAnamnesis(anamnesis)}
                      onChange={(e) => handleUnstructuredChange(e.target.value)}
                      placeholder="Outros achados, cirurgias, observações ou queixas clínicas livres..."
                      className="w-full flex-1 p-4 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-xl outline-none transition-all text-xs font-semibold leading-relaxed resize-none text-slate-850 min-h-[100px] disabled:opacity-60"
                    />
                  </div>
                </div>
              ) : (
                <textarea
                  value={anamnesis}
                  disabled={!isEditable}
                  onFocus={() => isAnamnesisFocusedRef.current = true}
                  onBlur={(e) => handleBlurAnamnesis(e.target.value)}
                  onChange={(e) => handleSaveAnamnesis(e.target.value)}
                  placeholder="Descreva o histórico clínico do paciente, sintomas e indicações para este exame..."
                  className="w-full flex-1 p-4 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-xl outline-none transition-all text-xs font-semibold leading-relaxed resize-none text-slate-850 disabled:opacity-60"
                />
              )}
            </div>
          );
        })()}

        {/* Tab 2: Consent Term */}
        {activeTab === 'consent' && (
          <div className="flex-1 flex flex-col space-y-3 min-h-[350px]">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-indigo-500" />
                <span className="text-xs font-bold text-slate-700">Termo de Consentimento Informado</span>
              </div>
              <div className="flex items-center gap-2">
                {template?.consentTemplate && isEditable && (
                  <button
                    onClick={handleRestoreConsent}
                    title="Restaurar termo padrão da máscara"
                    className="text-[10px] font-black text-slate-500 hover:text-brand-600 flex items-center gap-1 uppercase tracking-wider transition-colors border border-slate-200 bg-slate-50 hover:bg-brand-50 px-2 py-1.5 rounded-lg"
                  >
                    <RotateCcw size={11} />
                    Restaurar Padrão
                  </button>
                )}
                <button
                  onClick={() => printDocument('Termo de Consentimento Livre e Esclarecido', consentTerm, true)}
                  className="text-[10px] font-black text-white bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1.5 uppercase tracking-wider transition-all px-3 py-1.5 rounded-lg shadow-sm"
                >
                  <Printer size={11} />
                  Imprimir Termo
                </button>
              </div>
            </div>

            <textarea
              value={consentTerm}
              disabled={!isEditable}
              onFocus={() => isConsentFocusedRef.current = true}
              onBlur={(e) => handleBlurConsentTerm(e.target.value)}
              onChange={(e) => handleSaveConsentTerm(e.target.value)}
              placeholder="Insira o texto explicativo do termo de consentimento livre e esclarecido..."
              className="w-full flex-1 p-4 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-xl outline-none transition-all text-xs font-semibold leading-relaxed resize-none text-slate-850 disabled:opacity-60"
            />

            {/* Checkbox for Acceptance */}
            <label className={`flex items-start gap-3 p-3 bg-indigo-50/50 border border-indigo-150 rounded-xl transition-all select-none ${isEditable ? 'hover:bg-indigo-50/80 cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}>
              <div className="relative flex items-center justify-center mt-0.5">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  disabled={!isEditable}
                  onChange={(e) => handleToggleConsent(e.target.checked)}
                  className="peer h-4 w-4 shrink-0 rounded border border-indigo-300 bg-white text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 transition-all checked:bg-indigo-600 checked:border-indigo-600 outline-none appearance-none disabled:opacity-60"
                />
                {consentAccepted && (
                  <Check size={11} className="absolute text-white pointer-events-none" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-extrabold text-indigo-900">
                  O Paciente (ou Responsável) aceitou e assinou este termo
                </span>
                <span className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                  {consentAccepted && exam.consentAcceptedAt
                    ? `Aceito em ${new Date(exam.consentAcceptedAt).toLocaleString('pt-BR')}`
                    : 'A assinatura física ou digital deve ser arquivada e associada à ficha médica do paciente.'}
                </span>
              </div>
            </label>
          </div>
        )}
      </div>
    </Modal>
  );
}
