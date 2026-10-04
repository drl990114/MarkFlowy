import { render, screen } from '@testing-library/react'
import { Button } from '../components/button'
import { Popover, PopoverContent, PopoverTrigger } from '../components/popover'
import { ComponentsThemeProvider, legacyThemeVariables } from './components-theme'

describe('components theme', () => {
  it('inherits host CSS variables when the provider has no overrides', () => {
    render(
      <ComponentsThemeProvider>
        <Button>Host theme</Button>
      </ComponentsThemeProvider>,
    )
    expect(screen.getByRole('button').style.getPropertyValue('--mf-background')).toBe('')
  })

  it('preserves nested overrides through a body portal and changes them in place', () => {
    const renderPopover = (background: string) => (
      <ComponentsThemeProvider
        variables={{ '--mf-background': background, '--mf-primary': 'rebeccapurple' }}
        mode='dark'
      >
        <ComponentsThemeProvider variables={{ '--mf-foreground': 'ivory' }}>
          <Popover defaultOpen>
            <PopoverTrigger>Open details</PopoverTrigger>
            <PopoverContent data-testid='details'>Details</PopoverContent>
          </Popover>
        </ComponentsThemeProvider>
      </ComponentsThemeProvider>
    )
    const view = render(renderPopover('midnightblue'))
    const content = screen.getByTestId('details')
    expect(view.container.contains(content)).toBe(false)
    expect(content.style.getPropertyValue('--mf-background')).toBe('midnightblue')
    expect(content.style.getPropertyValue('--mf-primary')).toBe('rebeccapurple')
    expect(content.style.getPropertyValue('--mf-foreground')).toBe('ivory')
    expect(content.style.colorScheme).toBe('dark')
    view.rerender(renderPopover('slateblue'))
    expect(screen.getByTestId('details').style.getPropertyValue('--mf-background')).toBe(
      'slateblue',
    )
  })

  it('keeps Web CSS references live and maps both base and alias tokens', () => {
    const variables = legacyThemeVariables({
      bgColor: 'var(--mf-web-bgColor)',
      accentColor: 'var(--mf-web-accentColor)',
    })
    expect(variables['--mf-background']).toBe('var(--mf-web-bgColor)')
    expect(variables['--mf-surface-app']).toBe('var(--mf-web-bgColor)')
    expect(variables['--mf-primary']).toBe('var(--mf-web-accentColor)')
    expect(Object.values(variables)).not.toContain(undefined)
  })
})
