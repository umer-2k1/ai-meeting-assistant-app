import type { ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import {
  IconBold,
  IconItalic,
  IconStrikethrough,
  IconCode,
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListNumbers,
  IconQuote,
  IconSeparator,
  IconLink,
  IconUnlink,
  IconHighlight,
  IconCheckbox,
  IconCodeDots,
  IconArrowBack,
  IconPalette,
  IconBrush
} from '@tabler/icons-react';

import { cn } from '@/lib/utils';
import { ColorButton } from './color-picker';

interface MenuButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: ReactNode;
  title: string;
}

function MenuButton({ onClick, isActive, disabled, children, title }: MenuButtonProps) {
  return (
    <button
      type='button'
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-lg transition-colors',
        'hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40',
        isActive && 'bg-primary/10 text-primary'
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className='mx-1 h-6 w-px bg-border' />;
}

interface EditorToolbarProps {
  editor: Editor | null;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) {
    return null;
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className='sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-border/70 bg-background/95 px-3 py-2 backdrop-blur-sm'>
      <MenuButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        title='Bold (Cmd+B)'
      >
        <IconBold className='size-4' stroke={2} />
      </MenuButton>

      <MenuButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        title='Italic (Cmd+I)'
      >
        <IconItalic className='size-4' stroke={2} />
      </MenuButton>

      <MenuButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        title='Strikethrough'
      >
        <IconStrikethrough className='size-4' stroke={2} />
      </MenuButton>

      <MenuButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        disabled={!editor.can().chain().focus().toggleCode().run()}
        title='Inline code (Cmd+E)'
      >
        <IconCode className='size-4' stroke={2} />
      </MenuButton>

      <Divider />

      <ColorButton editor={editor} type='text' icon={<IconPalette className='size-4' stroke={2} />} title='Text color' />

      <ColorButton
        editor={editor}
        type='highlight'
        icon={<IconBrush className='size-4' stroke={2} />}
        title='Highlight color'
      />

      <Divider />

      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title='Heading 1'
      >
        <IconH1 className='size-4' stroke={2} />
      </MenuButton>

      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title='Heading 2'
      >
        <IconH2 className='size-4' stroke={2} />
      </MenuButton>

      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title='Heading 3'
      >
        <IconH3 className='size-4' stroke={2} />
      </MenuButton>

      <Divider />

      <MenuButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title='Bullet list'
      >
        <IconList className='size-4' stroke={2} />
      </MenuButton>

      <MenuButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title='Numbered list'
      >
        <IconListNumbers className='size-4' stroke={2} />
      </MenuButton>

      <MenuButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive('taskList')}
        title='Task list'
      >
        <IconCheckbox className='size-4' stroke={2} />
      </MenuButton>

      <Divider />

      <MenuButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        title='Code block'
      >
        <IconCodeDots className='size-4' stroke={2} />
      </MenuButton>

      <MenuButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title='Quote'
      >
        <IconQuote className='size-4' stroke={2} />
      </MenuButton>

      <MenuButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title='Horizontal rule'
      >
        <IconSeparator className='size-4' stroke={2} />
      </MenuButton>

      <Divider />

      <MenuButton onClick={setLink} isActive={editor.isActive('link')} title='Add link'>
        <IconLink className='size-4' stroke={2} />
      </MenuButton>

      <MenuButton
        onClick={() => editor.chain().focus().unsetLink().run()}
        disabled={!editor.isActive('link')}
        title='Remove link'
      >
        <IconUnlink className='size-4' stroke={2} />
      </MenuButton>

      <Divider />

      <MenuButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
        title='Undo (Cmd+Z)'
      >
        <IconArrowBack className='size-4' stroke={2} />
      </MenuButton>
    </div>
  );
}
