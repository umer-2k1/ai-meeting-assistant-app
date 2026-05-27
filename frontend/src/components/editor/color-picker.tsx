import { useState } from 'react';
import type { Editor } from '@tiptap/react';

import { cn } from '@/lib/utils';

const TEXT_COLORS = [
  { name: 'Default', value: '' },
  { name: 'Gray', value: '#6B7280' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Lime', value: '#84CC16' },
  { name: 'Green', value: '#10B981' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Sky', value: '#0EA5E9' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Violet', value: '#8B5CF6' },
  { name: 'Purple', value: '#A855F7' },
  { name: 'Fuchsia', value: '#D946EF' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Rose', value: '#F43F5E' }
];

const HIGHLIGHT_COLORS = [
  { name: 'None', value: '' },
  { name: 'Gray', value: '#F3F4F6' },
  { name: 'Red', value: '#FEE2E2' },
  { name: 'Orange', value: '#FFEDD5' },
  { name: 'Amber', value: '#FEF3C7' },
  { name: 'Yellow', value: '#FEF9C3' },
  { name: 'Lime', value: '#ECFCCB' },
  { name: 'Green', value: '#D1FAE5' },
  { name: 'Emerald', value: '#D1FAE5' },
  { name: 'Teal', value: '#CCFBF1' },
  { name: 'Cyan', value: '#CFFAFE' },
  { name: 'Sky', value: '#E0F2FE' },
  { name: 'Blue', value: '#DBEAFE' },
  { name: 'Indigo', value: '#E0E7FF' },
  { name: 'Violet', value: '#EDE9FE' },
  { name: 'Purple', value: '#F3E8FF' },
  { name: 'Fuchsia', value: '#FAE8FF' },
  { name: 'Pink', value: '#FCE7F3' },
  { name: 'Rose', value: '#FFE4E6' }
];

interface ColorPickerProps {
  editor: Editor;
  type: 'text' | 'highlight';
  onClose: () => void;
}

export function ColorPicker({ editor, type, onClose }: ColorPickerProps) {
  const colors = type === 'text' ? TEXT_COLORS : HIGHLIGHT_COLORS;
  
  const currentColor =
    type === 'text'
      ? editor.getAttributes('textStyle')['color'] || ''
      : editor.getAttributes('highlight')['color'] || '';

  const handleColorSelect = (color: string) => {
    if (type === 'text') {
      if (color === '') {
        editor.chain().focus().unsetColor().run();
      } else {
        editor.chain().focus().setColor(color).run();
      }
    } else {
      if (color === '') {
        editor.chain().focus().unsetHighlight().run();
      } else {
        editor.chain().focus().setHighlight({ color }).run();
      }
    }
    onClose();
  };

  return (
    <div
      className='absolute top-full left-0 z-50 mt-1 rounded-lg border border-border bg-background p-2 shadow-lg'
      style={{ minWidth: '200px' }}
    >
      <div className='mb-2 px-2 py-1'>
        <p className='text-xs font-semibold text-foreground'>
          {type === 'text' ? 'Text Color' : 'Highlight Color'}
        </p>
      </div>
      <div className='grid max-h-64 grid-cols-5 gap-1 overflow-y-auto'>
        {colors.map((color) => (
          <button
            key={color.name}
            type='button'
            onClick={() => handleColorSelect(color.value)}
            className={cn(
              'group relative flex size-8 items-center justify-center rounded border transition-all hover:scale-110',
              currentColor === color.value
                ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                : 'border-border hover:border-primary/50'
            )}
            title={color.name}
            style={{
              backgroundColor: color.value || 'transparent',
              ...(color.value === '' && {
                background:
                  'repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%) 50% / 8px 8px'
              })
            }}
          >
            {color.value === '' && (
              <span className='text-xs font-medium text-muted-foreground'>A</span>
            )}
            {currentColor === color.value && (
              <svg
                className='absolute inset-0 m-auto size-4 drop-shadow'
                fill='white'
                stroke='currentColor'
                strokeWidth='2'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M5 13l4 4L19 7'
                />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ColorButtonProps {
  editor: Editor;
  type: 'text' | 'highlight';
  icon: React.ReactNode;
  title: string;
}

export function ColorButton({ editor, type, icon, title }: ColorButtonProps) {
  const [showPicker, setShowPicker] = useState(false);

  const currentColor =
    type === 'text'
      ? editor.getAttributes('textStyle')['color'] || '#000000'
      : editor.getAttributes('highlight')['color'] || '';

  return (
    <div className='relative'>
      <button
        type='button'
        onClick={() => setShowPicker(!showPicker)}
        title={title}
        className={cn(
          'relative inline-flex size-8 items-center justify-center rounded-lg transition-colors',
          'hover:bg-muted',
          currentColor && 'bg-primary/10 text-primary'
        )}
      >
        {icon}
        {currentColor && (
          <span
            className='absolute bottom-0.5 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full'
            style={{ backgroundColor: currentColor }}
          />
        )}
      </button>

      {showPicker && (
        <>
          <div
            className='fixed inset-0 z-40'
            onClick={() => setShowPicker(false)}
            aria-hidden='true'
          />
          <ColorPicker editor={editor} type={type} onClose={() => setShowPicker(false)} />
        </>
      )}
    </div>
  );
}
