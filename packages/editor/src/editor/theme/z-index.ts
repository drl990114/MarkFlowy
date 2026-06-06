export const editorZIndex = {
  /** Hidden elements (e.g., positioner) */
  hidden: -1,
  /** Inline widgets inside editor content (e.g., code-block menu, image node view, live-preview divider) */
  inlineWidget: 1,
  /** Copy button inside code blocks */
  copyButton: 10,
  /** Block handler, table cell buttons */
  blockHandler: 10,
  /** Image node view when selected */
  imageSelected: 10,
  /** Toolbar buttons and tooltips above inline widgets */
  tooltip: 11,
  /** Image toolbar */
  imageToolbar: 11,
  /** Table tooltip */
  tableTooltip: 11,
  /** Resizable handle */
  resizableHandle: 99,
  /** Dropdown menus and link hover icons */
  dropdown: 100,
  /** Image tool tips */
  imageToolTips: 100,
  /** Fullscreen mode for live preview blocks (mermaid, math, etc.) */
  fullscreen: 999,
  /** Floating menus (slash menu, copilot tool) */
  floatingMenu: 1000,
} as const
