import { useApp } from '../../store/app';
import { useDocument, useCollection } from '../../hooks/useFirestore';
import { updateItem } from '../../store/db';
import { PageHeader } from '../../components/PageHeader';
import { Patient, ExamRequest, EXAM_AREAS, Clinic } from '../../types';
import { ArrowLeft, User, Phone, Mail, MapPin, Calendar, FileText, Edit, ShieldPlus, Loader2, Building2, Plus, UserCircle, ClipboardList } from 'lucide-react';
import { calculateAge, formatDate, formatDateTime, formatCPF, formatPhone } from '../../utils/format';
import { useState, useMemo } from 'react';
import { Modal } from '../../components/Modal';
import { PatientForm } from './PatientForm';
import { where, orderBy } from 'firebase/firestore';

interface Props {
  patientId: string;
}

export function PatientDetail({ patientId }: Props) {
  const { setView, showToast, selectedClinicId, setShowCreateExamModal, setCreateExamDefaultPatient } = useApp();
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
    <div className="module-container">
      <div className="max-w-6xl mx-auto w-full animate-fade-in space-y-6">
      <button
        onClick={() => setView({ name: 'patients' })}
        className="text-[10px] font-black uppercase tracking-widest text-ink-400 hover:text-ink-900 flex items-center gap-2 transition-colors mb-2"
      >
        <ArrowLeft size={14} /> Voltar para Lista
      </button>

      <PageHeader
        title={patient.name}
        subtitle={`${calculateAge(patient.birthDate)} — CPF: ${patient.cpf ? formatCPF(patient.cpf) : 'Não informado'}`}
        actions={
          <div className="flex gap-3">
            <button className="btn-secondary h-11 px-5 rounded-2xl" onClick={() => setEditing(true)}>
              <Edit size={16} /> <span className="font-bold text-xs uppercase tracking-widest">Editar Dados</span>
            </button>
            <button className="btn-primary h-11 px-6 rounded-2xl shadow-brand" onClick={() => {
              setCreateExamDefaultPatient(patient);
              setShowCreateExamModal(true);
            }}>
              <Plus size={16} /> <span className="font-bold text-xs uppercase tracking-widest">Novo Laudo</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-ink-100 shadow-sm space-y-5">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-ink-400 flex items-center gap-2 mb-2">
            <UserCircle size={16} className="text-brand-500" /> Informações Pessoais
          </h3>
          <div className="space-y-4 text-sm">
            {patient.birthDate && (
              <div className="flex justify-between items-center border-b border-ink-50 pb-3">
                <span className="text-ink-500 font-medium">Nascimento</span>
                <span className="font-black text-ink-900">{formatDate(patient.birthDate)}</span>
              </div>
            )}
            {patient.gender && (
              <div className="flex justify-between items-center border-b border-ink-50 pb-3">
                <span className="text-ink-500 font-medium">Gênero</span>
                <span className="font-black text-ink-900">
                  {patient.gender === 'M' ? 'Masculino' : patient.gender === 'F' ? 'Feminino' : 'Outro'}
                </span>
              </div>
            )}
            {patient.rg && (
              <div className="flex justify-between items-center border-b border-ink-50 pb-3">
                <span className="text-ink-500 font-medium">RG</span>
                <span className="font-black text-ink-900">{patient.rg}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1">
              <span className="text-ink-500 font-medium text-xs">Registrado em</span>
              <span className="text-ink-400 font-bold text-xs">{formatDate(patient.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-ink-100 shadow-sm space-y-5">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-ink-400 flex items-center gap-2 mb-2">
            <Phone size={16} className="text-brand-500" /> Contato & Endereço
          </h3>
          <div className="space-y-4 text-sm">
            {patient.phone && (
              <div className="flex items-center gap-3 p-3 bg-brand-50 rounded-2xl border border-brand-100">
                <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-brand-600 shadow-sm">
                  <Phone size={14} />
                </div>
                <span className="font-black text-ink-900 tracking-tight">{formatPhone(patient.phone)}</span>
              </div>
            )}
            {patient.email && (
              <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm">
                  <Mail size={14} />
                </div>
                <span className="font-bold text-ink-900 text-xs truncate">{patient.email}</span>
              </div>
            )}
            {fullAddress ? (
              <div className="flex items-start gap-3 pt-2">
                <MapPin size={16} className="text-brand-400 mt-0.5 shrink-0" />
                <span className="text-xs text-ink-600 leading-relaxed font-medium">{fullAddress}</span>
              </div>
            ) : (
              <div className="text-ink-400 font-medium italic text-xs pt-2">Endereço não informado</div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-ink-100 shadow-sm space-y-5">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-ink-400 flex items-center gap-2 mb-2">
            <ShieldPlus size={16} className="text-brand-500" /> Dados Clínicos
          </h3>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center border-b border-ink-50 pb-3">
              <span className="text-ink-500 font-medium">Convênio</span>
              <span className="font-black text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-100 text-[10px] uppercase tracking-widest">
                {patient.insurance || 'Particular'}
              </span>
            </div>
            {patient.insuranceNumber && (
              <div className="flex justify-between items-center border-b border-ink-50 pb-3">
                <span className="text-ink-500 font-medium">Carteirinha</span>
                <span className="font-black text-ink-900 font-mono text-[11px] mt-0.5 tracking-tighter">{patient.insuranceNumber}</span>
              </div>
            )}
            {patient.history && (
              <div className="pt-1">
                <span className="text-ink-500 font-medium block mb-2">Histórico Clínico:</span>
                <div className="p-4 bg-ink-50 rounded-2xl border border-ink-100 text-xs text-ink-700 leading-relaxed whitespace-pre-wrap font-medium">
                  {patient.history}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-ink-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-ink-100 flex items-center justify-between bg-ink-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-100">
              <ClipboardList size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-ink-900 uppercase tracking-widest leading-none">Histórico de Exames</h3>
              <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter mt-1">Registros totais do paciente</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-ink-500 bg-ink-100 px-3 py-1.5 rounded-xl uppercase tracking-widest">
              {filteredExams.length} Total
            </span>
            {selectedClinicId && (
              <span className="text-[9px] font-black text-brand-600 bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-xl uppercase tracking-widest">
                Unidade Atual
              </span>
            )}
          </div>
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
                        {exam.status === 'finalizado' ? (
                          <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 rounded text-[10px] uppercase font-bold tracking-wider">Finalizado</span>
                        ) : exam.status === 'em-andamento' ? (
                          <span className="bg-amber-50 text-amber-600 border border-amber-200 px-1.5 rounded text-[10px] uppercase font-bold tracking-wider">Em Andamento</span>
                        ) : (
                          <span className="bg-ink-100 text-ink-600 border border-ink-200 px-1.5 rounded text-[10px] uppercase font-bold tracking-wider">Pendente</span>
                        )}
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
    </div>
  );
}
