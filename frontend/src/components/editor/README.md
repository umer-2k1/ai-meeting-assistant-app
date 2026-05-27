# Rich Text Editor Usage

This directory contains a centralized Notion-like rich text editor built with Tiptap.

## Architecture

The editor is designed with reusability in mind:

1. **`rich-text-editor.tsx`** - Main editor component and hook provider
2. **`editor-toolbar.tsx`** - Toolbar with formatting controls
3. **`editor.css`** - Theme-aware styles
4. **`index.ts`** - Clean exports for consumers

## Basic Usage

### Simple Editor

```tsx
import { RichTextEditor } from '@/components/editor';

function MyComponent() {
  const [content, setContent] = useState('<p>Initial content</p>');

  return (
    <RichTextEditor
      content={content}
      onChange={setContent}
      placeholder='Start typing...'
    />
  );
}
```

### Read-Only Display

```tsx
<RichTextEditor
  content={savedContent}
  editable={false}
  minHeight='300px'
/>
```

### Custom Height

```tsx
<RichTextEditor
  content={content}
  onChange={setContent}
  minHeight='500px'
  autofocus
/>
```

## Advanced Usage

### Using the Hook Directly

For full control over editor behavior:

```tsx
import { useRichTextEditor, EditorContent, EditorToolbar } from '@/components/editor';

function CustomEditor() {
  const editor = useRichTextEditor('', {
    placeholder: 'Write something amazing...',
    editable: true,
    autofocus: true,
    onCreate: (editor) => {
      console.log('Editor created:', editor);
    },
    onUpdate: (editor) => {
      const html = editor.getHTML();
      const json = editor.getJSON();
      // Save to backend, local storage, etc.
    }
  });

  if (!editor) return null;

  return (
    <div className='custom-editor-container'>
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
      
      {/* Custom controls */}
      <button onClick={() => editor.commands.undo()}>
        Undo
      </button>
      <button onClick={() => editor.commands.redo()}>
        Redo
      </button>
    </div>
  );
}
```

### Multiple Editors in One Component

```tsx
function DualEditor() {
  const [leftContent, setLeftContent] = useState('');
  const [rightContent, setRightContent] = useState('');

  return (
    <div className='grid grid-cols-2 gap-4'>
      <RichTextEditor
        content={leftContent}
        onChange={setLeftContent}
        placeholder='Left editor'
      />
      <RichTextEditor
        content={rightContent}
        onChange={setRightContent}
        placeholder='Right editor'
      />
    </div>
  );
}
```

### Syncing with External State

```tsx
function SyncedEditor({ meetingId }: { meetingId: string }) {
  const [notes, setNotes] = useState('');
  const debouncedSave = useDebouncedCallback((content: string) => {
    // Save to backend
    saveMeetingNotes(meetingId, content);
  }, 1000);

  return (
    <RichTextEditor
      content={notes}
      onChange={(content) => {
        setNotes(content);
        debouncedSave(content);
      }}
      placeholder='Meeting notes...'
    />
  );
}
```

## Features

- **Typography**: H1, H2, H3, bold, italic, strikethrough, inline code
- **Colors**: Text color and highlight color with 19 color options each
- **Lists**: Bulleted, numbered, and task lists with checkboxes
- **Blocks**: Code blocks, blockquotes, horizontal rules
- **Links**: Add/edit/remove links with URL prompts
- **Keyboard shortcuts**: Standard shortcuts (Cmd+B, Cmd+I, Cmd+E, etc.)
- **Theme-aware**: Automatically adapts to light/dark mode
- **Undo/Redo**: Full history support

## Keyboard Shortcuts

- `Cmd+B` / `Ctrl+B` - Bold
- `Cmd+I` / `Ctrl+I` - Italic
- `Cmd+E` / `Ctrl+E` - Inline code
- `Cmd+Z` / `Ctrl+Z` - Undo
- `Cmd+Shift+Z` / `Ctrl+Shift+Z` - Redo
- `Cmd+Enter` - Submit (custom implementation)
- `#` + `Space` - Convert to heading (Notion-style)
- `-` / `*` + `Space` - Convert to bullet list
- `1.` + `Space` - Convert to numbered list
- `[]` + `Space` - Convert to task list

## Customization

### Custom Extensions

```tsx
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CustomExtension from './custom-extension';

function MyEditor() {
  const editor = useEditor({
    extensions: [
      StarterKit,
      CustomExtension.configure({
        // options
      })
    ],
    content: '<p>Hello world</p>'
  });

  return <EditorContent editor={editor} />;
}
```

### Custom Styles

Override styles in your component's CSS:

```css
.custom-editor .editor-content h1 {
  @apply text-4xl font-black;
}

.custom-editor .editor-content .editor-link {
  @apply text-blue-600 underline-offset-4;
}
```

## Props API

### RichTextEditor

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `string` | `''` | HTML content for the editor |
| `onChange` | `(content: string) => void` | - | Callback when content changes |
| `placeholder` | `string` | `'Start typing...'` | Placeholder text |
| `editable` | `boolean` | `true` | Whether editor is editable |
| `className` | `string` | - | Additional CSS classes |
| `minHeight` | `string` | `'200px'` | Minimum editor height |
| `autofocus` | `boolean` | `false` | Auto-focus on mount |

### useRichTextEditor

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `string` | `''` | Initial HTML content |
| `placeholder` | `string` | `'Start typing...'` | Placeholder text |
| `editable` | `boolean` | `true` | Whether editor is editable |
| `autofocus` | `boolean` | `false` | Auto-focus on mount |
| `onCreate` | `(editor) => void` | - | Callback when editor created |
| `onUpdate` | `(editor) => void` | - | Callback on every update |

## Examples in the App

### Meeting Notes (Detail Screen)

```tsx
// src/features/meeting-copilot/meeting-copilot-app.tsx
<RichTextEditor
  content={meeting.notes}
  onChange={(content) => {
    // Save notes
    updateMeetingNotes(meeting.id, content);
  }}
  placeholder='Add meeting notes, key takeaways, or follow-up items...'
  minHeight='400px'
/>
```

This is a centralized, reusable editor that can be used anywhere in the application with consistent behavior and styling.
