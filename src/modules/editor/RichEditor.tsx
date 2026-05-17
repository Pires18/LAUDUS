import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { useEffect, ReactNode, forwardRef, useImperativeHandle } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Heading1, Heading2, Heading3, AlignLeft, AlignCenter, AlignJustify,
  Undo2, Redo2, Type
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
      StarterKit.configure({ 
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Underline,
      Placeholder.configure({
        placeholder: 'Aguardando achados clínicos para gerar o laudo...',
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { 
        class: 'focus:outline-none min-h-[850px] p-12 lg:p-16 prose prose-slate max-w-none prose-sm sm:prose-base' 
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (content !== editor.getHTML()) {
      editor.commands.setContent(content || '', false);
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  useImperativeHandle(ref, () => ({
    insertContent: (text: string) => {
      if (editor) {
        editor.chain().focus().insertContent(text).run();
      }
    }
  }));

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full bg-white relative">
      <Toolbar editor={editor} />
      <div className="flex-1 overflow-y-auto bg-ink-50/20 custom-scrollbar relative">
        {/* Editor Paper Surface */}
        <div className="max-w-[850px] mx-auto my-8 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.05)] border border-ink-100 rounded-sm min-h-[1100px]">
          <EditorContent editor={editor} />
        </div>
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
        'p-2 rounded-lg transition-all shrink-0',
        active ? 'bg-brand-600 text-white shadow-md' : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900',
        disabled && 'opacity-20 cursor-not-allowed grayscale'
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-5 bg-ink-100 mx-1.5 shrink-0" />;
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = 16; // icon size
  return (
    <div className="border-b border-ink-100 px-4 py-2 flex items-center gap-1 bg-white shrink-0 overflow-x-auto z-10 sticky top-0 shadow-sm">
      <div className="flex items-center gap-1 mr-2">
         <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Desfazer"><Undo2 size={s} /></ToolbarBtn>
         <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Refazer"><Redo2 size={s} /></ToolbarBtn>
      </div>
      
      <Sep />

      <div className="flex items-center gap-1">
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Título do Laudo"><Heading1 size={s} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Título de Seção"><Heading2 size={s} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Subtítulo Técnico"><Heading3 size={s} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} title="Texto Normal"><Type size={s} /></ToolbarBtn>
      </div>

      <Sep />

      <div className="flex items-center gap-1">
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrito (Ctrl+B)"><Bold size={s} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Itálico (Ctrl+I)"><Italic size={s} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Sublinhado (Ctrl+U)"><UnderlineIcon size={s} /></ToolbarBtn>
      </div>

      <Sep />

      <div className="flex items-center gap-1">
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista de Tópicos"><List size={s} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista Numerada"><ListOrdered size={s} /></ToolbarBtn>
      </div>

      <Sep />

      <div className="flex items-center gap-1">
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Alinhar Esquerda"><AlignLeft size={s} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Centralizar"><AlignCenter size={s} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justificar"><AlignJustify size={s} /></ToolbarBtn>
      </div>

      <div className="ml-auto flex items-center gap-3">
         <div className="hidden md:flex flex-col items-end">
            <span className="text-[8px] font-black text-ink-300 uppercase tracking-widest">Página de Laudo</span>
            <span className="text-[10px] font-bold text-ink-500">A4 Standard</span>
         </div>
      </div>
    </div>
  );
}
