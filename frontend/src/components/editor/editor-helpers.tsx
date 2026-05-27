import { useState } from 'react';
import { RichTextEditor, type RichTextEditorProps } from './rich-text-editor';

/**
 * Debounced editor wrapper for auto-saving scenarios
 * Usage:
 * 
 * <DebouncedEditor
 *   content={notes}
 *   onSave={(content) => saveMeetingNotes(meetingId, content)}
 *   debounceMs={1000}
 * />
 */
export function DebouncedEditor({
  content,
  onSave,
  debounceMs = 1000,
  ...props
}: Omit<RichTextEditorProps, 'onChange'> & {
  onSave: (content: string) => void | Promise<void>;
  debounceMs?: number;
}) {
  const [localContent, setLocalContent] = useState(content);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleChange = (newContent: string) => {
    setLocalContent(newContent);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const id = setTimeout(() => {
      onSave(newContent);
    }, debounceMs);

    setTimeoutId(id);
  };

  return (
    <RichTextEditor
      {...props}
      content={localContent}
      onChange={handleChange}
    />
  );
}

/**
 * Editor with explicit save button
 * Usage:
 * 
 * <EditorWithSaveButton
 *   initialContent={notes}
 *   onSave={(content) => updateNotes(content)}
 *   saveButtonText='Save Notes'
 * />
 */
export function EditorWithSaveButton({
  initialContent,
  onSave,
  saveButtonText = 'Save',
  ...props
}: Omit<RichTextEditorProps, 'content' | 'onChange'> & {
  initialContent: string;
  onSave: (content: string) => void | Promise<void>;
  saveButtonText?: string;
}) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(content);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className='space-y-3'>
      <RichTextEditor
        {...props}
        content={content}
        onChange={(newContent) => {
          setContent(newContent);
          setHasChanges(newContent !== initialContent);
        }}
      />
      <div className='flex items-center justify-end gap-2'>
        {hasChanges && (
          <span className='text-sm text-muted-foreground'>
            Unsaved changes
          </span>
        )}
        <button
          type='button'
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className='rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50'
        >
          {isSaving ? 'Saving...' : saveButtonText}
        </button>
      </div>
    </div>
  );
}

/**
 * Editor integrated with React Hook Form
 * Usage:
 * 
 * import { useForm } from 'react-hook-form';
 * 
 * function MyForm() {
 *   const { register, control, handleSubmit } = useForm();
 *   
 *   return (
 *     <form onSubmit={handleSubmit(onSubmit)}>
 *       <ControlledEditor
 *         name='notes'
 *         control={control}
 *         placeholder='Enter notes...'
 *       />
 *     </form>
 *   );
 * }
 */
// Uncomment when integrating with react-hook-form
/*
import { Controller, type Control } from 'react-hook-form';

export function ControlledEditor({
  name,
  control,
  ...props
}: Omit<RichTextEditorProps, 'content' | 'onChange'> & {
  name: string;
  control: Control<any>;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <RichTextEditor
          {...props}
          content={field.value || ''}
          onChange={field.onChange}
        />
      )}
    />
  );
}
*/
