import { useApp } from '../../store/app';
import { useDocument, useCollection } from '../../hooks/useFirestore';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Clinic, ExamRequest, ReportTemplate, EXAM_AREAS } from '../../types';
import { deleteItem } from '../../store/db';
import { where } from 'firebase/firestore';
import { useState } from 'react';
import {
  ArrowLeft, Edit, Building2, MapPin, Phone, Mail, FileText,
  Trash2, ExternalLink, Loader2
} from 'lucide-react';
import { formatDateTime, classNames } from '../../utils/format';

interface Props {
  clinicId: string;
}

export function ClinicDetail({ clinicId }: Props) {
  const { setView, showToast, selectedClinicId, setSelectedClinic } = useApp();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: clinic, loading: clinicLoading } = useDocument<Clinic>('clinics', clinicId);

  const { data: exams } = useCollection<ExamRequest>('exams', {
    constraints: [where('clinicId', '==', clinicId)],
  });

  const { data: templates } = useCollection<ReportTemplate>('templates', {
    constraints: [where('clinicId', '==', clinicId)],
  });

  if (clinicLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-brand-500" />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="text-center py-12 text-ink-500">
        Clínica não encontrada.
        <div className="mt-3">
          <button onClick={() => setView({ name: 'clinics' })} className="btn-secondary">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const fullAddress = [
    clinic.address?.street,
    clinic.address?.number,
    clinic.address?.neighborhood,
    clinic.address?.city && clinic.address?.state
      ? `${clinic.address.city}/${clinic.address.state}`
      : '',
  ]
    .filter(Boolean)
    .join(', ');

  const isSelected = selectedClinicId === clinicId;

  const statusCounts = {
    pendente: exams.filter((e) => e.status === 'pendente').length,
    'em-andamento': exams.filter((e) => e.status === 'em-andamento').length,
    finalizado: exams.filter((e) => e.status === 'finalizado').length,
  };

  async function handleDelete() {
    setShowDeleteConfirm(false);
    if (exams.length > 0) {
      showToast(`Clínica tem ${exams.length} exame(s) vinculado(s). Desvincule antes.`, 'error');
      return;
    }
    try {
      await deleteItem('clinics', clinicId);
      if (selectedClinicId === clinicId) setSelectedClinic(null);
      showToast('Clínica excluída', 'success');
      setView({ name: 'clinics' });
    } catch {
      showToast('Erro ao excluir clínica', 'error');
    }
  }

  return (
    <div>
      <button
        onClick={() => setView({ name: 'clinics' })}
        className="text-sm text-ink-500 hover:text-ink-800 flex items-center gap-1 mb-3"
      >
        <ArrowLeft size={14} /> Voltar
      </button>

      <PageHeader
        title={clinic.name}
        subtitle={clinic.cnpj || 'Sem CNPJ'}
        actions={
          <>
            <button
              onClick={() => {
                setSelectedClinic(isSelected ? null : clinicId);
                showToast(
                  isSelected ? 'Filtro removido' : `Filtrando por: ${clinic.name}`,
                  'info'
                );
              }}
              className={classNames(
                'btn text-sm',
                isSelected ? 'bg-brand-600 text-white hover:bg-brand-700' : 'btn-secondary'
              )}
            >
              {isSelected ? '✓ Selecionada' : 'Selecionar para filtro'}
            </button>
            <button
              className="btn-secondary"
              onClick={() => setView({ name: 'clinic-form', clinicId })}
            >
              <Edit size={15} /> Editar
            </button>
          </>
        }
      />

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-ink-900">{exams.length}</div>
          <div className="text-xs text-ink-500 mt-0.5">Exames Total</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-amber-600">{statusCounts.pendente}</div>
          <div className="text-xs text-ink-500 mt-0.5">Pendentes</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-brand-600">{statusCounts['em-andamento']}</div>
          <div className="text-xs text-ink-500 mt-0.5">Em Andamento</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-emerald-600">{statusCounts.finalizado}</div>
          <div className="text-xs text-ink-500 mt-0.5">Finalizados</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Info card */}
        <div className="card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-3">
            Informações
          </h3>
          <div className="space-y-2 text-sm">
            {fullAddress && (
              <div className="flex items-start gap-2 text-ink-700">
                <MapPin size={13} className="text-ink-400 mt-0.5 shrink-0" />
                <span>{fullAddress}</span>
              </div>
            )}
            {clinic.phone && (
              <div className="flex items-center gap-2 text-ink-700">
                <Phone size={13} className="text-ink-400" />
                {clinic.phone}
              </div>
            )}
            {clinic.email && (
              <div className="flex items-center gap-2 text-ink-700">
                <Mail size={13} className="text-ink-400" />
                {clinic.email}
              </div>
            )}
          </div>
        </div>

        {/* Logo card */}
        <div className="card p-4 flex items-center justify-center">
          {clinic.logoUrl ? (
            <img
              src={clinic.logoUrl}
              alt={clinic.name}
              className="max-h-24 object-contain"
            />
          ) : (
            <div className="text-center text-ink-400">
              <Building2 size={32} className="mx-auto mb-1 opacity-30" />
              <span className="text-xs">Sem logo</span>
            </div>
          )}
        </div>

        {/* Google Integration */}
        <div className="card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-3">
            Google Integration
          </h3>
          <div className="space-y-2 text-sm">
            {clinic.googleDocsTemplateId ? (
              <a
                href={`https://docs.google.com/document/d/${clinic.googleDocsTemplateId}/edit`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-brand-600 hover:underline text-xs"
              >
                <FileText size={13} /> Template Google Docs <ExternalLink size={10} />
              </a>
            ) : (
              <span className="text-xs text-ink-400">Sem template vinculado</span>
            )}
            {clinic.googleDriveFolderId ? (
              <a
                href={`https://drive.google.com/drive/folders/${clinic.googleDriveFolderId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-brand-600 hover:underline text-xs"
              >
                <FileText size={13} /> Pasta no Drive <ExternalLink size={10} />
              </a>
            ) : (
              <span className="text-xs text-ink-400">Sem pasta vinculada</span>
            )}
          </div>
        </div>
      </div>

      {/* Templates vinculados */}
      <div className="card overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-ink-100 flex items-center gap-2">
          <FileText size={15} className="text-ink-500" />
          <h3 className="text-sm font-semibold text-ink-800">Máscaras desta Clínica</h3>
          <span className="text-xs text-ink-500">({templates.length})</span>
        </div>
        {templates.length === 0 ? (
          <div className="text-center py-8 text-sm text-ink-400">
            Nenhuma máscara vinculada a esta clínica.
          </div>
        ) : (
          <div className="divide-y divide-ink-50">
            {templates.map((t) => {
              const area = EXAM_AREAS.find((a) => a.id === t.area);
              return (
                <button
                  key={t.id}
                  onClick={() => setView({ name: 'template-editor', templateId: t.id })}
                  className="w-full text-left px-4 py-3 hover:bg-ink-50/40 flex items-center gap-3"
                >
                  <div className={`chip ${area?.color}`}>{area?.label}</div>
                  <span className="text-sm font-medium text-ink-900">{t.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Últimos exames */}
      <div className="card overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-ink-100 flex items-center gap-2">
          <FileText size={15} className="text-ink-500" />
          <h3 className="text-sm font-semibold text-ink-800">Últimos Exames</h3>
          <span className="text-xs text-ink-500">({exams.length})</span>
        </div>
        {exams.length === 0 ? (
          <div className="text-center py-8 text-sm text-ink-400">
            Nenhum exame nesta clínica.
          </div>
        ) : (
          <div className="divide-y divide-ink-50">
            {exams.slice(0, 10).map((e) => {
              const area = EXAM_AREAS.find((a) => a.id === e.area);
              return (
                <button
                  key={e.id}
                  onClick={() => setView({ name: 'exam-editor', examId: e.id })}
                  className="w-full text-left px-4 py-3 hover:bg-ink-50/40 flex items-center gap-3"
                >
                  {area && <div className={`chip ${area.color}`}>{area.label}</div>}
                  <div className="flex-1">
                    <div className="text-sm font-medium text-ink-900">{e.examType}</div>
                    <div className="text-xs text-ink-500">{formatDateTime(e.updatedAt)}</div>
                  </div>
                  <span className="text-xs text-ink-500">{e.status}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-red-700">Zona de Perigo</h3>
            <p className="text-xs text-ink-500 mt-1">
              Remover esta clínica não afeta exames ou templates já existentes.
            </p>
          </div>
          <button onClick={() => setShowDeleteConfirm(true)} className="btn-danger text-xs">
            <Trash2 size={13} /> Excluir Clínica
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Excluir clínica"
        message={
          exams.length > 0
            ? `Esta clínica tem ${exams.length} exame(s) vinculado(s). Desvincule ou exclua os exames antes.`
            : `Tem certeza que deseja excluir "${clinic.name}"? Esta ação não pode ser desfeita.`
        }
        confirmLabel={exams.length > 0 ? 'Entendido' : 'Excluir'}
        variant={exams.length > 0 ? 'warning' : 'danger'}
      />
    </div>
  );
}
