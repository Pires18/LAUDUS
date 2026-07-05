import { useState } from 'react';
import { useApp } from '../../store/app';
import { classNames } from '../../utils/format';
import type { DicomDevice } from '../../types';
import {
  Radio, Copy, Check, Plus, Trash2, Info, Network, Router
} from 'lucide-react';

/**
 * Assistente "Conectar meu ultrassom" — a parte de "ajustes simples pessoais":
 * mostra os valores prontos para digitar no painel do aparelho (com copiar) e
 * permite cadastrar os aparelhos (dicomDevices) sem mexer em nada técnico.
 */
export function UltrasoundSetupCard() {
  const { settings, updateSettings, showToast } = useApp();
  const [copied, setCopied] = useState<string | null>(null);
  const [newDevice, setNewDevice] = useState({ name: '', aeTitle: '', modality: 'US' });

  const pacsAe = settings.dicomOrthancAETitle || 'ORTHANC';
  const deviceAe = settings.dicomModalityAETitle || 'MINDRAYMX7';
  const devices = settings.dicomDevices || [];

  // AE Title do aparelho — editável (cada ultrassom tem o seu).
  const [aeInput, setAeInput] = useState(deviceAe);
  const [savingAe, setSavingAe] = useState(false);
  async function saveDeviceAe() {
    const v = aeInput.trim().toUpperCase();
    if (!v) { showToast('Informe o AE Title do aparelho.', 'error'); return; }
    setSavingAe(true);
    try {
      await updateSettings({ dicomModalityAETitle: v });
      setAeInput(v);
      showToast('AE Title do aparelho salvo.', 'success');
    } finally { setSavingAe(false); }
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
    if (!name || !aeTitle) { showToast('Preencha nome e AE Title do aparelho.', 'error'); return; }
    const device: DicomDevice = { id: `dev_${Date.now().toString(36)}`, name, aeTitle, modality: newDevice.modality || 'US' };
    await updateSettings({ dicomDevices: [...devices, device] });
    setNewDevice({ name: '', aeTitle: '', modality: 'US' });
    showToast('Aparelho adicionado.', 'success');
  }

  async function removeDevice(id: string) {
    await updateSettings({ dicomDevices: devices.filter((d) => d.id !== id) });
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
          <strong className="text-blue-800">Passo 1 — o Relé:</strong> como o aparelho é físico na clínica, algo na sua rede leva ele até o PACS na nuvem. Use seu <strong>roteador GL.iNet</strong> (com Tailscale) ou o <strong>PC do dia a dia</strong>. Veja o passo a passo em <strong>Guias → Tailscale VPN &amp; SSL</strong>. O <strong>endereço (IP)</strong> que você vai digitar no aparelho é o do relé na sua rede local.
        </div>
      </div>

      {/* Passo 2 — valores no aparelho */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5">
          <Network size={13} className="text-violet-500" />
          <p className="text-[10px] font-black text-ink-500 uppercase tracking-widest">Passo 2 — digite estes valores no aparelho (Worklist e Storage)</p>
        </div>
        <CopyRow
          label="Porta DICOM"
          value={String(settings.pacsInstance?.dicomPort || 4242)}
          id="port"
          hint={settings.pacsInstance?.dicomPort ? 'Porta exclusiva do seu PACS na nuvem — use exatamente esta.' : undefined}
        />
        <CopyRow label="AE Title do PACS (destino)" value={pacsAe} id="pacsae" hint="Onde o aparelho busca a fila e envia as imagens." />
        <div className="p-3 rounded-xl bg-ink-50 border border-ink-100 space-y-2">
          <div>
            <p className="text-[9px] font-black text-ink-400 uppercase tracking-widest">AE Title do aparelho (origem)</p>
            <p className="text-[10px] text-ink-400">Identidade do seu ultrassom na rede DICOM — edite para o AE real do seu aparelho.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="input h-9 text-sm font-mono flex-1 uppercase"
              value={aeInput}
              onChange={(e) => setAeInput(e.target.value.toUpperCase())}
              placeholder="Ex: MINDRAYMX7"
              spellCheck={false}
            />
            <button
              onClick={saveDeviceAe}
              disabled={savingAe || !aeInput.trim() || aeInput.trim().toUpperCase() === deviceAe}
              className="h-9 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-black text-[10px] uppercase tracking-wider transition-all"
            >
              {savingAe ? '…' : 'Salvar'}
            </button>
            <button
              onClick={() => copy(aeInput || deviceAe, 'devae')}
              className="shrink-0 h-9 px-2.5 rounded-lg bg-white border border-ink-200 text-ink-500 hover:bg-ink-100 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-all"
              title="Copiar"
            >
              {copied === 'devae' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            </button>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100 flex gap-2 text-[11px] text-amber-800 leading-relaxed">
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>O <strong>Endereço/IP</strong> a digitar é o do <strong>relé</strong> na sua rede (ex: <code>192.168.x.x</code>), não a URL da nuvem. Depois, no aparelho, rode <strong>C-ECHO / Verify</strong> — deve dar "Sucesso".</span>
        </div>
      </div>

      {/* Passo 3 — Meus aparelhos */}
      <div className="space-y-2.5">
        <p className="text-[10px] font-black text-ink-500 uppercase tracking-widest">Passo 3 — meus aparelhos</p>
        {devices.length === 0 ? (
          <p className="text-[11px] text-ink-400 italic px-1">Nenhum aparelho cadastrado ainda. Adicione abaixo (opcional — ajuda quando há mais de um).</p>
        ) : (
          <div className="space-y-1.5">
            {devices.map((d) => (
              <div key={d.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-ink-50 border border-ink-100">
                <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                  <Radio size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-ink-800 truncate">{d.name}</p>
                  <p className="text-[10px] font-mono text-ink-400">{d.aeTitle} · {d.modality}</p>
                </div>
                <button onClick={() => removeDevice(d.id)} className="p-1.5 rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
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
    </div>
  );
}
