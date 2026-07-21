import { useState } from 'react';
import { X, Upload, CheckCircle2, XCircle, Loader2, FileWarning, RotateCcw, AlertTriangle, FileArchive } from 'lucide-react';
import { useApp } from '../../../store/app';
import { updateItem } from '../../../store/db';
import { uploadExternalDicomFile, ExternalDicomUploadResult, DICOM_LARGE_FILE_BYTES, hasDirectDicomAgent } from '../../../utils/dicom';
import { extractDicomFilesFromZip, isZipFile } from '../../../utils/dicomZip';

interface ExternalStudyUploadModalProps {
  examId: string;
  currentUids: string[];
  onClose: () => void;
  onLinked: () => void;
}

type FileState = {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number; // 0-100, só relevante durante 'uploading'
  result?: ExternalDicomUploadResult;
};

const CONCURRENCY = 3;
// Com arquivo pesado, menos uploads simultâneos — vários grandes ao mesmo
// tempo competem pela mesma banda do túnel (Tailscale) e aumentam a chance
// de estourar o timeout de todos ao mesmo tempo.
const CONCURRENCY_LARGE_FILES = 1;

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Para exames feitos em local externo (sem aparelho conectado ao sistema):
 * envia os .dcm direto pro Orthanc e vincula o StudyInstanceUID encontrado
 * ao exame, pra ele aparecer no viewer igual a um estudo normal.
 */
