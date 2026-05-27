import { useEditor, EditorContent, type Editor as TiptapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { useEffect } from 'react';

import { cn } from '@/lib/utils';

import { ClassedParagraph } from './classed-paragraph';
import { EditorToolbar } from './editor-toolbar';
import './editor.css';

export interface RichTextEditorProps {
  content?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  minHeight?: string;
  /** Cap editor body height; enables internal scroll (toolbar stays fixed when shown). */
  maxHeight?: string;
  /**
   * When true, the prose area does not scroll internally — the parent should use
   * `overflow-y-auto` + `max-h-*` so one scrollbar controls the whole tab.
   */
  paneScroll?: boolean;
  autofocus?: boolean;
  /** Hide formatting toolbar (e.g. read-only summary) */
  showToolbar?: boolean;
  /** `document` = borderless inline doc surface */
  variant?: 'default' | 'document';
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
        paragraph: false,
        heading: {
          levels: [1, 2, 3]
        },
        codeBlock: {
          HTMLAttributes: {
            class: 'editor-code-block'
          }
        }
      }),
      ClassedParagraph,
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
  maxHeight,
  autofocus = false,
  showToolbar = true,
  variant = 'default',
  paneScroll = false
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
        variant === 'document' &&
          cn(
            'editor-container editor-container--document',
            paneScroll ? 'overflow-visible' : 'overflow-hidden'
          ),
        variant === 'default' &&
          cn(
            'editor-container rounded-lg border border-border bg-background',
            paneScroll ? 'overflow-visible' : 'overflow-hidden'
          ),
        (maxHeight || paneScroll) && 'flex min-h-0 flex-col',
        paneScroll && 'overflow-visible',
        className
      )}
      style={{
        ...(maxHeight && !paneScroll ? { maxHeight } : {}),
        ...(paneScroll && minHeight ? { minHeight } : {})
      }}
    >
      {editable && showToolbar && (
        <div className='shrink-0'>
          <EditorToolbar editor={editor} />
        </div>
      )}
      <div
        className={cn(
          'editor-wrapper overscroll-contain',
          paneScroll ? 'min-h-0 overflow-visible' : 'overflow-y-auto',
          maxHeight && !paneScroll && 'min-h-0 flex-1'
        )}
        style={{ minHeight: paneScroll ? undefined : minHeight }}
      >
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
