import { useApp } from '../../store/app';
import { useDocument, useCollection } from '../../hooks/useFirestore';
import { updateItem } from '../../store/db';
import { PageHeader } from '../../components/PageHeader';
import { Patient, ExamRequest, EXAM_AREAS, Clinic } from '../../types';
import { ArrowLeft, Phone, Mail, MapPin, FileText, Edit, ShieldPlus, Loader2, Building2, Plus, UserCircle, ClipboardList, ShieldCheck, Settings } from 'lucide-react';
import { calculateAge, formatDate, formatDateTime, formatCPF, formatPhone } from '../../utils/format';
import { useState, useMemo } from 'react';
import { Modal } from '../../components/Modal';
import { PatientForm } from './PatientForm';
import { where } from 'firebase/firestore';
import { AnamnesisConsentModal } from '../editor/components/AnamnesisConsentModal';

interface Props {
  patientId: string;
}

export function PatientDetail({ patientId }: Props) {
  const { setView, showToast, selectedClinicId, setShowCreateExamModal, setCreateExamDefaultPatient } = useApp();
  const [editing, setEditing] = useState(false);
  const [selectedExamForModal, setSelectedExamForModal] = useState<ExamRequest | null>(null);
  const [modalTab, setModalTab] = useState<'metadata' | 'patient' | 'consent'>('metadata');

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
      <div className="max-w-7xl mx-auto w-full animate-fade-in space-y-5">
        
        {/* ─── COMPACT HEADER ─── */}
        <div className="bg-white border border-ink-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setView({ name: 'patients' })}
                className="w-8 h-8 rounded-xl border border-ink-200 hover:bg-ink-50 text-ink-500 hover:text-ink-700 flex items-center justify-center transition-all shrink-0 active:scale-95"
                title="Voltar"
              >
                <ArrowLeft size={14} />
              </button>
              <div className="min-w-0">
                <h1 className="text-base font-black text-ink-900 tracking-tight leading-none truncate max-w-[200px] sm:max-w-md">{patient.name}</h1>
                <p className="text-[11px] text-ink-500 font-medium mt-0.5">
                  Prontuário: {patient.id} · {calculateAge(patient.birthDate)} · CPF: {patient.cpf ? formatCPF(patient.cpf) : 'Não informado'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setEditing(true)}
                className="h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-ink-500 hover:text-ink-700 bg-ink-100 border border-ink-200 hover:bg-ink-200 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Edit size={11} />
                <span className="hidden sm:inline">Editar Dados</span>
                <span className="sm:hidden">Editar</span>
              </button>
              <button
                onClick={() => {
                  setCreateExamDefaultPatient(patient);
                  setShowCreateExamModal(true);
                }}
                className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Plus size={11} />
                Novo Laudo
              </button>
            </div>
          </div>
        </div>

        {/* ─── INFO GRIDS ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-ink-100 shadow-sm space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-ink-400 flex items-center gap-2 mb-2">
              <UserCircle size={15} className="text-brand-500" /> Informações Pessoais
            </h3>
            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between items-center border-b border-ink-50 pb-2.5">
                <span className="text-ink-500 font-medium">Nº Prontuário</span>
                <span className="font-mono font-black text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-lg border border-brand-100 text-[11px]">{patient.id}</span>
              </div>
              {patient.birthDate && (
                <div className="flex justify-between items-center border-b border-ink-50 pb-2.5">
                  <span className="text-ink-500 font-medium">Nascimento</span>
                  <span className="font-black text-ink-900">{formatDate(patient.birthDate)}</span>
                </div>
              )}
              {patient.gender && (
                <div className="flex justify-between items-center border-b border-ink-50 pb-2.5">
                  <span className="text-ink-500 font-medium">Gênero</span>
                  <span className="font-black text-ink-900">
                    {patient.gender === 'M' ? 'Masculino' : patient.gender === 'F' ? 'Feminino' : 'Outro'}
                  </span>
                </div>
              )}
              {patient.rg && (
                <div className="flex justify-between items-center border-b border-ink-50 pb-2.5">
                  <span className="text-ink-500 font-medium">RG</span>
                  <span className="font-black text-ink-900">{patient.rg}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1">
                <span className="text-ink-400 font-bold text-xs">Registrado em</span>
                <span className="text-ink-400 font-bold text-xs">{formatDate(patient.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-ink-100 shadow-sm space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-ink-400 flex items-center gap-2 mb-2">
              <Phone size={15} className="text-brand-500" /> Contato & Endereço
            </h3>
            <div className="space-y-3.5 text-sm">
              {patient.phone && (
                <div className="flex items-center gap-3 p-2.5 bg-brand-50 rounded-xl border border-brand-100">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-brand-600 shadow-sm border border-brand-100">
                    <Phone size={13} />
                  </div>
                  <span className="font-black text-ink-900 tracking-tight text-sm">{formatPhone(patient.phone)}</span>
                </div>
              )}
              {patient.email && (
                <div className="flex items-center gap-3 p-2.5 bg-indigo-50 rounded-xl border border-indigo-100">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                    <Mail size={13} />
                  </div>
                  <span className="font-bold text-ink-900 text-xs truncate block max-w-full">{patient.email}</span>
                </div>
              )}
              {fullAddress ? (
                <div className="flex items-start gap-2.5 pt-1">
                  <MapPin size={15} className="text-brand-400 mt-0.5 shrink-0" />
                  <span className="text-xs text-ink-600 leading-relaxed font-medium">{fullAddress}</span>
                </div>
              ) : (
                <div className="text-ink-400 font-medium italic text-xs pt-1">Endereço não informado</div>
              )}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-ink-100 shadow-sm space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-ink-400 flex items-center gap-2 mb-2">
              <ShieldPlus size={15} className="text-brand-500" /> Dados Clínicos
            </h3>
            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between items-center border-b border-ink-50 pb-2.5">
                <span className="text-ink-500 font-medium">Convênio</span>
                <span className="font-black text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-lg border border-brand-100 text-[10px] uppercase tracking-widest">
                  {patient.insurance || 'Particular'}
                </span>
              </div>
              {patient.insuranceNumber && (
                <div className="flex justify-between items-center border-b border-ink-50 pb-2.5">
                  <span className="text-ink-500 font-medium">Carteirinha</span>
                  <span className="font-black text-ink-900 font-mono text-[11px] mt-0.5 tracking-tighter">{patient.insuranceNumber}</span>
                </div>
              )}
              {patient.history && (
                <div className="pt-1">
                  <span className="text-ink-500 font-medium block mb-2 text-xs">Histórico Clínico:</span>
                  <div className="p-3 bg-ink-50 rounded-xl border border-ink-100 text-xs text-ink-700 leading-relaxed whitespace-pre-wrap font-medium max-h-[80px] overflow-y-auto">
                    {patient.history}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── EXAMS LIST CONTAINER ─── */}
        <div className="bg-white rounded-2xl border border-ink-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between bg-ink-50/30">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-150 text-indigo-600 flex items-center justify-center">
                <ClipboardList size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest leading-none">Histórico de Exames</h3>
                <p className="text-[9px] text-ink-400 font-bold uppercase tracking-widest mt-1">Registros de laudos do paciente</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-ink-500 bg-ink-100 px-2.5 py-1 rounded-lg uppercase tracking-wide border border-ink-200">
                {filteredExams.length} Total
              </span>
              {selectedClinicId && (
                <span className="text-[9px] font-black text-brand-600 bg-brand-50 border border-brand-200 px-2.5 py-1 rounded-lg uppercase tracking-widest">
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
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {area && (
                      <span className={`chip ${area.color} hidden md:inline-flex`}>
                        {area.label}
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setSelectedExamForModal(exam);
                        setModalTab('metadata');
                      }}
                      className="h-8 px-2.5 rounded-lg border border-ink-200 bg-white hover:bg-brand-50 hover:text-brand-600 text-ink-600 transition-all flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider shadow-sm"
                      title="Ficha & Configurações"
                    >
                      <Settings size={12} />
                      <span className="hidden sm:inline">Ficha</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedExamForModal(exam);
                        setModalTab('consent');
                      }}
                      className={`h-8 px-2.5 rounded-lg border transition-all flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider shadow-sm ${
                        exam.consentAccepted
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-white text-ink-600 border-ink-200 hover:bg-indigo-50 hover:text-indigo-600'
                      }`}
                      title={exam.consentAccepted ? 'Termo Assinado' : 'Pendente de Assinatura'}
                    >
                      <ShieldCheck size={12} />
                      <span className="hidden sm:inline">Termo</span>
                    </button>
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

      {selectedExamForModal && patient && (
        <AnamnesisConsentModal
          open={!!selectedExamForModal}
          onClose={() => setSelectedExamForModal(null)}
          exam={selectedExamForModal}
          patient={patient}
          initialTab={modalTab}
        />
      )}
      </div>
    </div>
  );
}
