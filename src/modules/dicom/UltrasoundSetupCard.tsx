import { useState, useEffect } from 'react';
import { useApp } from '../../store/app';
import { classNames } from '../../utils/format';
import type { DicomDevice } from '../../types';
import { getActivePacsUrl, getProxyEndpoint, getDicomAuthParams } from '../../store/db';
import { useAllAccessibleClinics } from '../../hooks/useAllAccessibleClinics';
import {
  Radio, Copy, Check, Plus, Trash2, Info, Network, Router, ShieldCheck, RefreshCw, Pencil, X, Star
} from 'lucide-react';

/**
 * Assistente "Conectar meu ultrassom" — a parte de "ajustes simples pessoais":
 * mostra os valores prontos para digitar no painel do aparelho (com copiar) e
 * permite cadastrar os aparelhos (dicomDevices) sem mexer em nada técnico.
 */
export function UltrasoundSetupCard() {
  const { settings, updateSettings, showToast } = useApp();
  const { data: clinics } = useAllAccessibleClinics();
  const [copied, setCopied] = useState<string | null>(null);
  const [newDevice, setNewDevice] = useState({ name: '', aeTitle: '', modality: 'US', ip: '', clinicId: '' });

  const pacsAe = settings.dicomOrthancAETitle || 'ORTHANC';
  const devices = settings.dicomDevices || [];
  const dicomPort = settings.pacsInstance?.dicomPort || 4242;
  const hasMultipleClinics = clinics.length > 1;
  function clinicName(clinicId?: string): string {
    if (!clinicId) return 'Todas as clínicas';
    return clinics.find((c) => c.id === clinicId)?.name || 'Clínica removida';
  }
  function isDeviceDefault(device: DicomDevice): boolean {
    return device.clinicId
      ? settings.dicomDefaultDeviceIdByClinic?.[device.clinicId] === device.id
      : settings.dicomDefaultDeviceId === device.id;
  }

  // Legado: o AE Title/IP do aparelho já foram um campo único (dicomModalityAETitle/
  // dicomModalityIp), separado da lista do Passo 3 (dicomDevices) — um aparelho
  // salvo só nesse campo antigo nunca aparecia no Passo 3 nem no seletor de
  // "enviar worklist para" dos modais de exame/agenda, que só leem dicomDevices.
  // Essa edição foi removida da tela (agora só existe a lista abaixo), mas quem
  // já tinha esse campo legado preenchido e o Passo 3 vazio ganha uma migração
  // única para dicomDevices ao abrir a tela, sem perder o cadastro.
  const STEP2_DEVICE_ID = 'dicom-step2';
  function upsertStep2Device(list: DicomDevice[], aeTitle: string, ip: string): DicomDevice[] {
    const device: DicomDevice = { id: STEP2_DEVICE_ID, name: 'Aparelho (migrado)', aeTitle, modality: 'US', ip };
    const idx = list.findIndex((d) => d.id === STEP2_DEVICE_ID);
    if (idx === -1) return [...list, device];
    const next = [...list];
    next[idx] = device;
    return next;
  }

  useEffect(() => {
    if ((settings.dicomDevices?.length ?? 0) === 0 && settings.dicomModalityAETitle) {
      updateSettings({
        dicomDevices: upsertStep2Device([], settings.dicomModalityAETitle, settings.dicomModalityIp || ''),
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autoriza/remove o aparelho no Orthanc (DicomModalities) via a API REST
  // dele mesmo, passando pelo mesmo proxy já usado pelas imagens — sem precisar
  // de SSH na VM. Sem isso, o Orthanc rejeita a consulta de Worklist com
  // "This AET is not listed in configuration option DicomModalities", mesmo
  // com o C-ECHO funcionando (Echo é sempre liberado; Worklist exige registro).
  async function syncModalityInOrthanc(aeTitle: string, ip: string, action: 'put' | 'delete') {
    const id = aeTitle.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'device';
    const baseUrl = getActivePacsUrl(settings, false).replace(/\/$/, '');
    const auth = getDicomAuthParams(settings, false);
    const proxyPath = getProxyEndpoint(settings, false);
    const target = `${baseUrl}/modalities/${id}`;
    const url = `${proxyPath}?url=${encodeURIComponent(target)}${auth}`;
    const res = await fetch(url, {
      method: action === 'put' ? 'PUT' : 'DELETE',
      headers: action === 'put' ? { 'Content-Type': 'application/json' } : undefined,
      body: action === 'put'
        // AllowFindWorklist é uma permissão SEPARADA de AllowFind no Orthanc —
        // é exatamente a que faltava (o log mostrou o C-FIND de worklist sendo
        // rejeitado mesmo com DicomAlwaysAllowFind:true no config global).
        ? JSON.stringify({ AET: aeTitle, Host: ip || '0.0.0.0', Port: 104, AllowEcho: true, AllowFind: true, AllowFindWorklist: true, AllowStore: true })
        : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`PACS recusou (HTTP ${res.status})${text ? ': ' + text.slice(0, 150) : ''}`);
    }
  }

  // IP tailnet da VM do PACS — consultado direto no Agente (health-check
  // público) para montar a instrução do relé já pronta com o endereço real.
  const [vmTailnetIp, setVmTailnetIp] = useState<string | null>(null);
  useEffect(() => {
    const agentUrl = settings.dicomLocalAgentUrl;
    if (!agentUrl || !/^https:\/\//i.test(agentUrl)) { setVmTailnetIp(null); return; }
    let cancelled = false;
    fetch(`${agentUrl.replace(/\/$/, '')}/`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setVmTailnetIp(d?.tailscaleIp || null); })
      .catch(() => { if (!cancelled) setVmTailnetIp(null); });
    return () => { cancelled = true; };
  }, [settings.dicomLocalAgentUrl]);

  // Porta DICOM — editável. Necessário porque tenants criados numa VM
  // compartilhada usam uma porta exclusiva (43xx), nunca a 4242 padrão; e o
  // provisionamento pode ter salvo a instância antes de o campo existir.
  const [portInput, setPortInput] = useState(String(dicomPort));
  const [savingPort, setSavingPort] = useState(false);
  useEffect(() => { setPortInput(String(dicomPort)); }, [dicomPort]);
  async function saveDicomPort() {
    const n = parseInt(portInput, 10);
    if (!n || n < 1 || n > 65535) { showToast('Informe uma porta válida (1–65535).', 'error'); return; }
    setSavingPort(true);
    try {
      await updateSettings({ pacsInstance: { ...(settings.pacsInstance || { status: 'ready' }), dicomPort: n } });
      showToast('Porta DICOM salva.', 'success');
    } finally { setSavingPort(false); }
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    showToast('Copiado!', 'success');
    setTimeout(() => setCopied(null), 1500);
  }

  async function addDevice() {
    const name = newDevice.name.trim();
    const aeTitle = newDevice.aeTitle.trim().toUpperCase();
    const ip = newDevice.ip.trim();
    if (!name || !aeTitle) { showToast('Preencha nome e AE Title do aparelho.', 'error'); return; }
    const device: DicomDevice = { id: `dev_${Date.now().toString(36)}`, name, aeTitle, modality: newDevice.modality || 'US', ip, clinicId: newDevice.clinicId || undefined };
    await updateSettings({ dicomDevices: [...devices, device] });
    setNewDevice({ name: '', aeTitle: '', modality: 'US', ip: '', clinicId: '' });
    try {
      await syncModalityInOrthanc(aeTitle, ip, 'put');
      showToast('Aparelho adicionado e autorizado no PACS.', 'success');
    } catch (err: any) {
      showToast('Aparelho salvo, mas falha ao autorizar no PACS: ' + (err.message || ''), 'error');
    }
  }

  async function removeDevice(device: DicomDevice) {
    const patch: { dicomDevices: DicomDevice[]; dicomDefaultDeviceId?: string; dicomDefaultDeviceIdByClinic?: Record<string, string> } = {
      dicomDevices: devices.filter((d) => d.id !== device.id),
    };
    // Se o removido era o principal (global ou da clínica dele), tira a marcação
    // (senão fica apontando pra um id inexistente).
    if (device.clinicId) {
      if (settings.dicomDefaultDeviceIdByClinic?.[device.clinicId] === device.id) {
        const next = { ...settings.dicomDefaultDeviceIdByClinic };
        delete next[device.clinicId];
        patch.dicomDefaultDeviceIdByClinic = next;
      }
    } else if (settings.dicomDefaultDeviceId === device.id) {
      patch.dicomDefaultDeviceId = '';
    }
    await updateSettings(patch);
    try {
      await syncModalityInOrthanc(device.aeTitle, device.ip || '', 'delete');
    } catch { /* remoção no Orthanc é best-effort — não bloqueia a UI */ }
  }

  // Aparelho principal: pré-selecionado ao criar exame/confirmar agendamento
  // quando nenhum é escolhido manualmente. Aparelho de uma clínica específica
  // marca o principal DAQUELA clínica; aparelho compartilhado (sem clínica)
  // marca o principal global, usado como respaldo quando a clínica não tem um.
  async function setDefaultDevice(device: DicomDevice) {
    if (device.clinicId) {
      const current = settings.dicomDefaultDeviceIdByClinic || {};
      const next = { ...current };
      if (current[device.clinicId] === device.id) delete next[device.clinicId];
      else next[device.clinicId] = device.id;
      await updateSettings({ dicomDefaultDeviceIdByClinic: next });
    } else {
      const next = settings.dicomDefaultDeviceId === device.id ? '' : device.id;
      await updateSettings({ dicomDefaultDeviceId: next });
    }
  }

  const [resyncingId, setResyncingId] = useState<string | null>(null);
  async function resyncDevice(device: DicomDevice) {
    setResyncingId(device.id);
    try {
      await syncModalityInOrthanc(device.aeTitle, device.ip || '', 'put');
      showToast('Aparelho autorizado no PACS.', 'success');
    } catch (err: any) {
      showToast('Falha ao autorizar no PACS: ' + (err.message || ''), 'error');
    } finally { setResyncingId(null); }
  }

  // Edição dos dados de um aparelho já cadastrado (nome, AE Title, IP, modalidade).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ name: '', aeTitle: '', modality: 'US', ip: '', clinicId: '' });
  const [savingEditId, setSavingEditId] = useState<string | null>(null);

  function startEdit(device: DicomDevice) {
    setEditingId(device.id);
    setEditDraft({ name: device.name, aeTitle: device.aeTitle, modality: device.modality || 'US', ip: device.ip || '', clinicId: device.clinicId || '' });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(original: DicomDevice) {
    const name = editDraft.name.trim();
    const aeTitle = editDraft.aeTitle.trim().toUpperCase();
    const ip = editDraft.ip.trim();
    const modality = editDraft.modality.trim().toUpperCase() || 'US';
    if (!name || !aeTitle) { showToast('Preencha nome e AE Title do aparelho.', 'error'); return; }
    const updated: DicomDevice = { ...original, name, aeTitle, modality, ip, clinicId: editDraft.clinicId || undefined };
    setSavingEditId(original.id);
    try {
      await updateSettings({ dicomDevices: devices.map((d) => (d.id === original.id ? updated : d)) });
      try {
        // O AE Title muda o id da entrada no Orthanc (derivado dele) — revoga a
        // entrada antiga antes de autorizar a nova, senão ela fica órfã lá.
        if (aeTitle !== original.aeTitle) {
          await syncModalityInOrthanc(original.aeTitle, original.ip || '', 'delete').catch(() => {});
        }
        await syncModalityInOrthanc(aeTitle, ip, 'put');
        showToast('Aparelho atualizado e autorizado no PACS.', 'success');
      } catch (err: any) {
        showToast('Aparelho salvo, mas falha ao autorizar no PACS: ' + (err.message || ''), 'error');
      }
      setEditingId(null);
    } finally { setSavingEditId(null); }
  }

  const CopyRow = ({ label, value, id, hint }: { label: string; value: string; id: string; hint?: string }) => (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-ink-50 border border-ink-100">
      <div className="min-w-0">
        <p className="text-[9px] font-black text-ink-400 uppercase tracking-widest">{label}</p>
        <p className="text-sm font-mono font-bold text-ink-800 truncate">{value}</p>
        {hint && <p className="text-[10px] text-ink-400 mt-0.5">{hint}</p>}
      </div>
      <button
        onClick={() => copy(value, id)}
        className="shrink-0 h-8 px-2.5 rounded-lg bg-white border border-ink-200 text-ink-500 hover:bg-ink-100 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-all"
      >
        {copied === id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
        {copied === id ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-ink-200 shadow-sm p-5 space-y-5">
      <div className="flex items-center gap-3 pb-3 border-b border-ink-50">
        <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
          <Radio size={18} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-ink-900">Conectar meu ultrassom</h3>
          <p className="text-xs text-ink-500 font-medium">Os valores para digitar no painel do aparelho — e seus aparelhos cadastrados.</p>
        </div>
      </div>

      {/* Passo 1 — Relé */}
      <div className="p-3.5 rounded-xl bg-blue-50/40 border border-blue-100 flex gap-2.5">
        <Router size={15} className="text-blue-500 shrink-0 mt-0.5" />
        <div className="text-[11px] text-ink-700 leading-relaxed">
          <strong className="text-blue-800">Passo 1 — o Relé:</strong> como o aparelho é físico na clínica, algo na sua rede leva ele até o PACS na nuvem. Use seu <strong>roteador GL.iNet</strong> (com Tailscale) ou o <strong>PC do dia a dia</strong>. Veja o passo a passo em <strong>Guias → Tailscale (VM ↔ seu PC/roteador)</strong>. O <strong>endereço (IP)</strong> que você vai digitar no aparelho é o do relé na sua rede local.
          {settings.pacsInstance?.relayAuthKey && (
            <div className="mt-2 p-2.5 rounded-lg bg-white border border-blue-200 space-y-1.5">
              <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Chave para logar o relé (sem precisar da conta do suporte)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 text-[11px] font-mono text-ink-800 truncate">{settings.pacsInstance.relayAuthKey}</code>
                <button
                  onClick={() => copy(settings.pacsInstance!.relayAuthKey!, 'relaykey')}
                  className="shrink-0 h-7 px-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 text-[9px] font-black uppercase tracking-wider transition-all"
                >
                  {copied === 'relaykey' ? <Check size={11} /> : <Copy size={11} />}
                  {copied === 'relaykey' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <p className="text-[10px] text-ink-400">Cole essa chave na tela de login do Tailscale do seu roteador/PC (em vez de logar com conta/senha). Ela já autoriza o dispositivo com o acesso certo — sem enxergar outros clientes.</p>
            </div>
          )}
          {vmTailnetIp && (
            <div className="mt-2 p-2.5 rounded-lg bg-white border border-blue-200">
              <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">Regra de encaminhamento no relé (já com seus dados)</p>
              <p className="font-mono text-[11px] text-ink-800">
                destino <strong>{vmTailnetIp}:{dicomPort}</strong> → aparelho fala com o relé nessa mesma porta
              </p>
              <p className="text-[10px] text-ink-400 mt-1">IP tailnet do seu PACS na nuvem: <span className="font-mono font-bold text-ink-600">{vmTailnetIp}</span>. Configure o encaminhamento (port-forward) do relé para esse destino.</p>
            </div>
          )}
        </div>
      </div>

      {/* Passo 2 — valores no aparelho */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5">
          <Network size={13} className="text-violet-500" />
          <p className="text-[10px] font-black text-ink-500 uppercase tracking-widest">Passo 2 — digite estes valores no aparelho (Worklist e Storage)</p>
        </div>
        <div className="p-3 rounded-xl bg-ink-50 border border-ink-100 space-y-2">
          <div>
            <p className="text-[9px] font-black text-ink-400 uppercase tracking-widest">Porta DICOM</p>
            <p className="text-[10px] text-ink-400">
              {settings.pacsInstance?.dicomPort
                ? 'Porta exclusiva do seu PACS na nuvem — use exatamente esta no aparelho e no relé.'
                : 'Não veio do provisionamento (instância antiga) — confira a porta real na VM (/opt/pacs-tenant.sh list) e corrija aqui.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="input h-9 text-sm font-mono flex-1"
              value={portInput}
              onChange={(e) => setPortInput(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Ex: 4301"
              inputMode="numeric"
            />
            <button
              onClick={saveDicomPort}
              disabled={savingPort || !portInput || portInput === String(dicomPort)}
              className="h-9 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-black text-[10px] uppercase tracking-wider transition-all"
            >
              {savingPort ? '…' : 'Salvar'}
            </button>
            <button
              onClick={() => copy(portInput, 'port')}
              className="shrink-0 h-9 px-2.5 rounded-lg bg-white border border-ink-200 text-ink-500 hover:bg-ink-100 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-all"
              title="Copiar"
            >
              {copied === 'port' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            </button>
          </div>
        </div>
        <CopyRow label="AE Title do PACS (destino)" value={pacsAe} id="pacsae" hint="Onde o aparelho busca a fila e envia as imagens." />
        <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100 flex gap-2 text-[11px] text-amber-800 leading-relaxed">
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>O <strong>Endereço/IP</strong> a digitar NO APARELHO é o do <strong>relé</strong> na sua rede (ex: <code>192.168.x.x</code>), não a URL da nuvem. A <strong>identidade do seu ultrassom</strong> (AE Title + IP na sua LAN, usado só para autorizá-lo no PACS) agora é cadastrada e editada no <strong>Passo 3, abaixo</strong>. Depois, no aparelho, rode <strong>C-ECHO / Verify</strong> — deve dar "Sucesso".</span>
        </div>
      </div>

      {/* Passo 3 — Meus aparelhos */}
      <div className="space-y-2.5">
        <p className="text-[10px] font-black text-ink-500 uppercase tracking-widest">Passo 3 — meus aparelhos (nome, AE Title, IP e modalidade{hasMultipleClinics ? ', clínica' : ''})</p>
        {hasMultipleClinics && (
          <p className="text-[11px] text-ink-500 px-1 leading-relaxed">Você tem múltiplas clínicas — associe cada aparelho à clínica dele para que ele já venha pré-selecionado ao criar exame/confirmar agendamento daquela unidade. Deixe em <strong>"Todas as clínicas"</strong> para um aparelho compartilhado.</p>
        )}
        {devices.length === 0 ? (
          <p className="text-[11px] text-ink-400 italic px-1">Nenhum aparelho cadastrado ainda. Cadastre abaixo — é aqui que fica a identidade (AE Title) e o IP do seu aparelho, usados para autorizá-lo no PACS.</p>
        ) : (
          <div className="space-y-1.5">
            {devices.map((d) => (
              editingId === d.id ? (
                <div key={d.id} className="p-2.5 rounded-lg bg-violet-50/40 border border-violet-200 space-y-2">
                {hasMultipleClinics && (
                  <select
                    className="input h-9 text-sm w-full"
                    value={editDraft.clinicId}
                    onChange={(e) => setEditDraft({ ...editDraft, clinicId: e.target.value })}
                  >
                    <option value="">Todas as clínicas</option>
                    {clinics.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto_auto_auto] gap-2 items-center">
                  <input
                    className="input h-9 text-sm"
                    placeholder="Nome"
                    value={editDraft.name}
                    onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  />
                  <input
                    className="input h-9 text-sm font-mono uppercase"
                    placeholder="AE Title"
                    value={editDraft.aeTitle}
                    onChange={(e) => setEditDraft({ ...editDraft, aeTitle: e.target.value.toUpperCase() })}
                  />
                  <input
                    className="input h-9 text-sm font-mono"
                    placeholder="IP"
                    value={editDraft.ip}
                    onChange={(e) => setEditDraft({ ...editDraft, ip: e.target.value })}
                  />
                  <input
                    className="input h-9 text-sm w-full sm:w-16 text-center uppercase"
                    placeholder="US"
                    value={editDraft.modality}
                    onChange={(e) => setEditDraft({ ...editDraft, modality: e.target.value.toUpperCase() })}
                  />
                  <button
                    onClick={() => saveEdit(d)}
                    disabled={savingEditId === d.id}
                    className="h-9 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-black text-[10px] uppercase tracking-wider transition-all"
                  >
                    {savingEditId === d.id ? '…' : 'Salvar'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    disabled={savingEditId === d.id}
                    title="Cancelar"
                    className="h-9 px-2.5 rounded-lg bg-white border border-ink-200 text-ink-500 hover:bg-ink-100 flex items-center justify-center transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>
                </div>
              ) : (
                <div key={d.id} className={classNames(
                  'flex items-center gap-2 p-2.5 rounded-lg border',
                  isDeviceDefault(d) ? 'bg-amber-50/50 border-amber-200' : 'bg-ink-50 border-ink-100'
                )}>
                  <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                    <Radio size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-ink-800 truncate flex items-center gap-1.5">
                      {d.name}
                      {isDeviceDefault(d) && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[8px] font-black uppercase tracking-wider">Principal</span>
                      )}
                      {hasMultipleClinics && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-ink-100 text-ink-500 text-[8px] font-black uppercase tracking-wider">{clinicName(d.clinicId)}</span>
                      )}
                    </p>
                    <p className="text-[10px] font-mono text-ink-400">{d.aeTitle} · {d.modality}{d.ip ? ` · ${d.ip}` : ''}</p>
                  </div>
                  <button
                    onClick={() => setDefaultDevice(d)}
                    title={isDeviceDefault(d) ? 'Desmarcar como principal' : `Marcar como principal${d.clinicId ? ` de ${clinicName(d.clinicId)}` : ''} (pré-selecionado ao criar exame)`}
                    className={classNames(
                      'p-1.5 rounded-lg transition-all',
                      isDeviceDefault(d) ? 'text-amber-500 hover:bg-amber-100' : 'text-ink-400 hover:text-amber-500 hover:bg-amber-50'
                    )}
                  >
                    <Star size={14} fill={isDeviceDefault(d) ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => startEdit(d)}
                    title="Editar aparelho"
                    className="p-1.5 rounded-lg text-ink-400 hover:text-violet-600 hover:bg-violet-50 transition-all"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => resyncDevice(d)}
                    disabled={resyncingId === d.id}
                    title="Reautorizar no PACS"
                    className="p-1.5 rounded-lg text-ink-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-40"
                  >
                    <RefreshCw size={14} className={resyncingId === d.id ? 'animate-spin' : ''} />
                  </button>
                  <button onClick={() => removeDevice(d)} className="p-1.5 rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            ))}
          </div>
        )}
        <div className="space-y-2">
          {hasMultipleClinics && (
            <select
              className="input h-9 text-sm w-full"
              value={newDevice.clinicId}
              onChange={(e) => setNewDevice({ ...newDevice, clinicId: e.target.value })}
            >
              <option value="">Todas as clínicas</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-center">
            <input
              className="input h-9 text-sm"
              placeholder="Nome (ex: US Sala 1)"
              value={newDevice.name}
              onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
            />
            <input
              className="input h-9 text-sm font-mono"
              placeholder="AE Title (ex: GE_LOGIQ)"
              value={newDevice.aeTitle}
              onChange={(e) => setNewDevice({ ...newDevice, aeTitle: e.target.value.toUpperCase() })}
            />
            <input
              className="input h-9 text-sm font-mono"
              placeholder="IP (ex: 192.168.8.50)"
              value={newDevice.ip}
              onChange={(e) => setNewDevice({ ...newDevice, ip: e.target.value })}
            />
            <input
              className="input h-9 text-sm w-full sm:w-16 text-center"
              placeholder="US"
              value={newDevice.modality}
              onChange={(e) => setNewDevice({ ...newDevice, modality: e.target.value.toUpperCase() })}
            />
            <button
              onClick={addDevice}
              className="h-9 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus size={13} /> Adicionar
            </button>
          </div>
        </div>
        <p className="text-[10px] text-ink-400 px-1 leading-relaxed flex items-center gap-1"><ShieldCheck size={11} className="text-emerald-500 shrink-0" /> Adicionar, editar ou remover aqui já autoriza/revoga o aparelho no PACS automaticamente (sem SSH).</p>
      </div>
    </div>
  );
}
