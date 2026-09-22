/** Create a synthetic keyboard event with an explicit AltGraph state. */
export function createKeyboardEvent(type: string, options: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...options })
  const getModifierState = event.getModifierState.bind(event)

  // Happy DOM 20 reports every Alt press as AltGraph and ignores modifierAltGraph.
  // Keep these separate as EventModifierInit specifies, including real AltGraph test cases.
  Object.defineProperty(event, 'getModifierState', {
    configurable: true,
    value: (modifier: string) =>
      modifier === 'AltGraph' ? Boolean(options.modifierAltGraph) : getModifierState(modifier),
  })
  return event
}
