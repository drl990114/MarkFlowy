import { createContext } from 'react';

import antdTheme from 'antd/es/theme';
import { ThemeProvider as ScThemeProvider, StyleSheetManager } from 'styled-components';
import { darkTheme, lightTheme } from '.';

import { XProvider, XProviderProps } from '@ant-design/x';
import isPropValid from '@emotion/is-prop-valid';

type Props = {
  theme?: {
    mode: 'light' | 'dark';
    /**
     * Some theme variables can be modified through the token attribute in theme.
     */
    token?: Record<string, any>;
  };
  children?: React.ReactNode;
  antdThemeConfig?: XProviderProps['theme'];
};

export const ThemeContext = createContext<Record<string, string>>({});

export const ThemeProvider: React.FC<Props> = ({
  theme,
  children,
  antdThemeConfig = {},
}: Props) => {
  const mode = theme?.mode || 'light';

  const defaultThemeToken =
    mode === 'dark' ? darkTheme.styledConstants : lightTheme.styledConstants;

  const themeToken = theme?.token ? { ...defaultThemeToken, ...theme.token } : defaultThemeToken;

  return (
    <StyleSheetManager shouldForwardProp={shouldForwardProp}>
      <ScThemeProvider theme={themeToken}>
        <XProvider
          theme={{
            token:
              mode === 'dark'
                ? {
                    colorPrimary: '#016ab3',
                    colorSuccess: '#00c853',
                    colorWarning: '#e2b340',
                    colorError: '#dc2626',
                    colorInfo: '#016ab3',
                    colorTextBase: '#c8d1d9',
                    colorBgBase: '#151515',
                    colorPrimaryBg: '#0e1419',
                    colorPrimaryBgHover: '#1f2225',
                    colorPrimaryBorder: '#363b41',
                    colorPrimaryBorderHover: '#016ab3',
                    colorPrimaryHover: '#0284c7',
                    colorPrimaryActive: '#0ea5e9',
                    colorPrimaryText: '#016ab3',
                    colorPrimaryTextHover: '#0284c7',
                    colorPrimaryTextActive: '#0ea5e9',
                    colorSuccessBg: '#0e1419',
                    colorSuccessBgHover: '#1f2225',
                    colorSuccessBorder: '#363b41',
                    colorSuccessBorderHover: '#00c853',
                    colorSuccessHover: '#00e676',
                    colorSuccessActive: '#00c853',
                    colorSuccessText: '#00c853',
                    colorSuccessTextHover: '#00e676',
                    colorSuccessTextActive: '#00c853',
                    colorWarningBg: '#0e1419',
                    colorWarningBgHover: '#1f2225',
                    colorWarningBorder: '#363b41',
                    colorWarningBorderHover: '#e2b340',
                    colorWarningHover: '#fbbf24',
                    colorWarningActive: '#e2b340',
                    colorWarningText: '#e2b340',
                    colorWarningTextHover: '#fbbf24',
                    colorWarningTextActive: '#e2b340',
                    colorErrorBg: '#0e1419',
                    colorErrorBgHover: '#1f2225',
                    colorErrorBorder: '#363b41',
                    colorErrorBorderHover: '#dc2626',
                    colorErrorHover: '#ef4444',
                    colorErrorActive: '#dc2626',
                    colorErrorText: '#dc2626',
                    colorErrorTextHover: '#ef4444',
                    colorErrorTextActive: '#dc2626',
                    colorInfoBg: '#0e1419',
                    colorInfoBgHover: '#1f2225',
                    colorInfoBorder: '#363b41',
                    colorInfoBorderHover: '#016ab3',
                    colorInfoHover: '#0284c7',
                    colorInfoActive: '#0ea5e9',
                    colorInfoText: '#016ab3',
                    colorInfoTextHover: '#0284c7',
                    colorInfoTextActive: '#0ea5e9',
                    colorText: '#c8d1d9',
                    colorTextSecondary: '#999999',
                    colorTextTertiary: 'rgba(255, 255, 255, 0.5)',
                    colorTextQuaternary: '#5f5f5f',
                    colorTextDisabled: 'rgba(255, 255, 255, 0.25)',
                    colorBgContainer: '#18191B',
                    colorBgElevated: '#21262c',
                    colorBgLayout: '#151515',
                    colorBgSpotlight: '#43414A',
                    colorBgMask: '#00000099',
                    colorBorder: '#363b41',
                    colorBorderSecondary: '#363b41',
                    borderRadius: 6,
                    borderRadiusXS: 2,
                    borderRadiusSM: 4,
                    borderRadiusLG: 8,
                    padding: 16,
                    paddingSM: 12,
                    paddingLG: 20,
                    margin: 16,
                    marginSM: 12,
                    marginLG: 20,
                    boxShadow:
                      '0 0 0 1px rgba(255, 255, 255, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.4)',
                    boxShadowSecondary:
                      '0 0 0 1px rgba(255, 255, 255, 0.04), 0 4px 6px -1px rgba(0, 0, 0, 0.4)',
                  }
                : {
                    colorPrimary: '#007acc',
                    colorSuccess: '#00c853',
                    colorWarning: '#e2b340',
                    colorError: '#dc2626',
                    colorInfo: '#007acc',
                    colorTextBase: '#000000',
                    colorBgBase: '#fdfdfd',
                    colorPrimaryBg: '#f0f7ff',
                    colorPrimaryBgHover: '#d6eaff',
                    colorPrimaryBorder: '#a3d0ff',
                    colorPrimaryBorderHover: '#7bb8ff',
                    colorPrimaryHover: '#006bb3',
                    colorPrimaryActive: '#005a99',
                    colorPrimaryText: '#007acc',
                    colorPrimaryTextHover: '#006bb3',
                    colorPrimaryTextActive: '#005a99',
                    colorSuccessBg: '#e6fff4',
                    colorSuccessBgHover: '#ccffe9',
                    colorSuccessBorder: '#66ffab',
                    colorSuccessBorderHover: '#33ff92',
                    colorSuccessHover: '#00af47',
                    colorSuccessActive: '#00953c',
                    colorSuccessText: '#00c853',
                    colorSuccessTextHover: '#00af47',
                    colorSuccessTextActive: '#00953c',
                    colorWarningBg: '#fffdf5',
                    colorWarningBgHover: '#fff8e1',
                    colorWarningBorder: '#ffd966',
                    colorWarningBorderHover: '#ffcc33',
                    colorWarningHover: '#d1a033',
                    colorWarningActive: '#b38a2b',
                    colorWarningText: '#e2b340',
                    colorWarningTextHover: '#d1a033',
                    colorWarningTextActive: '#b38a2b',
                    colorErrorBg: '#fff5f5',
                    colorErrorBgHover: '#ffe6e6',
                    colorErrorBorder: '#ff9999',
                    colorErrorBorderHover: '#ff6666',
                    colorErrorHover: '#c71f1f',
                    colorErrorActive: '#a61a1a',
                    colorErrorText: '#dc2626',
                    colorErrorTextHover: '#c71f1f',
                    colorErrorTextActive: '#a61a1a',
                    colorText: 'rgba(0, 0, 0, 0.88)',
                    colorTextSecondary: '#5f5f5f',
                    colorTextTertiary: '#9ca3af',
                    colorTextQuaternary: 'rgba(0, 0, 0, 0.25)',
                    colorTextDisabled: 'rgba(0, 0, 0, 0.25)',
                    colorBgContainer: '#ffffff',
                    colorBgElevated: '#ffffff',
                    colorBgLayout: '#f6f7f9',
                    colorBgSpotlight: 'rgba(0, 0, 0, 0.85)',
                    colorBgMask: 'rgba(0, 0, 0, 0.4)',
                    colorBorder: '#d7d7dc',
                    colorBorderSecondary: '#e5e5ea',
                    borderRadius: 6,
                    borderRadiusXS: 2,
                    borderRadiusSM: 4,
                    borderRadiusLG: 8,
                    padding: 16,
                    paddingSM: 12,
                    paddingLG: 20,
                    margin: 16,
                    marginSM: 12,
                    marginLG: 20,
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.08)',
                    boxShadowSecondary: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
                  },
            algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
            zeroRuntime: true,
            ...antdThemeConfig,
          }}
        >
          <ThemeContext.Provider value={themeToken}>{children}</ThemeContext.Provider>
        </XProvider>
      </ScThemeProvider>
    </StyleSheetManager>
  );
};

// This implements the default behavior from styled-components v5
function shouldForwardProp(propName: string, target: any) {
  if (typeof target === 'string') {
    // For HTML elements, forward the prop if it is a valid HTML attribute
    return isPropValid(propName);
  }
  // For other elements, forward all props
  return true;
}
