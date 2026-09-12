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
export const Image = createMockComponent('Image')
export const Popover = createMockComponent('Popover')
export const Ariakit = {}
export const Loading = createMockComponent('Loading')
export const ThemeProvider = () => null
export const ThemeContext = {}
export const toast = () => {}
export const useMenuStore = () => ({})
