import { useState, useEffect, FormEvent } from 'react';
import { useApp } from '../../store/app';
import { useDocument } from '../../hooks/useFirestore';
import { addItemWithId, updateItem, generateStandardId } from '../../store/db';
import { PageHeader } from '../../components/PageHeader';
import { Clinic } from '../../types';
import { 
  ArrowLeft, Save, Upload, Building2, MapPin, 
  Globe, FileText, Layout, 
  RotateCcw, Info, CheckCircle2
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '../../lib/firebase';
import { classNames } from '../../utils/format';

interface Props {
  clinicId?: string;
}

const emptyClinic: Omit<Clinic, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  cnpj: '',
  address: {
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
  },
  phone: '',
  email: '',
  logoUrl: '',
  googleDocsTemplateId: '',
  googleDriveFolderId: '',
  headerHtml: '',
  footerHtml: '',
  active: true,
};

export function ClinicForm({ clinicId }: Props) {
  const { setView, showToast } = useApp();
  const isEditing = !!clinicId;

  const { data: existing, loading: loadingExisting } = useDocument<Clinic>('clinics', clinicId);

  const [draft, setDraft] = useState<Omit<Clinic, 'id' | 'createdAt' | 'updatedAt'>>({ ...emptyClinic });
  const [uploading, setUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setDraft({
        name: existing.name,
        cnpj: existing.cnpj || '',
        address: existing.address || emptyClinic.address,
        phone: existing.phone || '',
        email: existing.email || '',
        logoUrl: existing.logoUrl || '',
        googleDocsTemplateId: existing.googleDocsTemplateId || '',
        googleDriveFolderId: existing.googleDriveFolderId || '',
        headerHtml: existing.headerHtml || '',
        footerHtml: existing.footerHtml || '',
        active: existing.active ?? true,
      });
    }
  }, [existing]);

  function u<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function ua<K extends keyof NonNullable<typeof draft.address>>(key: K, value: string) {
    setDraft((d) => ({ ...d, address: { ...d.address, [key]: value } }));
  }

  async function handleLogoUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      showToast('Selecione uma imagem válida', 'error');
      return;
    }
    setUploading(true);
    try {
      const uid = auth.currentUser?.uid;
      const path = `users/${uid}/clinic-logos/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      u('logoUrl', url);
      showToast('Logo enviado com sucesso', 'success');
    } catch (err: any) {
      console.error('Erro de upload da logo:', err);
      showToast('Erro de permissão no Storage. Cole a URL do logotipo abaixo como alternativa.', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) {
      showToast('Nome da clínica é obrigatório', 'error');
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing && clinicId) {
        await updateItem('clinics', clinicId, draft);
        showToast('Unidade atualizada', 'success');
      } else {
        const id = generateStandardId('CLI');
        await addItemWithId('clinics', id, draft);
        showToast('Unidade cadastrada com sucesso', 'success');
      }
      setView({ name: 'clinics' });
    } catch (err) {
      showToast('Erro ao salvar unidade', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  if (loadingExisting) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        <p className="text-ink-400 font-bold uppercase tracking-widest text-xs">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="module-container">
      <div className="max-w-7xl mx-auto w-full animate-fade-in space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setView({ name: 'clinics' })}
          className="p-2.5 rounded-2xl bg-white border border-ink-100 text-ink-500 hover:text-brand-600 hover:border-brand-100 hover:shadow-sm transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-black text-ink-900 leading-tight">
            {isEditing ? 'Editar Unidade' : 'Nova Unidade'}
          </h2>
          <p className="text-sm text-ink-500">Configure os dados cadastrais e integrações da clínica.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Data */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Identificação & Contato */}
          <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                <Building2 size={20} />
              </div>
              <h3 className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Identificação & Contato</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="label">Nome da Unidade *</label>
                <input
                  className="input h-14 text-lg font-bold"
                  required
                  value={draft.name}
                  onChange={(e) => u('name', e.target.value)}
                  placeholder="Ex: Clínica São Lucas"
                />
              </div>
              <div>
                <label className="label">CNPJ</label>
                <input
                  className="input h-12"
                  value={draft.cnpj}
                  onChange={(e) => u('cnpj', e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <label className="label">Telefone de Contato</label>
                <input
                  className="input h-12"
                  value={draft.phone}
                  onChange={(e) => u('phone', e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">E-mail Administrativo</label>
                <input
                  type="email"
                  className="input h-12"
                  value={draft.email}
                  onChange={(e) => u('email', e.target.value)}
                  placeholder="adm@clinica.com.br"
                />
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <MapPin size={20} />
              </div>
              <h3 className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Endereço & Localização</h3>
            </div>

            <div className="grid grid-cols-6 gap-6">
              <div className="col-span-4">
                <label className="label">Logradouro</label>
                <input className="input h-12" value={draft.address?.street} onChange={(e) => ua('street', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">Número</label>
                <input className="input h-12" value={draft.address?.number} onChange={(e) => ua('number', e.target.value)} />
              </div>
              <div className="col-span-3">
                <label className="label">Bairro</label>
                <input className="input h-12" value={draft.address?.neighborhood} onChange={(e) => ua('neighborhood', e.target.value)} />
              </div>
              <div className="col-span-3">
                <label className="label">Complemento</label>
                <input className="input h-12" value={draft.address?.complement} onChange={(e) => ua('complement', e.target.value)} />
              </div>
              <div className="col-span-3">
                <label className="label">Cidade</label>
                <input className="input h-12" value={draft.address?.city} onChange={(e) => ua('city', e.target.value)} />
              </div>
              <div className="col-span-1">
                <label className="label">UF</label>
                <input className="input h-12 text-center" maxLength={2} value={draft.address?.state} onChange={(e) => ua('state', e.target.value.toUpperCase())} />
              </div>
              <div className="col-span-2">
                <label className="label">CEP</label>
                <input className="input h-12" value={draft.address?.zipCode} onChange={(e) => ua('zipCode', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Google Integration */}
          <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Globe size={20} />
              </div>
              <h3 className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Integração Google Cloud</h3>
            </div>
            <p className="text-xs text-ink-500 mb-8 max-w-lg">
              Vincule um template do Google Docs e uma pasta no Drive para que os laudos desta unidade sejam gerados e salvos automaticamente.
            </p>

            <div className="space-y-6">
              <div>
                <label className="label flex items-center justify-between">
                  ID do Template Google Docs
                  <Info size={12} className="text-ink-400" />
                </label>
                <input
                  className="input h-12 font-mono text-sm bg-ink-50/50"
                  value={draft.googleDocsTemplateId}
                  onChange={(e) => {
                    const val = e.target.value;
                    const match = val.match(/[-\w]{25,}/);
                    u('googleDocsTemplateId', match ? match[0] : val);
                  }}
                  placeholder="Cole o ID ou URL do documento"
                />
              </div>
              <div>
                <label className="label flex items-center justify-between">
                  ID da Pasta no Google Drive
                  <Info size={12} className="text-ink-400" />
                </label>
                <input
                  className="input h-12 font-mono text-sm bg-ink-50/50"
                  value={draft.googleDriveFolderId}
                  onChange={(e) => {
                    const val = e.target.value;
                    const match = val.match(/[-\w]{25,}/);
                    u('googleDriveFolderId', match ? match[0] : val);
                  }}
                  placeholder="Cole o ID ou URL da pasta"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Logo & Status */}
        <div className="lg:col-span-1 space-y-8">
          {/* Logo Card */}
          <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8 text-center">
            <h3 className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-6">Logotipo da Unidade</h3>
             <div className="flex flex-col items-center gap-6">
              <div className="relative group">
                <div className="w-32 h-32 rounded-3xl bg-ink-50 border-2 border-dashed border-ink-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-brand-400">
                  {draft.logoUrl ? (
                    <img src={draft.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 size={32} className="text-ink-300" />
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                      <Loader2 size={24} className="animate-spin text-brand-600" />
                    </div>
                  )}
                </div>
              </div>
              
              <label className="w-full py-3 rounded-2xl bg-ink-50 text-ink-600 border border-ink-100 font-bold text-xs hover:bg-ink-100 transition-all flex items-center justify-center gap-2 cursor-pointer">
                <Upload size={14} />
                {uploading ? 'Enviando...' : 'Alterar Logotipo'}
                <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                }} />
              </label>

              <div className="w-full text-left">
                <label className="text-[9px] font-black text-ink-400 uppercase tracking-widest block mb-1">Ou Cole a URL Direta</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-brand-500 text-[11px] font-bold text-slate-700 shadow-inner"
                  placeholder="https://exemplo.com/logo.png"
                  value={draft.logoUrl || ''}
                  onChange={(e) => u('logoUrl', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Status & Settings */}
          <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8 space-y-6">
            <div>
              <h3 className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-4">Status da Unidade</h3>
              <button
                type="button"
                onClick={() => u('active', !draft.active)}
                className={classNames(
                  "w-full py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-3 border",
                  draft.active ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-ink-50 text-ink-400 border-ink-100"
                )}
              >
                {draft.active ? <CheckCircle2 size={16} /> : <RotateCcw size={16} />}
                {draft.active ? 'Unidade Ativa' : 'Unidade Inativa'}
              </button>
            </div>

            <div className="pt-6 border-t border-ink-50">
               <h3 className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-4">Cabeçalho & Rodapé Custom</h3>
               <div className="space-y-4">
                 <div>
                   <label className="text-[10px] font-bold text-ink-500 uppercase flex items-center gap-1 mb-2">
                     <Layout size={10} /> HTML Superior
                   </label>
                   <textarea
                    className="input font-mono text-[10px] min-h-[80px] p-4 bg-ink-50/50"
                    value={draft.headerHtml || ''}
                    onChange={(e) => u('headerHtml', e.target.value)}
                    placeholder="HTML para o topo do laudo..."
                   />
                 </div>
                 <div>
                   <label className="text-[10px] font-bold text-ink-500 uppercase flex items-center gap-1 mb-2">
                     <FileText size={10} /> HTML Inferior
                   </label>
                   <textarea
                    className="input font-mono text-[10px] min-h-[60px] p-4 bg-ink-50/50"
                    value={draft.footerHtml || ''}
                    onChange={(e) => u('footerHtml', e.target.value)}
                    placeholder="HTML para o rodapé..."
                   />
                 </div>
               </div>
            </div>
          </div>

          {/* Save Action */}
          <div className="pt-4 sticky bottom-8">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full h-16 bg-brand-600 text-white rounded-3xl font-black text-lg shadow-premium hover:bg-brand-700 hover:shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
              Salvar Alterações
            </button>
          </div>
        </div>
      </form>
      </div>
    </div>
  );
}

function Loader2({ size, className }: { size: number; className?: string }) {
  return <RotateCcw size={size} className={classNames("animate-spin", className)} />;
}
