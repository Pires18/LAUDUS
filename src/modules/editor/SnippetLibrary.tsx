import { useState, useMemo } from 'react';
import { useApp } from '../../store/app';
import { Search, Plus, Trash2, Edit2, CheckCircle2, MessageSquareText } from 'lucide-react';
import { EXAM_AREAS } from '../../types';
import { classNames } from '../../utils/format';

interface Props {
  onInsert: (text: string) => void;
}

export function SnippetLibrary({ onInsert }: Props) {
  const { settings, loadSettings, updateSettings, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('todas');
  
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', content: '', area: 'geral' });

  const snippets = settings.snippets || [];

  const filtered = useMemo(() => {
    return snippets.filter(s => {
      if (areaFilter !== 'todas' && s.area !== areaFilter && s.area !== 'geral') return false;
      if (search) {
        const q = search.toLowerCase();
        return s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q);
      }
      return true;
    });
  }, [snippets, search, areaFilter]);

  async function handleSave() {
    if (!editForm.title.trim() || !editForm.content.trim()) {
      showToast('Preencha título e conteúdo', 'error');
      return;
    }

    const newSnippets = [...snippets];
    if (isEditing === 'new') {
      newSnippets.push({
        id: crypto.randomUUID(),
        ...editForm
      });
    } else {
      const idx = newSnippets.findIndex(s => s.id === isEditing);
      if (idx >= 0) {
        newSnippets[idx] = { ...newSnippets[idx], ...editForm };
      }
    }

    try {
      await updateSettings({ snippets: newSnippets });
      await loadSettings();
      setIsEditing(null);
      showToast('Snippet salvo', 'success');
    } catch {
      showToast('Erro ao salvar', 'error');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este snippet?')) return;
    const newSnippets = snippets.filter(s => s.id !== id);
    try {
      await updateSettings({ snippets: newSnippets });
      await loadSettings();
      showToast('Snippet excluído', 'success');
    } catch {
      showToast('Erro ao excluir', 'error');
    }
  }

  if (isEditing) {
    return (
      <div className="p-4 space-y-4 border-l border-ink-100 bg-white h-full flex flex-col w-80 shrink-0">
        <h3 className="font-semibold text-ink-900">
          {isEditing === 'new' ? 'Novo Snippet' : 'Editar Snippet'}
        </h3>
        
        <div className="space-y-3 flex-1 overflow-y-auto">
          <div>
            <label className="label">Título Curto *</label>
            <input
              className="input text-sm"
              value={editForm.title}
              onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Fígado normal"
            />
          </div>
          
          <div>
            <label className="label">Área</label>
            <select
              className="input text-sm"
              value={editForm.area}
              onChange={e => setEditForm(prev => ({ ...prev, area: e.target.value }))}
            >
              <option value="geral">Geral (todas as áreas)</option>
              {EXAM_AREAS.map(a => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="label">Texto *</label>
            <textarea
              className="input text-sm font-mono h-32 leading-relaxed"
              value={editForm.content}
              onChange={e => setEditForm(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Fígado com dimensões normais, contornos regulares e ecotextura homogênea."
            />
          </div>
        </div>

        <div className="flex gap-2 shrink-0 pt-2 border-t border-ink-100">
          <button onClick={() => setIsEditing(null)} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleSave} className="btn-primary flex-1">Salvar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-ink-50/50 border-l border-ink-100 w-80 shrink-0">
      <div className="p-3 border-b border-ink-100 bg-white shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-ink-900 flex items-center gap-2">
            <MessageSquareText size={16} className="text-brand-500" /> Frases Prontas
          </h3>
          <button
            onClick={() => {
              setEditForm({ title: '', content: '', area: areaFilter !== 'todas' ? areaFilter : 'geral' });
              setIsEditing('new');
            }}
            className="p-1 rounded hover:bg-ink-100 text-brand-600"
            title="Novo Snippet"
          >
            <Plus size={16} />
          </button>
        </div>
        
        <div className="space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-8 py-1.5 text-xs bg-ink-50 border-transparent focus:bg-white"
              placeholder="Buscar frase..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input py-1.5 text-[11px] bg-white w-full"
            value={areaFilter}
            onChange={e => setAreaFilter(e.target.value)}
          >
            <option value="todas">Todas as áreas</option>
            <option value="geral">Apenas Geral</option>
            {EXAM_AREAS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 px-4 text-ink-400 text-xs">
            {search ? 'Nenhuma frase encontrada.' : 'Nenhuma frase cadastrada para esta área.'}
          </div>
        ) : (
          filtered.map(s => (
            <div key={s.id} className="bg-white border border-ink-100 rounded-lg p-2.5 shadow-sm group">
              <div className="flex items-start justify-between mb-1.5">
                <span className="text-xs font-semibold text-ink-900">{s.title}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditForm(s as any); setIsEditing(s.id); }}
                    className="p-1 text-ink-400 hover:text-brand-600 rounded hover:bg-brand-50"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="p-1 text-ink-400 hover:text-red-600 rounded hover:bg-red-50"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-ink-500 line-clamp-3 mb-2">{s.content}</p>
              <button
                onClick={() => {
                  onInsert(s.content);
                  showToast('Frase inserida', 'success');
                }}
                className="w-full py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 text-[10px] font-bold rounded-md transition-colors"
              >
                Inserir no Laudo
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
