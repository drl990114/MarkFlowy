import { ThemeProvider } from "styled-components"

type Props = {
  children?: React.ReactNode;
  theme: Record<string, any>;
};

const UiThemeProvider = ({ theme, children }: Props) => {
  return (
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  )
}

export default UiThemeProvider
