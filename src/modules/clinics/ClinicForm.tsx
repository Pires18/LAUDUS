import { useState, useEffect, FormEvent } from 'react';
import { useApp } from '../../store/app';
import { useDocument } from '../../hooks/useFirestore';
import { addItemWithId, updateItem, generateStandardId } from '../../store/db';
import { Clinic } from '../../types';
import {
  ArrowLeft, Save, Upload, Building2, MapPin,
  Globe, FileText, Layout,
  RotateCcw, Info, CheckCircle2, MousePointerClick
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { logger } from '../../utils/logger';
import { storage, auth } from '../../lib/firebase';
import { classNames } from '../../utils/format';
import { pickGoogleDoc, pickGoogleFolder } from '../../lib/googlePicker';

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
  headerImageUrl: '',
  footerImageUrl: '',
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
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const [uploadingFooter, setUploadingFooter] = useState(false);
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
        headerImageUrl: existing.headerImageUrl || '',
        footerImageUrl: existing.footerImageUrl || '',
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

  const [picking, setPicking] = useState<null | 'doc' | 'folder'>(null);

  async function handlePickTemplate() {
    setPicking('doc');
    try {
      const picked = await pickGoogleDoc();
      if (picked) {
        u('googleDocsTemplateId', picked.id);
        showToast(`Template selecionado: ${picked.name}`, 'success');
      }
    } catch (err: any) {
      logger.error('[ClinicForm] Erro no Picker (template):', err);
      showToast(err?.message || 'Não foi possível abrir o seletor do Google.', 'error');
    } finally {
      setPicking(null);
    }
  }

  async function handlePickFolder() {
    setPicking('folder');
    try {
      const picked = await pickGoogleFolder();
      if (picked) {
        u('googleDriveFolderId', picked.id);
        showToast(`Pasta selecionada: ${picked.name}`, 'success');
      }
    } catch (err: any) {
      logger.error('[ClinicForm] Erro no Picker (pasta):', err);
      showToast(err?.message || 'Não foi possível abrir o seletor do Google.', 'error');
    } finally {
      setPicking(null);
    }
  }

  function compressLogoFile(file: File): Promise<Blob> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              resolve(blob || file);
            },
            file.type === 'image/gif' ? 'image/gif' : 'image/webp',
            0.85
          );
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
  }

  async function handleLogoUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      showToast('Selecione uma imagem válida', 'error');
      return;
    }
    setUploading(true);
    try {
      const compressedBlob = await compressLogoFile(file);
      const uid = auth.currentUser?.uid;
      const fileExtension = file.type === 'image/gif' ? 'gif' : 'webp';
      const cleanFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const path = `users/${uid}/clinic-logos/${Date.now()}_${cleanFileName}.${fileExtension}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, compressedBlob);
      const url = await getDownloadURL(storageRef);
      u('logoUrl', url);
      showToast('Logo enviado com sucesso', 'success');
    } catch (err: any) {
      logger.error('Erro de upload da logo:', err);
      showToast('Erro de permissão no Storage. Cole a URL do logotipo abaixo como alternativa.', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleHeaderUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      showToast('Selecione uma imagem válida', 'error');
      return;
    }
    setUploadingHeader(true);
    try {
      const compressedBlob = await compressLogoFile(file);
      const uid = auth.currentUser?.uid;
      const fileExtension = file.type === 'image/gif' ? 'gif' : 'webp';
      const cleanFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const path = `users/${uid}/clinic-headers/${Date.now()}_${cleanFileName}.${fileExtension}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, compressedBlob);
      const url = await getDownloadURL(storageRef);
      u('headerImageUrl', url);
      showToast('Imagem de cabeçalho enviada com sucesso', 'success');
    } catch (err: any) {
      logger.error('Erro de upload do cabeçalho:', err);
      showToast('Erro de permissão no Storage. Cole a URL do cabeçalho abaixo como alternativa.', 'error');
    } finally {
      setUploadingHeader(false);
    }
  }

  async function handleFooterUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      showToast('Selecione uma imagem válida', 'error');
      return;
    }
    setUploadingFooter(true);
    try {
      const compressedBlob = await compressLogoFile(file);
      const uid = auth.currentUser?.uid;
      const fileExtension = file.type === 'image/gif' ? 'gif' : 'webp';
      const cleanFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const path = `users/${uid}/clinic-footers/${Date.now()}_${cleanFileName}.${fileExtension}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, compressedBlob);
      const url = await getDownloadURL(storageRef);
      u('footerImageUrl', url);
      showToast('Imagem de rodapé enviada com sucesso', 'success');
    } catch (err: any) {
      logger.error('Erro de upload do rodapé:', err);
      showToast('Erro de permissão no Storage. Cole a URL do rodapé abaixo como alternativa.', 'error');
    } finally {
      setUploadingFooter(false);
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
      <div className="max-w-7xl mx-auto w-full animate-fade-in space-y-5">
        
        {/* ─── COMPACT HEADER ─── */}
        <div className="bg-white border border-ink-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setView({ name: 'clinics' })}
                className="w-8 h-8 rounded-xl border border-ink-200 hover:bg-ink-50 text-ink-500 hover:text-ink-700 flex items-center justify-center transition-all shrink-0 active:scale-95"
                title="Voltar"
              >
                <ArrowLeft size={14} />
              </button>
              <div className="min-w-0">
                <h1 className="text-base font-black text-ink-900 tracking-tight leading-none truncate max-w-[200px] sm:max-w-md">
                  {isEditing ? 'Editar Unidade' : 'Nova Unidade'}
                </h1>
                <p className="text-[11px] text-ink-500 font-medium mt-0.5">Configure os dados cadastrais e integrações da clínica.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setView({ name: 'clinics' })}
                className="h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-ink-500 hover:text-ink-700 bg-ink-100 border border-ink-200 hover:bg-ink-200 transition-all flex items-center gap-1.5 active:scale-95"
              >
                Cancelar
              </button>
              <button
                type="submit"
                onClick={handleSave}
                disabled={isSaving}
                className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                Salvar
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left Column: Data */}
          <div className="lg:col-span-2 space-y-5">
            
            {/* Identificação & Contato */}
            <div className="bg-white rounded-2xl border border-ink-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100">
                  <Building2 size={14} />
                </div>
                <h3 className="text-[10px] font-black text-brand-650 uppercase tracking-widest">Identificação & Contato</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="label">Nome da Unidade *</label>
                  <input
                    className="input h-11 text-base font-bold"
                    required
                    value={draft.name}
                    onChange={(e) => u('name', e.target.value)}
                    placeholder="Ex: Clínica São Lucas"
                  />
                </div>
                <div>
                  <label className="label">CNPJ</label>
                  <input
                    className="input h-10 font-mono text-sm"
                    value={draft.cnpj}
                    onChange={(e) => u('cnpj', e.target.value)}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div>
                  <label className="label">Telefone de Contato</label>
                  <input
                    className="input h-10 text-sm"
                    value={draft.phone}
                    onChange={(e) => u('phone', e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">E-mail Administrativo</label>
                  <input
                    type="email"
                    className="input h-10 text-sm"
                    value={draft.email}
                    onChange={(e) => u('email', e.target.value)}
                    placeholder="adm@clinica.com.br"
                  />
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div className="bg-white rounded-2xl border border-ink-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                  <MapPin size={14} />
                </div>
                <h3 className="text-[10px] font-black text-brand-650 uppercase tracking-widest">Endereço & Localização</h3>
              </div>

              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-4">
                  <label className="label">Logradouro</label>
                  <input className="input h-10 text-sm" value={draft.address?.street} onChange={(e) => ua('street', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label">Número</label>
                  <input className="input h-10 text-sm" value={draft.address?.number} onChange={(e) => ua('number', e.target.value)} />
                </div>
                <div className="col-span-3">
                  <label className="label">Bairro</label>
                  <input className="input h-10 text-sm" value={draft.address?.neighborhood} onChange={(e) => ua('neighborhood', e.target.value)} />
                </div>
                <div className="col-span-3">
                  <label className="label">Complemento</label>
                  <input className="input h-10 text-sm" value={draft.address?.complement} onChange={(e) => ua('complement', e.target.value)} />
                </div>
                <div className="col-span-3">
                  <label className="label">Cidade</label>
                  <input className="input h-10 text-sm" value={draft.address?.city} onChange={(e) => ua('city', e.target.value)} />
                </div>
                <div className="col-span-1">
                  <label className="label">UF</label>
                  <input className="input h-10 text-center text-sm" maxLength={2} value={draft.address?.state} onChange={(e) => ua('state', e.target.value.toUpperCase())} />
                </div>
                <div className="col-span-2">
                  <label className="label">CEP</label>
                  <input className="input h-10 text-sm" value={draft.address?.zipCode} onChange={(e) => ua('zipCode', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Google Integration */}
            <div className="bg-white rounded-2xl border border-ink-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <Globe size={14} />
                </div>
                <h3 className="text-[10px] font-black text-brand-650 uppercase tracking-widest">Integração Google Cloud</h3>
              </div>
              <p className="text-xs text-ink-500 max-w-lg leading-relaxed">
                Selecione um template do Google Docs e uma pasta no Drive para que os laudos desta unidade sejam gerados e salvos automaticamente. Use o botão <strong>Selecionar</strong> — ao escolher pelo Google, o app recebe acesso somente àquele arquivo/pasta (permissão mínima).
              </p>

              <div className="space-y-4">
                <div>
                  <label className="label flex items-center justify-between">
                    Template do Google Docs
                    <Info size={11} className="text-ink-400" />
                  </label>
                  <div className="flex gap-2">
                    <input
                      className="input h-10 font-mono text-xs bg-ink-50/50 flex-1"
                      value={draft.googleDocsTemplateId}
                      readOnly
                      placeholder="Nenhum template selecionado"
                    />
                    <button
                      type="button"
                      onClick={handlePickTemplate}
                      disabled={picking !== null}
                      className="btn-secondary h-10 px-3 shrink-0 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <MousePointerClick size={13} />
                      {picking === 'doc' ? 'Abrindo…' : 'Selecionar'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label flex items-center justify-between">
                    Pasta no Google Drive
                    <Info size={11} className="text-ink-400" />
                  </label>
                  <div className="flex gap-2">
                    <input
                      className="input h-10 font-mono text-xs bg-ink-50/50 flex-1"
                      value={draft.googleDriveFolderId}
                      readOnly
                      placeholder="Nenhuma pasta selecionada"
                    />
                    <button
                      type="button"
                      onClick={handlePickFolder}
                      disabled={picking !== null}
                      className="btn-secondary h-10 px-3 shrink-0 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <MousePointerClick size={13} />
                      {picking === 'folder' ? 'Abrindo…' : 'Selecionar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Logo & Status */}
          <div className="lg:col-span-1 space-y-5">
            {/* Logo Card */}
            <div className="bg-white rounded-2xl border border-ink-200 shadow-sm p-5 text-center space-y-4">
              <h3 className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Logotipo da Unidade</h3>
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <div className="w-28 h-28 rounded-xl bg-ink-50 border-2 border-dashed border-ink-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-brand-400">
                    {draft.logoUrl ? (
                      <img src={draft.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 size={24} className="text-ink-300" />
                    )}
                    {uploading && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                        <Loader2 size={16} className="animate-spin text-brand-650" />
                      </div>
                    )}
                  </div>
                </div>
                
                <label className="w-full py-2 rounded-xl bg-ink-50 text-ink-600 border border-ink-200 font-bold text-xs hover:bg-ink-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                  <Upload size={13} />
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
                    className="w-full px-3 py-1.5 bg-ink-50 border border-ink-250 rounded-lg outline-none focus:border-brand-500 text-[11px] font-bold text-ink-700 shadow-inner"
                    placeholder="https://exemplo.com/logo.png"
                    value={draft.logoUrl || ''}
                    onChange={(e) => u('logoUrl', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Header Image Card */}
            <div className="bg-white rounded-2xl border border-ink-200 shadow-sm p-5 text-center space-y-4">
              <h3 className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Cabeçalho da Unidade (Banner Imagem)</h3>
              <div className="flex flex-col items-center gap-4">
                <div className="relative group w-full">
                  <div className="w-full h-16 bg-ink-50 border-2 border-dashed border-ink-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-brand-400 rounded-xl">
                    {draft.headerImageUrl ? (
                      <img src={draft.headerImageUrl} alt="Cabeçalho Banner" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-ink-300 font-bold uppercase">Sem imagem de cabeçalho</span>
                    )}
                    {uploadingHeader && (
                      <div className="absolute inset-0 bg-white/85 flex items-center justify-center">
                        <Loader2 size={16} className="animate-spin text-brand-650" />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 w-full">
                  <label className="flex-1 py-2 rounded-xl bg-ink-50 text-ink-600 border border-ink-200 font-bold text-xs hover:bg-ink-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                    <Upload size={13} />
                    {uploadingHeader ? 'Enviando...' : 'Carregar Imagem'}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingHeader} onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleHeaderUpload(file);
                    }} />
                  </label>
                  {draft.headerImageUrl && (
                    <button
                      type="button"
                      onClick={() => u('headerImageUrl', '')}
                      className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-650 border border-red-200 transition-all text-xs font-bold"
                    >
                      Remover
                    </button>
                  )}
                </div>

                <div className="w-full text-left">
                  <label className="text-[9px] font-black text-ink-400 uppercase tracking-widest block mb-1">Ou URL do Cabeçalho</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 bg-ink-50 border border-ink-250 rounded-lg outline-none focus:border-brand-500 text-[11px] font-bold text-ink-700 shadow-inner"
                    placeholder="https://exemplo.com/cabecalho.png"
                    value={draft.headerImageUrl || ''}
                    onChange={(e) => u('headerImageUrl', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Footer Image Card */}
            <div className="bg-white rounded-2xl border border-ink-200 shadow-sm p-5 text-center space-y-4">
              <h3 className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Rodapé da Unidade (Banner Imagem)</h3>
              <div className="flex flex-col items-center gap-4">
                <div className="relative group w-full">
                  <div className="w-full h-12 bg-ink-50 border-2 border-dashed border-ink-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-brand-400 rounded-xl">
                    {draft.footerImageUrl ? (
                      <img src={draft.footerImageUrl} alt="Rodapé Banner" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-ink-300 font-bold uppercase">Sem imagem de rodapé</span>
                    )}
                    {uploadingFooter && (
                      <div className="absolute inset-0 bg-white/85 flex items-center justify-center">
                        <Loader2 size={16} className="animate-spin text-brand-650" />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 w-full">
                  <label className="flex-1 py-2 rounded-xl bg-ink-50 text-ink-600 border border-ink-200 font-bold text-xs hover:bg-ink-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                    <Upload size={13} />
                    {uploadingFooter ? 'Enviando...' : 'Carregar Imagem'}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingFooter} onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFooterUpload(file);
                    }} />
                  </label>
                  {draft.footerImageUrl && (
                    <button
                      type="button"
                      onClick={() => u('footerImageUrl', '')}
                      className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-650 border border-red-200 transition-all text-xs font-bold"
                    >
                      Remover
                    </button>
                  )}
                </div>

                <div className="w-full text-left">
                  <label className="text-[9px] font-black text-ink-400 uppercase tracking-widest block mb-1">Ou URL do Rodapé</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 bg-ink-50 border border-ink-250 rounded-lg outline-none focus:border-brand-500 text-[11px] font-bold text-ink-700 shadow-inner"
                    placeholder="https://exemplo.com/rodape.png"
                    value={draft.footerImageUrl || ''}
                    onChange={(e) => u('footerImageUrl', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Status & Settings */}
            <div className="bg-white rounded-2xl border border-ink-200 shadow-sm p-5 space-y-4">
              <div>
                <h3 className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-3">Status da Unidade</h3>
                <button
                  type="button"
                  onClick={() => u('active', !draft.active)}
                  className={classNames(
                    "w-full py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 border",
                    draft.active ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-ink-50 text-ink-400 border-ink-200"
                  )}
                >
                  {draft.active ? <CheckCircle2 size={13} /> : <RotateCcw size={13} />}
                  {draft.active ? 'Unidade Ativa' : 'Unidade Inativa'}
                </button>
              </div>

              <div className="pt-4 border-t border-ink-100">
                <h3 className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-3">Cabeçalho & Rodapé Custom</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-ink-500 uppercase flex items-center gap-1 mb-2">
                      <Layout size={10} /> HTML Superior
                    </label>
                    <textarea
                      className="input font-mono text-[10px] min-h-[70px] p-3 bg-ink-50/50"
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
                      className="input font-mono text-[10px] min-h-[50px] p-3 bg-ink-50/50"
                      value={draft.footerHtml || ''}
                      onChange={(e) => u('footerHtml', e.target.value)}
                      placeholder="HTML para o rodapé..."
                    />
                  </div>
                </div>
              </div>
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
