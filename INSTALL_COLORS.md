# Installation Instructions

To complete the rich text editor implementation with color support, install the required Tiptap color extensions:

## Required Packages

Run the following command in the `frontend` directory:

```bash
# First, switch to Node 22
nvm use 22

# Install the color extensions
pnpm add @tiptap/extension-color @tiptap/extension-text-style
```

## What These Packages Do

- **`@tiptap/extension-color`** - Enables text color customization
- **`@tiptap/extension-text-style`** - Required dependency for color extension (adds inline style support)

## Verification

After installation, restart your dev server:

```bash
pnpm desktop:dev
```

The editor toolbar will now include:
- 🎨 **Text Color** button (palette icon) - 19 color options
- 🖌️ **Highlight Color** button (brush icon) - 19 background color options

## Color Options Available

### Text Colors
Default, Gray, Red, Orange, Amber, Yellow, Lime, Green, Emerald, Teal, Cyan, Sky, Blue, Indigo, Violet, Purple, Fuchsia, Pink, Rose

### Highlight Colors
None, Gray, Red, Orange, Amber, Yellow, Lime, Green, Emerald, Teal, Cyan, Sky, Blue, Indigo, Violet, Purple, Fuchsia, Pink, Rose

Each color has been carefully selected to work in both light and dark themes.

## Features Implemented

✅ **Text Color Picker**
- 19 vibrant colors + default (remove color)
- Visual color grid with hover effects
- Shows current color with checkmark
- Click outside to close

✅ **Highlight Color Picker**
- 19 pastel background colors + none (remove highlight)
- Same intuitive UI as text color
- Multicolor highlight support (can highlight different parts in different colors)

✅ **Smart UI**
- Color indicator bar under button shows current color
- Active state when color is applied
- Popover positioned correctly
- Theme-aware styling

## Usage in Code

The color features are automatically available in the `RichTextEditor` component:

```tsx
<RichTextEditor
  content={content}
  onChange={setContent}
  placeholder='Try changing text colors!'
/>
```

Users can:
1. Select text
2. Click the palette icon (text color) or brush icon (highlight)
3. Choose a color from the grid
4. Color is applied immediately

## Troubleshooting

If you see TypeScript errors after installation:
1. Restart your TypeScript server in VS Code: `Cmd+Shift+P` → "TypeScript: Restart TS Server"
2. If errors persist, restart your terminal and dev server

If colors don't appear:
1. Check that packages are installed: `pnpm list | grep tiptap`
2. Verify the dev server restarted after installation
3. Check browser console for any import errors
