import { useApp } from '../../store/app';
import { useDocument, useCollection } from '../../hooks/useFirestore';
import { deleteItem } from '../../store/db';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Clinic, ExamRequest } from '../../types';
import { 
  Building2, MapPin, Phone, Mail, 
  Settings2, Trash2, ArrowLeft, Globe, 
  FileText, ExternalLink, Activity,
  CheckCircle2, AlertCircle, Calendar
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { classNames, formatCNPJ, formatPhone } from '../../utils/format';

interface Props {
  clinicId: string;
}

export function ClinicDetail({ clinicId }: Props) {
  const { setView, showToast } = useApp();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
      <div className="max-w-7xl mx-auto w-full animate-fade-in space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setView({ name: 'clinics' })}
          className="p-2.5 rounded-2xl bg-white border border-ink-100 text-ink-500 hover:text-brand-600 hover:border-brand-100 transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-black text-ink-900 leading-tight">Visão Geral da Unidade</h2>
          <p className="text-sm text-ink-500">Métricas e configurações da unidade {clinic.name}.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl border border-ink-100 shadow-sm overflow-hidden p-8 text-center">
             <div className="w-32 h-32 rounded-3xl bg-ink-50 border border-ink-100 mx-auto mb-6 flex items-center justify-center overflow-hidden">
                {clinic.logoUrl ? (
                  <img src={clinic.logoUrl} alt={clinic.name} className="w-full h-full object-cover" />
                ) : (
                  <Building2 size={48} className="text-ink-300" />
                )}
             </div>
             <h3 className="font-black text-ink-900 text-xl leading-tight mb-2">{clinic.name}</h3>
             <span className={classNames(
                "inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border mb-6",
                clinic.active ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-ink-50 text-ink-500 border-ink-200"
             )}>
               {clinic.active ? 'Unidade Ativa' : 'Unidade Inativa'}
             </span>

             <div className="space-y-3 pt-6 border-t border-ink-50">
                <button
                  onClick={() => setView({ name: 'clinic-form', clinicId })}
                  className="w-full py-3 rounded-2xl bg-brand-50 text-brand-600 border border-brand-100 font-bold text-sm hover:bg-brand-600 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <Settings2 size={16} /> Editar Unidade
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-3 rounded-2xl bg-white text-red-500 border border-red-100 font-bold text-sm hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} /> Excluir Registro
                </button>
             </div>
          </div>
          
          <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8 space-y-6">
             <h4 className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-2">Dados de Contato</h4>
             <div className="space-y-4">
                {clinic.cnpj && (
                  <div className="flex items-center gap-3 text-sm text-ink-600">
                    <FileText size={16} className="text-ink-400 shrink-0" />
                    <span className="font-mono">{formatCNPJ(clinic.cnpj)}</span>
                  </div>
                )}
                {clinic.phone && (
                  <div className="flex items-center gap-3 text-sm text-ink-600">
                    <Phone size={16} className="text-ink-400 shrink-0" />
                    {formatPhone(clinic.phone)}
                  </div>
                )}
                {clinic.email && (
                  <div className="flex items-center gap-3 text-sm text-ink-600">
                    <Mail size={16} className="text-ink-400 shrink-0" />
                    <span className="truncate">{clinic.email}</span>
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* Stats & Integrations */}
        <div className="lg:col-span-3 space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-ink-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Activity size={20} />
                </div>
                <span className="text-xs font-black text-ink-400 uppercase tracking-widest">Total de Exames</span>
              </div>
              <p className="text-3xl font-black text-ink-900">{stats.total}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-ink-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 size={20} />
                </div>
                <span className="text-xs font-black text-ink-400 uppercase tracking-widest">Finalizados</span>
              </div>
              <p className="text-3xl font-black text-emerald-600">{stats.finalized}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-ink-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Calendar size={20} />
                </div>
                <span className="text-xs font-black text-ink-400 uppercase tracking-widest">Pendentes</span>
              </div>
              <p className="text-3xl font-black text-amber-600">{stats.pending}</p>
            </div>
          </div>

          {/* Integrations */}
          <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8">
            <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest mb-8 flex items-center gap-2">
              <Globe size={16} className="text-emerald-500" /> Integrações Ativas
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className={classNames(
                "p-6 rounded-3xl border flex flex-col gap-4",
                clinic.googleDocsTemplateId ? "bg-emerald-50/30 border-emerald-100" : "bg-ink-50 border-ink-100 grayscale opacity-60"
              )}>
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-emerald-100 flex items-center justify-center text-emerald-600">
                    <FileText size={24} />
                  </div>
                  {clinic.googleDocsTemplateId && (
                    <a 
                      href={`https://docs.google.com/document/d/${clinic.googleDocsTemplateId}/edit`} 
                      target="_blank" 
                      className="p-2 rounded-xl bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-ink-900">Google Docs Template</h4>
                  <p className="text-xs text-ink-500 leading-relaxed">
                    {clinic.googleDocsTemplateId ? "Documento base para geração automática de laudos configurado." : "Template do Google Docs não vinculado."}
                  </p>
                </div>
              </div>

              <div className={classNames(
                "p-6 rounded-3xl border flex flex-col gap-4",
                clinic.googleDriveFolderId ? "bg-indigo-50/30 border-indigo-100" : "bg-ink-50 border-ink-100 grayscale opacity-60"
              )}>
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <Globe size={24} />
                  </div>
                  {clinic.googleDriveFolderId && (
                    <a 
                      href={`https://drive.google.com/drive/folders/${clinic.googleDriveFolderId}`} 
                      target="_blank" 
                      className="p-2 rounded-xl bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-ink-900">Google Drive Storage</h4>
                  <p className="text-xs text-ink-500 leading-relaxed">
                    {clinic.googleDriveFolderId ? "Pasta de destino para armazenamento de PDFs configurada." : "Pasta do Google Drive não vinculada."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Address & Info */}
          <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8">
            <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest mb-6">Localização da Unidade</h3>
            <div className="flex items-start gap-4 p-6 rounded-2xl bg-ink-50 border border-ink-100">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-brand-600 shadow-sm">
                <MapPin size={20} />
              </div>
              <div>
                <p className="font-bold text-ink-900">
                  {clinic.address?.street}, {clinic.address?.number}
                </p>
                <p className="text-sm text-ink-500">
                  {clinic.address?.neighborhood} - {clinic.address?.city}/{clinic.address?.state}
                </p>
                <p className="text-xs text-ink-400 mt-1">CEP: {clinic.address?.zipCode}</p>
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
