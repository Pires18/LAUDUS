import { useState, useEffect, useRef } from 'react';
import { Modal } from '../../../components/Modal';
import { ExamRequest, Patient, ReportTemplate, Clinic, AppSettings } from '../../../types';
import { updateItem, getItem, deleteField } from '../../../store/db';
import { ShieldCheck, Printer, RotateCcw, Check, UserCog, Loader2, Users } from 'lucide-react';
import { useCollection } from '../../../hooks/useFirestore';
import { useApp } from '../../../store/app';
import { useConfirm } from '../../../hooks/useConfirm';
import { useAdmin } from '../../../hooks/useAdmin';
import { getCombinedInitialReportContent, combinedExamType, examTemplateIds } from '../../templates/utils';
import { PatientForm } from '../../patients/PatientForm';
import { toDateInputValue, parseDateInputValue } from '../../../utils/format';

interface Props {
  open: boolean;
  onClose: () => void;
  exam: ExamRequest;
  patient: Patient;
  template?: ReportTemplate | null;
  initialTab?: 'metadata' | 'patient' | 'consent';
  clinic?: Clinic | null;
  settings?: AppSettings;
}

export function AnamnesisConsentModal({ open, onClose, exam, patient, template: initialTemplate, initialTab = 'metadata', clinic, settings }: Props) {
  const [activeTab, setActiveTab] = useState<'metadata' | 'patient' | 'consent'>(initialTab);
  const [template, setTemplate] = useState<ReportTemplate | null>(initialTemplate || null);

  const { showToast } = useApp();
  const confirm = useConfirm();
  const { data: clinics } = useCollection<Clinic>('clinics');
  const { data: allTemplates } = useCollection<ReportTemplate>('templates');
  const { role: currentRole } = useAdmin();
  const isEditable = exam.status !== 'finalizado' && currentRole !== 'recepcao';

  // Local state for fields
  const [consentTerm, setConsentTerm] = useState(exam.consentTerm ?? '');
  const [consentAccepted, setConsentAccepted] = useState(exam.consentAccepted ?? false);

  const isConsentDirtyRef = useRef(false);
  const isConsentFocusedRef = useRef(false);
  const consentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (consentTimerRef.current) clearTimeout(consentTimerRef.current);
    };
  }, []);

  // Metadata tab states
  const [requestingPhysician, setRequestingPhysician] = useState(exam.requestingPhysician || '');
  const [clinicId, setClinicId] = useState(exam.clinicId || '');
  const [examTemplateId, setExamTemplateId] = useState(exam.templateId || '');
  // Exame combinado: 2ª máscara ('' = exame simples).
  const [secondaryTemplateId, setSecondaryTemplateId] = useState(exam.templateIds?.[1] || '');
  const [examDateStr, setExamDateStr] = useState(toDateInputValue(exam.examDate ?? exam.createdAt));
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  useEffect(() => {
    setRequestingPhysician(exam.requestingPhysician || '');
    setClinicId(exam.clinicId || '');
    setExamTemplateId(exam.templateId || '');
    setSecondaryTemplateId(exam.templateIds?.[1] || '');
    setExamDateStr(toDateInputValue(exam.examDate ?? exam.createdAt));
  }, [patient, exam]);

  /**
   * Aplica a troca de máscara(s) do exame — simples ou combinada. Destrutivo:
   * reinicia laudo, chat, anamnese, formulário estruturado e termo (o fluxo
   * antigo de troca única não limpava structuredValue — bug latente corrigido
   * aqui para os dois caminhos).
   */
  const applyMaskChange = async (primaryId: string, secondaryId: string) => {
    const primary = allTemplates.find((t) => t.id === primaryId);
    if (!primary) return;
    const secondary = secondaryId ? allTemplates.find((t) => t.id === secondaryId) : null;
    const tplList = secondary ? [primary, secondary] : [primary];
    const ids = tplList.map((t) => t.id);
    if (ids.join(',') === examTemplateIds(exam).join(',')) return;

    const ok = await confirm({
      title: secondary ? 'Alterar Combinação de Exames' : 'Alterar Máscara',
      message: 'CUIDADO: Alterar o exame reiniciará o laudo para o padrão da(s) nova(s) máscara(s) e apagará as informações atuais, o formulário estruturado e o histórico do copiloto. Deseja prosseguir?',
      confirmLabel: 'Prosseguir',
      variant: 'danger',
    });
    if (!ok) {
      setExamTemplateId(exam.templateId || '');
      setSecondaryTemplateId(exam.templateIds?.[1] || '');
      return;
    }
    try {
      setLoadingMetadata(true);
      await updateItem('exams', exam.id, {
        templateId: primary.id,
        templateIds: ids,
        examType: combinedExamType(tplList),
        area: primary.area,
        reportContent: getCombinedInitialReportContent(tplList),
        chatHistory: [],
        anamnesis: '',
        structuredValue: {},
        consentTerm: tplList.map((t) => t.consentTemplate).filter(Boolean).join('\n\n') || '',
      });
      showToast('Exame alterado e reiniciado com sucesso!', 'success');
      onClose();
    } catch (err) {
      showToast('Erro ao alterar exame.', 'error');
    } finally {
      setLoadingMetadata(false);
    }
  };

  // Sync with exam data updates
  useEffect(() => {
    if (!isConsentDirtyRef.current && !isConsentFocusedRef.current) {
      setConsentTerm(exam.consentTerm ?? '');
    }
    setConsentAccepted(exam.consentAccepted ?? false);
  }, [exam.consentTerm, exam.consentAccepted]);

  // Load template dynamically if not provided as prop
  useEffect(() => {
    if (open && !template && exam.templateId) {
      getItem<ReportTemplate>('templates', exam.templateId).then((t) => {
        if (t) {
          setTemplate(t);
          if (!exam.consentTerm && t.consentTemplate) {
            setConsentTerm(t.consentTemplate);
            updateItem('exams', exam.id, { consentTerm: t.consentTemplate });
          }
        }
      });
    }
  }, [open, exam.templateId, template, exam.id, exam.consentTerm]);

  // Sync active tab prop
  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);



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

  const handleRestoreConsent = async () => {
    if (!template?.consentTemplate) return;
    const ok = await confirm({
      title: 'Restaurar Termo',
      message: 'Deseja restaurar o termo de consentimento para o padrão da máscara?',
      confirmLabel: 'Restaurar',
      variant: 'warning',
    });
    if (ok) {
      setConsentTerm(template.consentTemplate);
      await updateItem('exams', exam.id, { consentTerm: template.consentTemplate });
    }
  };

  const handleSaveMetadata = async () => {
    try {
      setLoadingMetadata(true);
      // Fix 12: use deleteField() for empty clinicId to keep Firestore clean
      // Só a data muda; o horário permanece o da criação do exame
      const parsedExamDate = parseDateInputValue(examDateStr, exam.createdAt);
      await updateItem('exams', exam.id, {
        requestingPhysician: requestingPhysician,
        clinicId: clinicId || deleteField(),
        ...(parsedExamDate !== null ? { examDate: parsedExamDate } : {})
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
        <div className="flex bg-ink-100 p-1 rounded-xl w-fit border border-ink-200">
          <button
            onClick={() => setActiveTab('metadata')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'metadata'
                ? 'bg-white text-brand-650 shadow-sm border border-ink-200'
                : 'text-ink-500 hover:text-ink-800'
            }`}
          >
            <UserCog size={14} />
            Dados do Exame
          </button>
          <button
            onClick={() => setActiveTab('patient')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'patient'
                ? 'bg-white text-brand-650 shadow-sm border border-ink-200'
                : 'text-ink-500 hover:text-ink-800'
            }`}
          >
            <Users size={14} />
            Dados do Paciente
          </button>
          <button
            onClick={() => setActiveTab('consent')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'consent'
                ? 'bg-white text-brand-650 shadow-sm border border-ink-200'
                : 'text-ink-500 hover:text-ink-800'
            }`}
          >
            <ShieldCheck size={14} />
            Termo de Consentimento
          </button>
        </div>

        {/* Tab 0: Metadata (Dados do Exame) */}
        {activeTab === 'metadata' && (
          <div className="flex-1 flex flex-col space-y-4 min-h-[350px]">
            <div className="flex items-center gap-2 pb-2 border-b border-ink-100">
              <UserCog size={16} className="text-brand-500" />
              <span className="text-xs font-bold text-ink-700">Configuração de Identificação & Unidade</span>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-ink-400 mb-1 ml-1">Médico Solicitante</label>
                  <input 
                    type="text"
                    className="h-10 px-3 bg-ink-50 border border-ink-200 focus:border-brand-500 focus:bg-white rounded-xl text-xs font-semibold outline-none transition-all text-ink-850 shadow-sm disabled:opacity-60" 
                    value={requestingPhysician} 
                    onChange={e => setRequestingPhysician(e.target.value)}
                    disabled={!isEditable}
                  />
                </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-[10px] font-black uppercase text-ink-400 mb-1 ml-1">Data do Exame</label>
                <input
                  type="date"
                  className="h-10 px-3 bg-ink-50 border border-ink-200 focus:border-brand-500 focus:bg-white rounded-xl text-xs font-semibold outline-none transition-all text-ink-850 shadow-sm disabled:opacity-60"
                  value={examDateStr}
                  onChange={e => setExamDateStr(e.target.value)}
                  disabled={!isEditable}
                />
                <p className="text-[9px] text-ink-400 mt-1 ml-1 italic">
                  * Data real de realização do exame — usada no laudo impresso e no cálculo de idade.
                </p>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-[10px] font-black uppercase text-ink-400 mb-1 ml-1">Clínica</label>
                <select 
                  className="h-10 px-3 bg-ink-50 border border-ink-200 focus:border-brand-500 focus:bg-white rounded-xl text-xs font-semibold outline-none transition-all text-ink-850 shadow-sm disabled:opacity-60" 
                  value={clinicId} 
                  onChange={e => setClinicId(e.target.value)}
                  disabled={!isEditable}
                >
                  <option value="">Selecione uma clínica</option>
                  {clinics.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-[9px] text-ink-400 mt-1 ml-1 italic">
                  * Alterar a clínica afeta o template e a pasta de exportação do Google Docs.
                </p>
              </div>

              <div className="flex flex-col space-y-1.5 pt-2 border-t border-ink-100">
                <label className="text-[10px] font-black uppercase text-ink-400 mb-1 ml-1">Tipo de Exame (Máscara)</label>
                <select
                  className="h-10 px-3 bg-ink-50 border border-ink-200 focus:border-brand-500 focus:bg-white rounded-xl text-xs font-semibold outline-none transition-all text-ink-850 shadow-sm disabled:opacity-60"
                  value={examTemplateId}
                  onChange={(e) => {
                    const newTemplateId = e.target.value;
                    if (!newTemplateId) return;
                    setExamTemplateId(newTemplateId);
                    applyMaskChange(newTemplateId, secondaryTemplateId);
                  }}
                  disabled={!isEditable}
                >
                  <option value="">Selecione um exame</option>
                  {allTemplates.slice().sort((a,b) => a.name.localeCompare(b.name)).map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.area})</option>
                  ))}
                </select>
                <label className="text-[10px] font-black uppercase text-ink-400 mb-1 ml-1 mt-2">2º Exame (Laudo Combinado)</label>
                <select
                  className="h-10 px-3 bg-ink-50 border border-ink-200 focus:border-brand-500 focus:bg-white rounded-xl text-xs font-semibold outline-none transition-all text-ink-850 shadow-sm disabled:opacity-60"
                  value={secondaryTemplateId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSecondaryTemplateId(newId);
                    applyMaskChange(examTemplateId, newId);
                  }}
                  disabled={!isEditable}
                >
                  <option value="">— nenhum (exame simples) —</option>
                  {allTemplates
                    .filter((t) => t.id !== examTemplateId && t.area !== 'medicina-fetal' && t.area !== 'procedimentos')
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.area})</option>
                    ))}
                </select>
                <p className="text-[9px] text-amber-600 mt-1 ml-1 font-bold">
                  * A troca de exame apaga o texto atual do laudo, o formulário estruturado e o histórico do copiloto.
                  {secondaryTemplateId && ' Laudo combinado consome 2 laudos da cota por geração.'}
                </p>
              </div>
            </div>

            {isEditable && (
              <div className="flex justify-end pt-4 border-t border-ink-100">
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

        {/* Tab 1: Patient Data */}
        {activeTab === 'patient' && (
          <div className="flex-1 flex flex-col space-y-4 min-h-[350px] overflow-y-auto max-h-[500px] pr-1">
            <div className="flex items-center gap-2 pb-2 border-b border-ink-100">
              <Users size={16} className="text-brand-500" />
              <span className="text-xs font-bold text-ink-700">Dados do Paciente</span>
            </div>
            <PatientForm
              initial={patient}
              onCancel={onClose}
              onSubmit={async (data) => {
                try {
                  await updateItem('patients', patient.id, data);
                  showToast('Dados do paciente atualizados com sucesso', 'success');
                  onClose();
                } catch (err) {
                  showToast('Erro ao atualizar dados do paciente', 'error');
                }
              }}
            />
          </div>
        )}

        {/* Tab 2: Consent Term */}
        {activeTab === 'consent' && (
          <div className="flex-1 flex flex-col space-y-3 min-h-[350px]">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-indigo-500" />
                <span className="text-xs font-bold text-ink-700">Termo de Consentimento Informado</span>
              </div>
              <div className="flex items-center gap-2">
                {template?.consentTemplate && isEditable && (
                  <button
                    onClick={handleRestoreConsent}
                    title="Restaurar termo padrão da máscara"
                    className="text-[10px] font-black text-ink-500 hover:text-brand-600 flex items-center gap-1 uppercase tracking-wider transition-colors border border-ink-200 bg-ink-50 hover:bg-brand-50 px-2 py-1.5 rounded-lg"
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
              className="w-full flex-1 p-4 bg-ink-50 border border-ink-200 focus:border-brand-500 focus:bg-white rounded-xl outline-none transition-all text-xs font-semibold leading-relaxed resize-none text-ink-850 disabled:opacity-60"
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
