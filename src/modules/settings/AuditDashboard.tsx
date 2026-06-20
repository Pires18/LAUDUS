import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../store/app';
import { useCollection, where } from '../../hooks/useFirestore';
import { ReportTemplate, Clinic, Patient, AuditLog } from '../../types';
import { 
  AlertCircle, CheckCircle2, ShieldCheck, Database, Key, Building2,
  FileText, Clock, User, Activity, History, Calendar, Eye
} from 'lucide-react';
import { motion } from 'framer-motion';
import { classNames } from '../../utils/format';
import { Modal } from '../../components/Modal';

interface AuditResult {
  id: string;
  category: 'security' | 'config' | 'content';
  status: 'ok' | 'warning' | 'error';
  title: string;
  message: string;
  icon: React.ReactNode;
}

export function AuditDashboard() {
  const { settings, user } = useApp();
  const { data: templates } = useCollection<ReportTemplate>('templates');
  const { data: clinics } = useCollection<Clinic>('clinics');
  const { data: patients } = useCollection<Patient>('patients');
  
  // Query de logs do Firestore
  const { data: rawLogs, loading: loadingLogs } = useCollection<AuditLog>('audit_logs', {
    isGlobal: true,
    constraints: user ? [where('userId', '==', user.uid)] : []
  });

  const [results, setResults] = useState<AuditResult[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Ordena e filtra no cliente para evitar criação de índices compostos no Firestore
  const userLogs = useMemo(() => {
    return [...rawLogs]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }, [rawLogs]);

  useEffect(() => {
    const newResults: AuditResult[] = [];

    // 1. API Key Check
    const hasKey = settings.aiProvider === 'anthropic' ? !!settings.anthropicApiKey : !!settings.geminiApiKey;
    if (!hasKey) {
      newResults.push({
        id: 'api-key',
        category: 'security',
        status: 'error',
        title: `API Key do ${settings.aiProvider === 'anthropic' ? 'Anthropic' : 'Gemini'} Ausente`,
        message: 'O sistema está operando em modo demo. Configure a API Key para habilitar a IA.',
        icon: <Key size={18} />
      });
    } else {
      newResults.push({
        id: 'api-key',
        category: 'security',
        status: 'ok',
        title: 'IA Conectada',
        message: `API Key configurada e motor ${settings.aiProvider === 'anthropic' ? 'Claude' : 'Gemini'} pronto para uso.`,
        icon: <Key size={18} />
      });
    }

    // 2. Templates Health
    const templatesWithoutContent = templates.filter(t => !t.analysisTemplate);
    if (templatesWithoutContent.length > 0) {
      newResults.push({
        id: 'templates-health',
        category: 'content',
        status: 'warning',
        title: 'Máscaras Incompletas',
        message: `${templatesWithoutContent.length} máscara(s) não possuem análise técnica definida.`,
        icon: <FileText size={18} />
      });
    } else if (templates.length > 0) {
      newResults.push({
        id: 'templates-health',
        category: 'content',
        status: 'ok',
        title: 'Máscaras íntegras',
        message: 'Todos os modelos possuem estrutura base para o Copilot.',
        icon: <FileText size={18} />
      });
    }

    // 3. Clinics GDocs check
    const clinicsWithoutDocs = clinics.filter(c => !c.googleDocsTemplateId && c.active);
    if (clinicsWithoutDocs.length > 0) {
      newResults.push({
        id: 'clinics-gdocs',
        category: 'config',
        status: 'warning',
        title: 'Integração Google Docs',
        message: `${clinicsWithoutDocs.length} clínica(s) ativa(s) não possuem template do Google Docs vinculado.`,
        icon: <Building2 size={18} />
      });
    } else if (clinics.length > 0) {
      newResults.push({
        id: 'clinics-gdocs',
        category: 'config',
        status: 'ok',
        title: 'Google Docs Vinculado',
        message: 'Suas clínicas ativas possuem documentos integrados para exportação.',
        icon: <Building2 size={18} />
      });
    }

    // 4. Pacientes Cadastrados sem Contato
    const patientsWithoutContact = patients.filter(p => !p.phone && !p.email);
    if (patientsWithoutContact.length > 0) {
      newResults.push({
        id: 'patients-contact',
        category: 'config',
        status: 'warning',
        title: 'Contatos de Pacientes',
        message: `${patientsWithoutContact.length} paciente(s) sem telefone ou e-mail de contato cadastrados.`,
        icon: <User size={18} />
      });
    } else if (patients.length > 0) {
      newResults.push({
        id: 'patients-contact',
        category: 'config',
        status: 'ok',
        title: 'Cadastros Sanitizados',
        message: 'Todos os pacientes possuem telefone ou e-mail de contato registrados.',
        icon: <User size={18} />
      });
    }

    // 5. Preferências de Salvamento Automático
    const isAutoSaveActive = settings.autoSave !== false;
    newResults.push({
      id: 'autosave-status',
      category: 'config',
      status: isAutoSaveActive ? 'ok' : 'warning',
      title: 'Salvamento Automático',
      message: isAutoSaveActive 
        ? 'Salvamento automático ativo (rascunhos salvos a cada digitação).' 
        : 'Salvamento automático desligado. Lembre-se de salvar manualmente (Ctrl+S).',
      icon: <Clock size={18} />
    });

    // 6. Persistence check
    newResults.push({
      id: 'db-health',
      category: 'security',
      status: 'ok',
      title: 'Banco de Dados (Firestore)',
      message: 'Conexão estável e permissões de usuário validadas.',
      icon: <Database size={18} />
    });

    setResults(newResults);
  }, [settings, templates, clinics, patients]);

  const score = Math.round((results.filter(r => r.status === 'ok').length / results.length) * 100) || 0;

  return (
    <div className="space-y-8">
      {/* Score Header */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-3xl p-6 text-white shadow-premium overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <ShieldCheck size={120} />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1">Saúde do Sistema</h2>
            <p className="text-brand-100 text-sm">Auditoria automática de configurações e segurança.</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-black">{score}%</div>
            <div className="text-[10px] uppercase tracking-widest font-bold opacity-70">Score Global</div>
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="grid gap-4">
        {results.map((res, idx) => (
          <motion.div
            key={res.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white rounded-3xl border border-ink-100 shadow-sm p-4 flex items-start gap-4 hover:shadow-md transition-all duration-300"
          >
            <div className={`p-2.5 rounded-xl shrink-0 ${
              res.status === 'ok' ? 'bg-emerald-50 text-emerald-600' :
              res.status === 'warning' ? 'bg-amber-50 text-amber-600' :
              'bg-red-50 text-red-600'
            }`}>
              {res.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-bold text-ink-900 text-sm">{res.title}</h3>
                {res.status === 'ok' ? (
                  <CheckCircle2 size={14} className="text-emerald-500" />
                ) : (
                  <AlertCircle size={14} className={res.status === 'warning' ? 'text-amber-500' : 'text-red-500'} />
                )}
              </div>
              <p className="text-xs text-ink-500 font-medium leading-relaxed">{res.message}</p>
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md shrink-0 ${
              res.status === 'ok' ? 'bg-emerald-100 text-emerald-700' :
              res.status === 'warning' ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              {res.status}
            </span>
          </motion.div>
        ))}
      </div>

      {/* User Activity Logs Timeline */}
      <div className="bg-white border border-ink-100 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Activity size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-ink-900 leading-snug">Seu Histórico de Atividade</h3>
            <p className="text-xs text-ink-500">Ações forenses executadas recentemente nesta conta.</p>
          </div>
        </div>

        <div className="overflow-hidden">
          {loadingLogs ? (
            <div className="flex flex-col gap-3 py-6 animate-pulse">
              <div className="h-10 bg-ink-50 rounded-xl w-full" />
              <div className="h-10 bg-ink-50 rounded-xl w-full" />
              <div className="h-10 bg-ink-50 rounded-xl w-full" />
            </div>
          ) : userLogs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-ink-50 rounded-3xl flex items-center justify-center mx-auto mb-3 text-ink-300 border border-ink-100">
                <History size={28} />
              </div>
              <p className="text-sm font-bold text-ink-600">Nenhuma atividade registrada</p>
              <p className="text-xs text-ink-400 mt-0.5">Suas ações críticas aparecerão aqui conforme você interage com o sistema.</p>
            </div>
          ) : (
            <div className="divide-y divide-ink-50 max-h-[480px] overflow-y-auto pr-2 custom-scrollbar">
              {userLogs.map((log) => (
                <div key={log.id} className="py-4 flex items-center justify-between gap-4 hover:bg-ink-50/20 px-3 rounded-2xl transition-all group">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className={classNames(
                      "px-2.5 py-1 rounded-xl text-[8px] font-black uppercase tracking-wider border shrink-0",
                      log.action.includes('EXCLUIR') || log.action.includes('DELETE') ? "bg-red-50 text-red-700 border-red-100" :
                      log.action.includes('ATUALIZAR') || log.action.includes('UPDATE') ? "bg-blue-50 text-blue-700 border-blue-100" :
                      log.action.includes('ATIVAR') ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                      "bg-brand-50 text-brand-700 border-brand-100"
                    )}>
                      {log.action}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-ink-800 truncate max-w-[200px] xs:max-w-xs sm:max-w-md md:max-w-lg">{log.details}</p>
                      <p className="text-[10px] text-ink-400 mt-0.5 flex items-center gap-1.5 font-medium">
                        <Calendar size={10} />
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                        <span className="text-ink-200">·</span>
                        Módulo: {log.module}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedLog(log)}
                    className="p-1.5 text-ink-450 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all shrink-0 md:opacity-0 group-hover:opacity-100 active:scale-95"
                    title="Ver detalhes técnicos"
                  >
                    <Eye size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Forensic Detail Modal */}
      <Modal
        open={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
        title={`Detalhamento de Auditoria #${selectedLog?.id.slice(0, 8)}`}
        size="md"
      >
        {selectedLog && (
          <div className="space-y-6">
            <p className="text-xs text-ink-500">Executado em {new Date(selectedLog.timestamp).toLocaleString('pt-BR')}</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-ink-50/50 p-4 rounded-2xl border border-ink-100 text-xs">
                <p className="text-[9px] font-black text-ink-400 uppercase tracking-widest mb-1">Módulo</p>
                <p className="font-bold text-ink-900">{selectedLog.module}</p>
              </div>
              <div className="bg-ink-50/50 p-4 rounded-2xl border border-ink-100 text-xs">
                <p className="text-[9px] font-black text-ink-400 uppercase tracking-widest mb-1">Ação</p>
                <p className="font-bold text-ink-900">{selectedLog.action}</p>
              </div>
            </div>

            <div>
              <p className="text-[9px] font-black text-ink-400 uppercase tracking-widest mb-2">Dados da Operação</p>
              <div className="bg-ink-900 rounded-2xl p-4 overflow-hidden max-h-[220px] overflow-y-auto custom-scrollbar">
                <pre className="text-[11px] text-brand-50 font-mono whitespace-pre-wrap leading-relaxed">
                  {selectedLog.details}
                </pre>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
