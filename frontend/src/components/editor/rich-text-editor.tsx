import { useEditor, EditorContent, type Editor as TiptapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { useEffect } from 'react';

import { cn } from '@/lib/utils';

import { EditorToolbar } from './editor-toolbar';
import './editor.css';

export interface RichTextEditorProps {
  content?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  minHeight?: string;
  autofocus?: boolean;
}

export interface EditorConfig {
  placeholder?: string;
  editable?: boolean;
  autofocus?: boolean;
  onCreate?: (editor: TiptapEditor) => void;
  onUpdate?: (editor: TiptapEditor) => void;
}

/**
 * Create a configured Tiptap editor instance with all extensions
 */
export function useRichTextEditor(content: string, config: EditorConfig = {}) {
  const { placeholder, editable = true, autofocus = false, onCreate, onUpdate } = config;

  return useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        },
        codeBlock: {
          HTMLAttributes: {
            class: 'editor-code-block'
          }
        }
      }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Start typing...',
        emptyEditorClass: 'is-editor-empty'
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link'
        }
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'editor-task-list'
        }
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'editor-task-item'
        }
      }),
      Highlight.configure({
        multicolor: true
      }),
      TextStyle,
      Color,
      Typography
    ],
    content,
    editable,
    autofocus,
    onCreate: ({ editor }) => {
      onCreate?.(editor);
    },
    onUpdate: ({ editor }) => {
      onUpdate?.(editor);
    },
    editorProps: {
      attributes: {
        class: 'editor-content'
      }
    }
  });
}

/**
 * Rich Text Editor component with Notion-like interface
 */
export function RichTextEditor({
  content = '',
  onChange,
  placeholder,
  editable = true,
  className,
  minHeight = '200px',
  autofocus = false
}: RichTextEditorProps) {
  const editor = useRichTextEditor(content, {
    placeholder,
    editable,
    autofocus,
    onUpdate: (editor) => {
      onChange?.(editor.getHTML());
    }
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div
      className={cn(
        'editor-container overflow-hidden rounded-lg border border-border bg-background',
        className
      )}
    >
      {editable && <EditorToolbar editor={editor} />}
      <div className='editor-wrapper' style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

/**
 * Export hook for advanced use cases where consumers want full control
 */
export { useEditor, EditorContent };
export type { Editor } from '@tiptap/react';
