import { useApp } from '../../store/app';
import { useDocument, useCollection } from '../../hooks/useFirestore';
import { updateItem } from '../../store/db';
import { PageHeader } from '../../components/PageHeader';
import { Patient, ExamRequest, EXAM_AREAS, Clinic } from '../../types';
import { ArrowLeft, User, Phone, Mail, MapPin, Calendar, FileText, Edit, ShieldPlus, Loader2, Building2 } from 'lucide-react';
import { calculateAge, formatDate, formatDateTime } from '../../utils/format';
import { useState, useMemo } from 'react';
import { Modal } from '../../components/Modal';
import { PatientForm } from './PatientForm';
import { where, orderBy } from 'firebase/firestore';

interface Props {
  patientId: string;
}

export function PatientDetail({ patientId }: Props) {
  const { setView, showToast, selectedClinicId } = useApp();
  const [editing, setEditing] = useState(false);

  const { data: patient, loading: patientLoading } = useDocument<Patient>('patients', patientId);
  const { data: exams, loading: examsLoading } = useCollection<ExamRequest>('exams', {
    constraints: [where('patientId', '==', patientId)],
  });
  const { data: clinics } = useCollection<Clinic>('clinics');

  const clinicMap = useMemo(() => new Map(clinics.map((c) => [c.id, c])), [clinics]);

  const sortedExams = useMemo(() => {
    return [...exams].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [exams]);

  // Apply clinic filter if selected
  const filteredExams = useMemo(() => {
    if (!selectedClinicId) return sortedExams;
    return sortedExams.filter(e => e.clinicId === selectedClinicId);
  }, [sortedExams, selectedClinicId]);

  if (patientLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-brand-500" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center py-12 text-ink-500">
        Paciente não encontrado.
        <div className="mt-3">
          <button onClick={() => setView({ name: 'patients' })} className="btn-secondary">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  async function handleUpdate(data: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!patient) return;
    await updateItem('patients', patient.id, data);
    setEditing(false);
    showToast('Paciente atualizado', 'success');
  }

  const fullAddress = [
    patient.address?.street,
    patient.address?.number,
    patient.address?.neighborhood,
    patient.address?.city && patient.address?.state
      ? `${patient.address.city}/${patient.address.state}`
      : '',
  ].filter(Boolean).join(', ');

  return (
    <div>
      <button
        onClick={() => setView({ name: 'patients' })}
        className="text-sm text-ink-500 hover:text-ink-800 flex items-center gap-1 mb-3"
      >
        <ArrowLeft size={14} /> Voltar
      </button>

      <PageHeader
        title={patient.name}
        subtitle={`${calculateAge(patient.birthDate)} — CPF: ${patient.cpf || 'Não informado'}`}
        actions={
          <>
            <button className="btn-secondary" onClick={() => setEditing(true)}>
              <Edit size={15} /> Editar Dados
            </button>
            <button className="btn-primary" onClick={() => setView({ name: 'new-exam' })}>
              <FileText size={15} /> Novo Exame
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="card p-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500 flex items-center gap-2">
            <User size={14} /> Informações Pessoais
          </h3>
          <div className="space-y-3 text-sm">
            {patient.birthDate && (
              <div className="flex justify-between border-b border-ink-50 pb-2">
                <span className="text-ink-500">Nascimento</span>
                <span className="font-medium text-ink-900">{formatDate(patient.birthDate)}</span>
              </div>
            )}
            {patient.gender && (
              <div className="flex justify-between border-b border-ink-50 pb-2">
                <span className="text-ink-500">Gênero</span>
                <span className="font-medium text-ink-900">
                  {patient.gender === 'M' ? 'Masculino' : patient.gender === 'F' ? 'Feminino' : 'Outro'}
                </span>
              </div>
            )}
            {patient.rg && (
              <div className="flex justify-between border-b border-ink-50 pb-2">
                <span className="text-ink-500">RG</span>
                <span className="font-medium text-ink-900">{patient.rg}</span>
              </div>
            )}
            <div className="flex justify-between pt-1">
              <span className="text-ink-500">Cadastro</span>
              <span className="text-ink-700">{formatDate(patient.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500 flex items-center gap-2">
            <Phone size={14} /> Contato & Endereço
          </h3>
          <div className="space-y-3 text-sm">
            {patient.phone && (
              <div className="flex items-center gap-2 text-ink-700">
                <Phone size={14} className="text-ink-400 shrink-0" />
                {patient.phone}
              </div>
            )}
            {patient.email && (
              <div className="flex items-center gap-2 text-ink-700">
                <Mail size={14} className="text-ink-400 shrink-0" />
                {patient.email}
              </div>
            )}
            {fullAddress ? (
              <div className="flex items-start gap-2 text-ink-700 pt-1">
                <MapPin size={14} className="text-ink-400 mt-0.5 shrink-0" />
                <span>{fullAddress}</span>
              </div>
            ) : (
              <div className="text-ink-400 italic text-xs">Endereço não informado</div>
            )}
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500 flex items-center gap-2">
            <ShieldPlus size={14} /> Dados Clínicos
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-ink-50 pb-2">
              <span className="text-ink-500">Convênio</span>
              <span className="font-medium text-ink-900">{patient.insurance || 'Particular'}</span>
            </div>
            {patient.insuranceNumber && (
              <div className="flex justify-between border-b border-ink-50 pb-2">
                <span className="text-ink-500">Carteirinha</span>
                <span className="font-medium text-ink-900 font-mono text-xs mt-0.5">{patient.insuranceNumber}</span>
              </div>
            )}
            {patient.history && (
              <div className="pt-1">
                <span className="text-ink-500 block mb-1">Histórico:</span>
                <p className="text-ink-700 text-xs leading-relaxed">{patient.history}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-100 flex items-center gap-2 bg-ink-50/50">
          <Calendar size={15} className="text-ink-500" />
          <h3 className="text-sm font-semibold text-ink-900">Histórico de Exames</h3>
          <span className="text-xs font-medium text-ink-500 bg-ink-100 px-2 py-0.5 rounded-full ml-1">
            {filteredExams.length}
          </span>
          {selectedClinicId && (
            <span className="ml-2 text-[10px] text-brand-600 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-full">
              Filtrando clínica atual
            </span>
          )}
        </div>

        {examsLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-ink-300" /></div>
        ) : filteredExams.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={24} className="mx-auto text-ink-300 mb-2" />
            <p className="text-sm text-ink-500">Nenhum exame encontrado para este paciente.</p>
          </div>
        ) : (
          <div className="divide-y divide-ink-50">
            {filteredExams.map((exam) => {
              const area = EXAM_AREAS.find((a) => a.id === exam.area);
              const clinic = exam.clinicId ? clinicMap.get(exam.clinicId) : null;
              return (
                <div
                  key={exam.id}
                  onClick={() => setView({ name: 'exam-editor', examId: exam.id })}
                  className="p-4 hover:bg-ink-50/50 cursor-pointer flex items-center justify-between group transition-colors"
                >
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h4 className="font-medium text-ink-900 text-sm group-hover:text-brand-600 transition-colors">
                        {exam.examType}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-ink-500">
                        <span>{formatDateTime(exam.createdAt)}</span>
                        <span>·</span>
                        <span className="capitalize">{exam.status}</span>
                        {clinic && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1 text-ink-600">
                              <Building2 size={10} /> {clinic.name}
                            </span>
                          </>
                        )}
                        {exam.requestingPhysician && (
                          <>
                            <span>·</span>
                            <span>Solic: {exam.requestingPhysician}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {area && (
                      <span className={`chip ${area.color} hidden md:inline-flex`}>
                        {area.label}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Editar Paciente" size="lg">
        <PatientForm
          initial={patient}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    </div>
  );
}
