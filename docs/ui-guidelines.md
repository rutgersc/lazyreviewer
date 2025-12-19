# UI Guidelines

## Color Guidelines

**NEVER use hard-to-read colors that reduce accessibility.**

### Colors to Avoid

- `#6272a4` (grey) - too dim and hard to read on dark backgrounds
- Any colors with low contrast ratios

### Approved Dracula Theme Palette

| Color | Hex | Use Case |
|-------|-----|----------|
| Foreground white | `#f8f8f2` | Primary text |
| Purple | `#bd93f9` | Good alternative to grey |
| Green | `#50fa7b` | Success states |
| Cyan | `#8be9fd` | Info, links |
| Orange | `#ffb86c` | Warnings |
| Red | `#ff5555` | Errors |
| Yellow | `#f1fa8c` | Highlights |

**When in doubt, use `#bd93f9` instead of grey tones.**

### Accessibility Rules

- ALWAYS review all text colors in new components for readability
- Replace any instance of `#6272a4` with `#bd93f9` for better contrast
- Test readability by checking if text is easily visible against dark backgrounds

## openTUI Info

- When handling keys via `useKeyboard`, `'enter'` is not a keycode - use `'return'` instead

## UI Component Guidelines

### Discussion Counts

Always show resolved/resolvable format (e.g., "💬 3/5" or "💬 0/0") - do not special-case zero values with conditional rendering.

### MR Row Height

The `useAutoScroll` hook's `itemHeight` parameter must match the actual number of rows rendered per MR item, otherwise keyboard navigation scrolling will be misaligned.

When adding/removing rows from the MR display, update the `itemHeight` accordingly.
