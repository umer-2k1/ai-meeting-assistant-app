import { Paragraph } from '@tiptap/extension-paragraph';

/**
 * Paragraph nodes that keep `class` (and optional `data-*`) so transcript / layout HTML round-trips through TipTap.
 */
export const ClassedParagraph = Paragraph.extend({
  name: 'paragraph',

  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML: (element) => element.getAttribute('class'),
        renderHTML: (attributes) => {
          if (!attributes.class) return {};
          return { class: attributes.class };
        }
      }
    };
  }
});
