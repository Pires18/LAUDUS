import { useApp } from '../../store/app';
import { useDocument, useCollection } from '../../hooks/useFirestore';
import { deleteItem } from '../../store/db';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ClinicTeamCard } from '../../components/ClinicTeamCard';
import { ReceptionAccessCard } from '../../components/ReceptionAccessCard';
import { Clinic, ExamRequest } from '../../types';
import { 
  Building2, MapPin, Phone, Mail, 
  Settings2, Trash2, ArrowLeft, Globe, 
  FileText, ExternalLink, Activity,
  CheckCircle2, AlertCircle, Calendar
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { classNames, formatCNPJ, formatPhone } from '../../utils/format';
import { useAdmin } from '../../hooks/useAdmin';

interface Props {
  clinicId: string;
}

export function ClinicDetail({ clinicId }: Props) {
  const { setView, showToast, selectedClinicId, setSelectedClinic, clinicOwnerMap } = useApp();
  // Gestão de equipe/recepção é do dono da clínica — oculta para a recepção.
  const { role } = useAdmin();
  const isReception = role === 'recepcao';
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Só força a clínica ativa quando é COMPARTILHADA (dono != usuário atual):
  // patients/exams/appointments sem filtro explícito de clínica resolvem a
  // subárvore a consultar pela clínica ATIVA (ver store/clinicAccess.ts) —
  // sem isto, abrir o detalhe de uma clínica compartilhada sem tê-la
  // selecionado antes (ex.: pelo dropdown) consultaria a subárvore errada.
  // Para clínicas PRÓPRIAS não mexe no contexto ativo (o filtro abaixo já usa
  // o clinicId explícito, e mudar o contexto global aqui seria uma surpresa
  // desnecessária para quem não usa equipe multiusuário).
  useEffect(() => {
    if (clinicOwnerMap[clinicId] && selectedClinicId !== clinicId) {
      setSelectedClinic(clinicId);
    }
  }, [clinicId, clinicOwnerMap, selectedClinicId, setSelectedClinic]);

  const { data: clinic, loading } = useDocument<Clinic>('clinics', clinicId);
  const { data: exams } = useCollection<ExamRequest>('exams');

  const clinicExams = useMemo(() => 
    exams.filter(e => e.clinicId === clinicId),
  [exams, clinicId]);

  const stats = useMemo(() => ({
    total: clinicExams.length,
    finalized: clinicExams.filter(e => e.status === 'finalizado').length,
    pending: clinicExams.filter(e => e.status === 'pendente').length,
  }), [clinicExams]);

  async function handleDelete() {
    try {
      await deleteItem('clinics', clinicId);
      showToast('Clínica excluída com sucesso', 'success');
      setView({ name: 'clinics' });
    } catch {
      showToast('Erro ao excluir clínica', 'error');
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        <p className="text-ink-400 font-bold uppercase tracking-widest text-xs">Carregando unidade...</p>
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="p-8 text-center bg-white border border-ink-100 rounded-3xl">
        <AlertCircle size={40} className="mx-auto text-red-500 mb-4" />
        <h3 className="text-lg font-black text-ink-900">Unidade não encontrada</h3>
        <button onClick={() => setView({ name: 'clinics' })} className="mt-4 text-brand-600 font-bold">Voltar para a lista</button>
      </div>
    );
  }

  return (
    <div className="module-container">
      <div className="max-w-7xl mx-auto w-full animate-fade-in space-y-5">
        
        {/* ─── COMPACT HEADER ─── */}
        <div className="bg-white border border-ink-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setView({ name: 'clinics' })}
                className="w-8 h-8 rounded-xl border border-ink-200 hover:bg-ink-50 text-ink-500 hover:text-ink-700 flex items-center justify-center transition-all shrink-0 active:scale-95"
                title="Voltar"
              >
                <ArrowLeft size={14} />
              </button>
              <div className="min-w-0">
                <h1 className="text-base font-black text-ink-900 tracking-tight leading-none truncate max-w-[200px] sm:max-w-md">{clinic.name}</h1>
                <p className="text-[11px] text-ink-500 font-medium mt-0.5">Visão Geral da Unidade</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setView({ name: 'clinic-form', clinicId })}
                className="h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-ink-500 hover:text-ink-700 bg-ink-100 border border-ink-200 hover:bg-ink-200 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Settings2 size={11} />
                Editar Unidade
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-600 hover:text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Trash2 size={11} />
                Excluir
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Profile Card */}
          <div className="lg:col-span-1 space-y-5">
            <div className="bg-white rounded-2xl border border-ink-200 shadow-sm p-5 text-center">
              <div className="w-24 h-24 rounded-xl bg-ink-50 border border-ink-200 mx-auto mb-4 flex items-center justify-center overflow-hidden">
                {clinic.logoUrl ? (
                  <img src={clinic.logoUrl} alt={clinic.name} className="w-full h-full object-cover" />
                ) : (
                  <Building2 size={36} className="text-ink-300" />
                )}
              </div>
              <h3 className="font-black text-ink-900 text-lg leading-tight mb-2 truncate">{clinic.name}</h3>
              <span className={classNames(
                "inline-block px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                clinic.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-ink-50 text-ink-500 border-ink-200"
              )}>
                {clinic.active ? 'Ativa' : 'Inativa'}
              </span>
            </div>
            
            <div className="bg-white rounded-2xl border border-ink-200 shadow-sm p-5 space-y-4">
              <h4 className="text-[9px] font-black text-ink-400 uppercase tracking-widest">Contato & Cadastro</h4>
              <div className="space-y-3">
                {clinic.cnpj && (
                  <div className="flex items-center gap-2.5 text-xs text-ink-600">
                    <FileText size={14} className="text-ink-400 shrink-0" />
                    <span className="font-mono">{formatCNPJ(clinic.cnpj)}</span>
                  </div>
                )}
                {clinic.phone && (
                  <div className="flex items-center gap-2.5 text-xs text-ink-600">
                    <Phone size={14} className="text-ink-400 shrink-0" />
                    <span>{formatPhone(clinic.phone)}</span>
                  </div>
                )}
                {clinic.email && (
                  <div className="flex items-center gap-2.5 text-xs text-ink-600">
                    <Mail size={14} className="text-ink-400 shrink-0" />
                    <span className="truncate block max-w-full">{clinic.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats & Integrations */}
          <div className="lg:col-span-3 space-y-5">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white p-5 rounded-2xl border border-ink-200 shadow-sm">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100">
                    <Activity size={14} />
                  </div>
                  <span className="text-[9px] font-black text-ink-400 uppercase tracking-widest">Total de Exames</span>
                </div>
                <p className="text-2xl font-black text-ink-900 leading-none">{stats.total}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-ink-200 shadow-sm">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                    <CheckCircle2 size={14} />
                  </div>
                  <span className="text-[9px] font-black text-ink-400 uppercase tracking-widest">Finalizados</span>
                </div>
                <p className="text-2xl font-black text-emerald-600 leading-none">{stats.finalized}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-ink-200 shadow-sm">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                    <Calendar size={14} />
                  </div>
                  <span className="text-[9px] font-black text-ink-400 uppercase tracking-widest">Pendentes</span>
                </div>
                <p className="text-2xl font-black text-amber-600 leading-none">{stats.pending}</p>
              </div>
            </div>

            {/* Integrations */}
            <div className="bg-white rounded-2xl border border-ink-200 shadow-sm p-5 space-y-5">
              <h3 className="text-xs font-black text-ink-900 uppercase tracking-widest flex items-center gap-2">
                <Globe size={14} className="text-emerald-500" /> Integrações Ativas
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={classNames(
                  "p-4 rounded-xl border flex flex-col gap-3",
                  clinic.googleDocsTemplateId ? "bg-emerald-50/20 border-emerald-100" : "bg-ink-50 border-ink-200 grayscale opacity-60"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-white border border-emerald-150 flex items-center justify-center text-emerald-600 shadow-sm">
                      <FileText size={18} />
                    </div>
                    {clinic.googleDocsTemplateId && (
                      <a 
                        href={`https://docs.google.com/document/d/${clinic.googleDocsTemplateId}/edit`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-white border border-emerald-250 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-ink-900 text-sm">Google Docs Template</h4>
                    <p className="text-[11px] text-ink-500 leading-relaxed mt-0.5">
                      {clinic.googleDocsTemplateId ? "Documento base de laudos configurado." : "Template não vinculado."}
                    </p>
                  </div>
                </div>

                <div className={classNames(
                  "p-4 rounded-xl border flex flex-col gap-3",
                  clinic.googleDriveFolderId ? "bg-indigo-50/20 border-indigo-100" : "bg-ink-50 border-ink-200 grayscale opacity-60"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-white border border-indigo-150 flex items-center justify-center text-indigo-600 shadow-sm">
                      <Globe size={18} />
                    </div>
                    {clinic.googleDriveFolderId && (
                      <a 
                        href={`https://drive.google.com/drive/folders/${clinic.googleDriveFolderId}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-white border border-indigo-250 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-ink-900 text-sm">Google Drive Storage</h4>
                    <p className="text-[11px] text-ink-500 leading-relaxed mt-0.5">
                      {clinic.googleDriveFolderId ? "Pasta de destino de PDFs configurada." : "Pasta de Drive não vinculada."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Banners */}
            {(clinic.headerImageUrl || clinic.footerImageUrl) && (
              <div className="bg-white rounded-2xl border border-ink-200 shadow-sm p-5 space-y-4">
                <h3 className="text-xs font-black text-ink-900 uppercase tracking-widest">Banners de Impressão (PDF)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {clinic.headerImageUrl && (
                    <div className="p-3 bg-ink-50 rounded-xl border border-ink-150 flex flex-col gap-2">
                      <span className="text-[9px] font-black text-ink-400 uppercase tracking-widest">Cabeçalho</span>
                      <div className="h-16 w-full bg-white rounded-lg border border-ink-200 flex items-center justify-center overflow-hidden">
                        <img src={clinic.headerImageUrl} alt="Cabeçalho" className="max-h-full max-w-full object-contain" />
                      </div>
                    </div>
                  )}
                  {clinic.footerImageUrl && (
                    <div className="p-3 bg-ink-50 rounded-xl border border-ink-150 flex flex-col gap-2">
                      <span className="text-[9px] font-black text-ink-400 uppercase tracking-widest">Rodapé</span>
                      <div className="h-16 w-full bg-white rounded-lg border border-ink-200 flex items-center justify-center overflow-hidden">
                        <img src={clinic.footerImageUrl} alt="Rodapé" className="max-h-full max-w-full object-contain" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isReception && (
              <>
                <ClinicTeamCard clinicId={clinicId} />

                <ReceptionAccessCard clinicId={clinicId} />
              </>
            )}

            {/* Address & Info */}
            <div className="bg-white rounded-2xl border border-ink-200 shadow-sm p-5 space-y-4">
              <h3 className="text-xs font-black text-ink-900 uppercase tracking-widest">Localização da Unidade</h3>
              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-ink-50 border border-ink-150">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-brand-600 shadow-sm border border-brand-100 shrink-0">
                  <MapPin size={16} />
                </div>
                <div>
                  <p className="font-bold text-ink-900 text-sm">
                    {clinic.address?.street}, {clinic.address?.number}
                  </p>
                  <p className="text-xs text-ink-500 mt-0.5">
                    {clinic.address?.neighborhood} · {clinic.address?.city}/{clinic.address?.state}
                  </p>
                  <p className="text-[10px] text-ink-400 mt-1 font-mono">CEP: {clinic.address?.zipCode}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ConfirmDialog
          open={showDeleteConfirm}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          title="Excluir Unidade"
          message={`Tem certeza que deseja excluir a unidade "${clinic.name}"? Esta ação não pode ser desfeita.`}
        />
      </div>
    </div>
  );
}
