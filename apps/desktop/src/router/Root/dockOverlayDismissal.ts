const INTERACTIVE_LAYER_SELECTOR = [
  '[data-slot="dialog-content"][data-state="open"]',
  '[data-slot="popover-content"][data-state="open"]',
  '[data-slot="select-content"][data-state="open"]',
  '[data-slot="context-menu-content"][data-state="open"]',
  '[data-slot="context-menu-sub-content"][data-state="open"]',
  '.aui-popover-content[data-state="open"]',
].join(',')

export function hasOpenInteractiveLayer(root: ParentNode = document): boolean {
  return Boolean(root.querySelector(INTERACTIVE_LAYER_SELECTOR))
}
