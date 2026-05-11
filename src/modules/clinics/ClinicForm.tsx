import { useState, useEffect, FormEvent } from 'react';
import { useApp } from '../../store/app';
import { useDocument } from '../../hooks/useFirestore';
import { addItemWithId, updateItem, generateStandardId } from '../../store/db';
import { PageHeader } from '../../components/PageHeader';
import { Clinic } from '../../types';
import { ArrowLeft, Save, Upload, Building2 } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '../../lib/firebase';

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

  const { data: existing } = useDocument<Clinic>('clinics', clinicId);

  const [draft, setDraft] = useState<Omit<Clinic, 'id' | 'createdAt' | 'updatedAt'>>(
    existing
      ? {
          name: existing.name,
          cnpj: existing.cnpj,
          address: existing.address || emptyClinic.address,
          phone: existing.phone,
          email: existing.email,
          logoUrl: existing.logoUrl,
          googleDocsTemplateId: existing.googleDocsTemplateId,
          googleDriveFolderId: existing.googleDriveFolderId,
          headerHtml: existing.headerHtml,
          footerHtml: existing.footerHtml,
          active: existing.active,
        }
      : { ...emptyClinic }
  );

  const [uploading, setUploading] = useState(false);

  // Sync with existing data when it loads
  useEffect(() => {
    if (existing) {
      setDraft({
        name: existing.name,
        cnpj: existing.cnpj,
        address: existing.address || emptyClinic.address,
        phone: existing.phone,
        email: existing.email,
        logoUrl: existing.logoUrl,
        googleDocsTemplateId: existing.googleDocsTemplateId,
        googleDriveFolderId: existing.googleDriveFolderId,
        headerHtml: existing.headerHtml,
        footerHtml: existing.footerHtml,
        active: existing.active,
      });
    }
  }, [existing]);

  function u<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function ua<K extends keyof NonNullable<typeof draft.address>>(
    key: K,
    value: string
  ) {
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
      showToast('Logo enviado', 'success');
    } catch (err) {
      showToast('Erro ao enviar logo', 'error');
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

    try {
      if (isEditing && clinicId) {
        await updateItem('clinics', clinicId, draft);
        showToast('Clínica atualizada', 'success');
      } else {
        const id = generateStandardId('CLI');
        await addItemWithId('clinics', id, draft);
        showToast('Clínica cadastrada', 'success');
      }
      setView({ name: 'clinics' });
    } catch (err) {
      showToast('Erro ao salvar clínica', 'error');
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
        title={isEditing ? 'Editar Clínica' : 'Nova Clínica'}
        actions={
          <button onClick={handleSave} className="btn-primary">
            <Save size={15} /> Salvar Clínica
          </button>
        }
      />

      <form onSubmit={handleSave} className="grid grid-cols-3 gap-5">
        {/* Col esquerda: dados principais */}
        <div className="col-span-2 space-y-4">
          {/* Identificação */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-900 mb-4">Identificação</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Nome da Clínica *</label>
                <input
                  className="input"
                  required
                  value={draft.name}
                  onChange={(e) => u('name', e.target.value)}
                  placeholder="Ex: Clínica São Lucas"
                />
              </div>
              <div>
                <label className="label">CNPJ</label>
                <input
                  className="input"
                  value={draft.cnpj ?? ''}
                  onChange={(e) => u('cnpj', e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <label className="label">Telefone</label>
                <input
                  className="input"
                  value={draft.phone ?? ''}
                  onChange={(e) => u('phone', e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="col-span-2">
                <label className="label">E-mail</label>
                <input
                  type="email"
                  className="input"
                  value={draft.email ?? ''}
                  onChange={(e) => u('email', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-900 mb-4">Endereço</h3>
            <div className="grid grid-cols-6 gap-3">
              <div className="col-span-4">
                <label className="label">Logradouro</label>
                <input
                  className="input"
                  value={draft.address?.street ?? ''}
                  onChange={(e) => ua('street', e.target.value)}
                />
              </div>
              <div className="col-span-1">
                <label className="label">Número</label>
                <input
                  className="input"
                  value={draft.address?.number ?? ''}
                  onChange={(e) => ua('number', e.target.value)}
                />
              </div>
              <div className="col-span-1">
                <label className="label">CEP</label>
                <input
                  className="input"
                  value={draft.address?.zipCode ?? ''}
                  onChange={(e) => ua('zipCode', e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className="label">Complemento</label>
                <input
                  className="input"
                  value={draft.address?.complement ?? ''}
                  onChange={(e) => ua('complement', e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className="label">Bairro</label>
                <input
                  className="input"
                  value={draft.address?.neighborhood ?? ''}
                  onChange={(e) => ua('neighborhood', e.target.value)}
                />
              </div>
              <div className="col-span-1">
                <label className="label">Cidade</label>
                <input
                  className="input"
                  value={draft.address?.city ?? ''}
                  onChange={(e) => ua('city', e.target.value)}
                />
              </div>
              <div className="col-span-1">
                <label className="label">UF</label>
                <input
                  className="input"
                  maxLength={2}
                  value={draft.address?.state ?? ''}
                  onChange={(e) => ua('state', e.target.value.toUpperCase())}
                />
              </div>
            </div>
          </div>

          {/* Google Integration */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-900 mb-1">Integração Google</h3>
            <p className="text-xs text-ink-500 mb-4">
              Vincule um template do Google Docs e uma pasta no Drive para esta clínica.
            </p>
            <div className="space-y-3">
              <div>
                <label className="label">ID do Template Google Docs</label>
                <input
                  className="input font-mono text-xs"
                  value={draft.googleDocsTemplateId ?? ''}
                  onChange={(e) => {
                    // Extract ID if user pastes full URL: https://docs.google.com/document/d/ID_AQUI/edit
                    const val = e.target.value;
                    const match = val.match(/[-\w]{25,}/);
                    u('googleDocsTemplateId', match ? match[0] : val);
                  }}
                  placeholder="Cole o ID do documento (da URL do Google Docs)"
                />
                <p className="text-xs text-ink-400 mt-1">
                  O ID fica na URL do Google Docs: docs.google.com/document/d/<strong>ID_AQUI</strong>/edit
                </p>
              </div>
              <div>
                <label className="label">ID da Pasta Google Drive</label>
                <input
                  className="input font-mono text-xs"
                  value={draft.googleDriveFolderId ?? ''}
                  onChange={(e) => {
                    // Extract ID if user pastes full URL: https://drive.google.com/drive/folders/ID_AQUI
                    const val = e.target.value;
                    const match = val.match(/[-\w]{25,}/);
                    u('googleDriveFolderId', match ? match[0] : val);
                  }}
                  placeholder="Cole o ID da pasta do Drive"
                />
                <p className="text-xs text-ink-400 mt-1">
                  O ID fica na URL da pasta: drive.google.com/drive/folders/<strong>ID_AQUI</strong>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Col direita: logo + status */}
        <div className="col-span-1 space-y-4">
          {/* Logo upload */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-900 mb-4">Logo</h3>
            <div className="flex flex-col items-center gap-3">
              {draft.logoUrl ? (
                <img
                  src={draft.logoUrl}
                  alt="Logo da clínica"
                  className="w-32 h-32 rounded-xl object-cover border border-ink-100 shadow-soft"
                />
              ) : (
                <div className="w-32 h-32 rounded-xl bg-gradient-to-br from-ink-50 to-ink-100 border-2 border-dashed border-ink-200 flex items-center justify-center">
                  <Building2 size={32} className="text-ink-300" />
                </div>
              )}
              <label className="btn-secondary cursor-pointer text-xs">
                <Upload size={13} />
                {uploading ? 'Enviando...' : 'Upload Logo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          {/* Status */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-900 mb-4">Status</h3>
            <label className="inline-flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => u('active', e.target.checked)}
                className="accent-brand-600 w-5 h-5"
              />
              <div>
                <span className="text-sm font-medium text-ink-800">Clínica ativa</span>
                <p className="text-xs text-ink-500">Clínicas inativas não aparecem nos filtros.</p>
              </div>
            </label>
          </div>

          {/* Cabeçalho/Rodapé customizado */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-900 mb-3">Cabeçalho do Laudo</h3>
            <textarea
              className="input min-h-[80px] resize-none text-xs font-mono"
              rows={3}
              placeholder="HTML do cabeçalho (opcional)"
              value={draft.headerHtml ?? ''}
              onChange={(e) => u('headerHtml', e.target.value)}
            />
            <h3 className="text-sm font-semibold text-ink-900 mt-4 mb-3">Rodapé do Laudo</h3>
            <textarea
              className="input min-h-[60px] resize-none text-xs font-mono"
              rows={2}
              placeholder="HTML do rodapé (opcional)"
              value={draft.footerHtml ?? ''}
              onChange={(e) => u('footerHtml', e.target.value)}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