export function ExternalStudyUploadModal({ examId, currentUids, onClose, onLinked }: ExternalStudyUploadModalProps) {
  const { settings, showToast } = useApp();
  const [files, setFiles] = useState<FileState[]>([]);
  const [uploading, setUploading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [extracting, setExtracting] = useState(false);

  function updateFile(idx: number, patch: Partial<FileState>) {
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  async function handleSelectFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const selected = Array.from(list);
    const zips = selected.filter(isZipFile);
    const loose = selected.filter((f) => !isZipFile(f));

    let extracted: File[] = [];
    if (zips.length > 0) {
      setExtracting(true);
      try {
        let ignoredCount = 0;
        for (const zip of zips) {
          try {
            const result = await extractDicomFilesFromZip(zip);
            extracted = extracted.concat(result.files);
            ignoredCount += result.ignored.length;
          } catch (err: any) {
            showToast(err.message || `Falha ao descompactar ${zip.name}.`, 'error');
          }
        }
        if (extracted.length > 0) {
          showToast(
            `${extracted.length} arquivo${extracted.length > 1 ? 's' : ''} DICOM extraído${extracted.length > 1 ? 's' : ''} do ZIP` +
              (ignoredCount > 0 ? ` (${ignoredCount} não-DICOM ignorado${ignoredCount > 1 ? 's' : ''})` : '') + '.',
            'success'
          );
        } else if (zips.length > 0 && loose.length === 0) {
          showToast('Nenhum arquivo DICOM encontrado dentro do ZIP.', 'error');
        }
      } finally {
        setExtracting(false);
      }
    }

    const all = [...loose, ...extracted];
    if (all.length === 0) return;
    setFiles(all.map((file) => ({ file, status: 'pending' as const, progress: 0 })));
  }

  async function uploadFileAt(idx: number, file: File) {
    updateFile(idx, { status: 'uploading', progress: 0, result: undefined });
    const result = await uploadExternalDicomFile(file, settings, (loaded, total) => {
      updateFile(idx, { progress: total > 0 ? Math.round((loaded / total) * 100) : 0 });
    });
    updateFile(idx, { status: result.success ? 'done' : 'error', progress: result.success ? 100 : 0, result });
  }

  async function startUpload() {
    setUploading(true);
    const snapshot = files;
    const hasLargeFiles = snapshot.some((f) => f.file.size > DICOM_LARGE_FILE_BYTES);
    const concurrency = hasLargeFiles ? CONCURRENCY_LARGE_FILES : CONCURRENCY;
    let cursor = 0;
    async function worker() {
      while (cursor < snapshot.length) {
        const idx = cursor++;
        await uploadFileAt(idx, snapshot[idx].file);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, snapshot.length) }, worker));
    setUploading(false);
  }

  async function retryFile(idx: number) {
    await uploadFileAt(idx, files[idx].file);
  }

  const successResults = files.filter((f) => f.status === 'done' && f.result?.studyInstanceUid);
  const uniqueUids = Array.from(new Set(successResults.map((f) => f.result!.studyInstanceUid!)));
  const failedCount = files.filter((f) => f.status === 'error').length;
  const allSettled = files.length > 0 && files.every((f) => f.status === 'done' || f.status === 'error');
  const firstResult = successResults[0]?.result;

  const totalBytes = files.reduce((s, f) => s + f.file.size, 0);
  const sentBytes = files.reduce((s, f) => {
    if (f.status === 'done') return s + f.file.size;
    if (f.status === 'uploading') return s + (f.file.size * f.progress) / 100;
    return s;
  }, 0);
  const overallPct = totalBytes > 0 ? Math.round((sentBytes / totalBytes) * 100) : 0;

  const hasLargeFiles = files.some((f) => f.file.size > DICOM_LARGE_FILE_BYTES);
  const directAgentOk = hasDirectDicomAgent(settings);

  async function linkStudy() {
    if (uniqueUids.length === 0) return;
    setLinking(true);
    try {
      const merged = Array.from(new Set([...(currentUids || []), ...uniqueUids]));
      await updateItem('exams', examId, { externalStudyInstanceUids: merged });
      showToast(`Estudo externo vinculado (${successResults.length} arquivo${successResults.length > 1 ? 's' : ''}).`, 'success');
      onLinked();
    } catch (err: any) {
      showToast('Falha ao vincular o estudo ao exame: ' + (err.message || ''), 'error');
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-ink-100 shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="p-5 border-b border-ink-100 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-ink-900">Importar estudo externo</h3>
            <p className="text-[11px] text-ink-500 font-medium mt-0.5">Para exames feitos fora do sistema (sem aparelho conectado) — envie os arquivos DICOM (.dcm) do estudo, ou um ZIP contendo as imagens.</p>
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {files.length === 0 ? (
            extracting ? (
              <div className="flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed border-violet-200 text-violet-500">
                <FileArchive size={24} className="animate-pulse" />
                <span className="text-xs font-bold flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Descompactando ZIP…</span>
                <span className="text-[10px] text-center text-ink-400">Procurando arquivos DICOM dentro do arquivo</span>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed border-ink-200 text-ink-400 cursor-pointer hover:border-violet-300 hover:text-violet-500 transition-all">
                <Upload size={24} />
                <span className="text-xs font-bold">Selecionar arquivos .dcm ou .zip</span>
                <span className="text-[10px] text-center">Pode selecionar todos os arquivos do estudo de uma vez, ou um ZIP com o estudo inteiro — ele é descompactado aqui mesmo e todas as imagens entram na fila</span>
                <input type="file" multiple accept=".dcm,.zip,application/dicom,application/zip,application/x-zip-compressed" className="hidden" onChange={(e) => handleSelectFiles(e.target.files)} />
              </label>
            )
          ) : (
            <>
              {hasLargeFiles && !directAgentOk && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>Você selecionou arquivo(s) grande(s) e o <strong>Agente Local</strong> não está configurado com URL HTTPS — o envio vai passar pelo servidor da Vercel, que tem limite de ~4,5MB e pode falhar nesses arquivos. Configure o Agente Local (aba Servidores, ou Guias → Conectar relé) para enviar direto, sem esse limite.</span>
                </div>
              )}

              {files.length > 1 && (uploading || allSettled) && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-ink-500">
                    <span>{files.filter((f) => f.status === 'done').length}/{files.length} arquivos</span>
                    <span>{formatBytes(sentBytes)} / {formatBytes(totalBytes)}</span>
                  </div>
                  <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500 transition-all duration-300" style={{ width: `${overallPct}%` }} />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                {files.map((f, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-ink-50 border border-ink-100 text-[11px] space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate font-mono text-ink-700">{f.file.name}</span>
                      <span className="text-[9px] text-ink-400 font-bold shrink-0">{formatBytes(f.file.size)}</span>
                      {f.status === 'pending' && <span className="text-ink-400 text-[10px] font-bold uppercase shrink-0">Aguardando</span>}
                      {f.status === 'uploading' && <span className="text-violet-600 text-[10px] font-bold shrink-0">{f.progress}%</span>}
                      {f.status === 'done' && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
                      {f.status === 'error' && (
                        <>
                          <span title={f.result?.error} className="shrink-0"><XCircle size={14} className="text-rose-500" /></span>
                          <button
                            onClick={() => retryFile(idx)}
                            title="Tentar novamente"
                            className="shrink-0 p-1 rounded-md text-ink-400 hover:text-violet-600 hover:bg-violet-50 transition-all"
                          >
                            <RotateCcw size={13} />
                          </button>
                        </>
                      )}
                    </div>
                    {f.status === 'uploading' && (
                      <div className="h-1 bg-ink-200 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 transition-all duration-150" style={{ width: `${f.progress}%` }} />
                      </div>
                    )}
                    {f.status === 'error' && f.result?.error && (
                      <p className="text-[10px] text-rose-600">{f.result.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {failedCount > 0 && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-100 text-[11px] text-rose-700 flex gap-2">
              <FileWarning size={14} className="shrink-0 mt-0.5" />
              <span>{failedCount} arquivo{failedCount > 1 ? 's' : ''} falharam no envio — clique no ícone de repetir em cada um, ou continue: os que deram certo já ficam disponíveis para vincular.</span>
            </div>
          )}

          {allSettled && successResults.length > 0 && firstResult && (
            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 text-[11px] text-emerald-800 space-y-1">
              <p className="font-black uppercase tracking-wider text-[9px] text-emerald-600">Confira antes de vincular</p>
              <p><strong>Paciente gravado no arquivo:</strong> {firstResult.patientName || '—'} (ID: {firstResult.patientIdTag || '—'})</p>
              {firstResult.studyDescription && <p><strong>Descrição do estudo:</strong> {firstResult.studyDescription}</p>}
              {uniqueUids.length > 1 && (
                <p className="text-amber-700">Atenção: os arquivos enviados pertencem a {uniqueUids.length} estudos diferentes — todos serão vinculados a este exame.</p>
              )}
              <p className="text-emerald-700/80">O PACS não confere se esse é o paciente certo — confirme visualmente antes de vincular.</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 bg-ink-50 border-t border-ink-100 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-ink-200 hover:bg-ink-100 text-ink-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
          >
            Cancelar
          </button>
          {files.length > 0 && !allSettled && (
            <button
              type="button"
              onClick={startUpload}
              disabled={uploading}
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center gap-2"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Enviar {files.length} arquivo{files.length > 1 ? 's' : ''}
            </button>
          )}
          {allSettled && successResults.length > 0 && (
            <button
              type="button"
              onClick={linkStudy}
              disabled={linking}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center gap-2"
            >
              {linking ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Vincular ao exame
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
