const forwardRef = (fn: any) => fn

function createMockComponent(name: string) {
  const component = forwardRef(() => null)
  component.displayName = name
  return component
}

export const Button = createMockComponent('Button')
export const Menu = createMockComponent('Menu')
export const Input = createMockComponent('Input')
export const Space = createMockComponent('Space')
export const Dropdown = createMockComponent('Dropdown')
export const DropdownMenuItem = createMockComponent('DropdownMenuItem')
export const Tooltip = createMockComponent('Tooltip')
export const Dialog = createMockComponent('Dialog')
export const Image = createMockComponent('Image')
export const Popover = createMockComponent('Popover')
export const CommandDialog = createMockComponent('CommandDialog')
export const Spinners = {}
export const Ariakit = {}
export const Loading = createMockComponent('Loading')
export const Shortcut = createMockComponent('Shortcut')
export const TableOfContent = createMockComponent('TableOfContent')
export const ThemeProvider = () => null
export const ThemeContext = {}
export const toast = () => {}
export const useMenuStore = () => ({})
