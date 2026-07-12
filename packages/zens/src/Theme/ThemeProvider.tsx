import { createContext } from 'react';

import isPropValid from '@emotion/is-prop-valid';
import { ThemeProvider as ScThemeProvider, StyleSheetManager } from 'styled-components';

import { darkTheme, lightTheme } from '.';

type Props = {
  theme?: {
    mode: 'light' | 'dark';
    /**
     * Some theme variables can be modified through the token attribute in theme.
     */
    token?: Record<string, any>;
  };
  children?: React.ReactNode;
};

export const ThemeContext = createContext<Record<string, string>>({});

export const ThemeProvider: React.FC<Props> = ({ theme, children }: Props) => {
  const mode = theme?.mode || 'light';
  const defaultThemeToken =
    mode === 'dark' ? darkTheme.styledConstants : lightTheme.styledConstants;
  const themeToken = theme?.token ? { ...defaultThemeToken, ...theme.token } : defaultThemeToken;

  return (
    <StyleSheetManager shouldForwardProp={shouldForwardProp}>
      <ScThemeProvider theme={themeToken}>
        <ThemeContext.Provider value={themeToken}>{children}</ThemeContext.Provider>
      </ScThemeProvider>
    </StyleSheetManager>
  );
};

// This implements the default behavior from styled-components v5
function shouldForwardProp(propName: string, target: any) {
  if (typeof target === 'string') {
    return isPropValid(propName);
  }
  // For other elements, forward all props
  return true;
}
