// Keep both axes on the existing OverlayScrollbars viewport. With automatic
// visibility, the horizontal bar only appears when content (e.g. a wide table)
// actually overflows; a row must not create its own competing scroll container.
export const editorScrollOptions = {
  scrollbars: {
    theme: 'os-theme-markflowy',
    visibility: 'auto',
    autoHide: 'never',
    dragScroll: true,
    clickScroll: true,
  },
  overflow: {
    x: 'scroll',
    y: 'scroll',
  },
} as const
