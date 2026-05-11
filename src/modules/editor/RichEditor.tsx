import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { useEffect, ReactNode, forwardRef, useImperativeHandle } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Heading2, Heading3, AlignLeft, AlignCenter, AlignJustify,
  Undo2, Redo2
} from 'lucide-react';
import { classNames } from '../../utils/format';

interface Props {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
}
export interface RichEditorRef {
  insertContent: (content: string) => void;
}

export const RichEditor = forwardRef<RichEditorRef, Props>(({ content, onChange, editable = true }, ref) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Placeholder.configure({
        placeholder: 'O laudo aparecerá aqui depois de gerado pela IA. Você também pode escrever ou editar livremente.',
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: 'focus:outline-none' },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (content !== editor.getHTML()) {
      editor.commands.setContent(content || '', false);
    }
  }, [content, editor]);
  useImperativeHandle(ref, () => ({
    insertContent: (text: string) => {
      if (editor) {
        editor.chain().focus().insertContent(text).run();
      }
    }
  }));

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full">
      <Toolbar editor={editor} />
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto my-4 bg-white shadow-soft rounded-lg border border-ink-100">
          <EditorContent editor={editor} />
        </div>
        {/* Bottom padding for scroll space */}
        <div className="h-16" />
      </div>
    </div>
  );
});

/* ── Toolbar button ── */
interface ToolbarBtnProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
  title?: string;
}

function ToolbarBtn({ onClick, active, disabled, children, title }: ToolbarBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={classNames(
        'p-1.5 rounded transition-colors shrink-0',
        active ? 'bg-brand-100 text-brand-700' : 'text-ink-600 hover:bg-ink-100',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-4 bg-ink-200 mx-0.5 shrink-0" />;
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = 14; // icon size
  return (
    <div className="border-b border-ink-100 px-3 py-1 flex items-center gap-0.5 bg-white shrink-0 overflow-x-auto">
      <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Desfazer"><Undo2 size={s} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Refazer"><Redo2 size={s} /></ToolbarBtn>
      <Sep />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Título"><Heading2 size={s} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Subtítulo"><Heading3 size={s} /></ToolbarBtn>
      <Sep />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrito (Ctrl+B)"><Bold size={s} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Itálico (Ctrl+I)"><Italic size={s} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Sublinhado (Ctrl+U)"><UnderlineIcon size={s} /></ToolbarBtn>
      <Sep />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista"><List size={s} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada"><ListOrdered size={s} /></ToolbarBtn>
      <Sep />
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Esquerda"><AlignLeft size={s} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Centro"><AlignCenter size={s} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justificado"><AlignJustify size={s} /></ToolbarBtn>
    </div>
  );
}
