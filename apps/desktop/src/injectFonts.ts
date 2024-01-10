import OpenSansLight from '@/assets/fonts/open-sans-v15-latin_latin-ext-300.woff'
import OpenSansLightItalic from '@/assets/fonts/open-sans-v15-latin_latin-ext-300italic.woff'
import OpenSansRegular from '@/assets/fonts/open-sans-v15-latin_latin-ext-regular.woff'
import OpenSansItalic from '@/assets/fonts/open-sans-v15-latin_latin-ext-italic.woff'
import OpenSansSemiBold from '@/assets/fonts/open-sans-v15-latin_latin-ext-600.woff'
import OpenSansSemiBoldItalic from '@/assets/fonts/open-sans-v15-latin_latin-ext-600italic.woff'
import OpenSansBold from '@/assets/fonts/open-sans-v15-latin_latin-ext-700.woff'
import OpenSansBoldItalic from '@/assets/fonts/open-sans-v15-latin_latin-ext-700italic.woff'

import DejaVuSansMono from '@/assets/fonts/DejaVuSansMono.ttf'
import DejaVuSansMonoBold from '@/assets/fonts/DejaVuSansMono-Bold.ttf'
import DejaVuSansMonoBoldOblique from '@/assets/fonts/DejaVuSansMono-BoldOblique.ttf'
import DejaVuSansMonoOblique from '@/assets/fonts/DejaVuSansMono-Oblique.ttf'

import { createGlobalStyle } from 'styled-components'

export const InjectFonts = createGlobalStyle`
  /*
 * Open Sans
 * https://fonts.googleapis.com/css?family=Open+Sans:300,300i,400,400i,600,600i,700,700i&amp;subset=latin-ext
 */
  @font-face {
    font-family: 'Open Sans';
    font-style: normal;
    font-weight: 300;
    src:
      local('Open Sans Light'),
      local('OpenSans-Light'),
      url(${OpenSansLight}) format('woff');
  }
  @font-face {
    font-family: 'Open Sans';
    font-style: italic;
    font-weight: 300;
    src:
      local('Open Sans Light Italic'),
      local('OpenSans-LightItalic'),
      url(${OpenSansLightItalic}) format('woff');
  }
  @font-face {
    font-family: 'Open Sans';
    font-style: normal;
    font-weight: 400;
    src:
      local('Open Sans Regular'),
      local('OpenSans-Regular'),
      url(${OpenSansRegular}) format('woff');
  }
  @font-face {
    font-family: 'Open Sans';
    font-style: italic;
    font-weight: 400;
    src:
      local('Open Sans Italic'),
      local('OpenSans-Italic'),
      url(${OpenSansItalic}) format('woff');
  }
  @font-face {
    font-family: 'Open Sans';
    font-style: normal;
    font-weight: 600;
    src:
      local('Open Sans SemiBold'),
      local('OpenSans-SemiBold'),
      url(${OpenSansSemiBold}) format('woff');
  }
  @font-face {
    font-family: 'Open Sans';
    font-style: italic;
    font-weight: 600;
    src:
      local('Open Sans SemiBold Italic'),
      local('OpenSans-SemiBoldItalic'),
      url(${OpenSansSemiBoldItalic}) format('woff');
  }
  @font-face {
    font-family: 'Open Sans';
    font-style: normal;
    font-weight: 700;
    src:
      local('Open Sans Bold'),
      local('OpenSans-Bold'),
      url(${OpenSansBold}) format('woff');
  }
  @font-face {
    font-family: 'Open Sans';
    font-style: italic;
    font-weight: 700;
    src:
      local('Open Sans Bold Italic'),
      local('OpenSans-BoldItalic'),
      url(${OpenSansBoldItalic}) format('woff');
  }

  /*
 * DejaVu Sans Mono
 */
  @font-face {
    font-family: 'DejaVu Sans Mono';
    src: local('DejaVu Sans Mono'), url(${DejaVuSansMono});
  }
  @font-face {
    font-family: 'DejaVu Sans Mono';
    font-weight: bold;
    src: url(${DejaVuSansMonoBold});
  }
  @font-face {
    font-family: 'DejaVu Sans Mono';
    font-style: oblique;
    font-weight: bold;
    src: url(${DejaVuSansMonoBoldOblique});
  }
  @font-face {
    font-family: 'DejaVu Sans Mono';
    font-style: italic;
    font-weight: bold;
    src: url(${DejaVuSansMonoBoldOblique});
  }
  @font-face {
    font-family: 'DejaVu Sans Mono';
    font-style: italic;
    src: url(${DejaVuSansMonoOblique});
  }
  @font-face {
    font-family: 'DejaVu Sans Mono';
    font-style: oblique;
    src: url(${DejaVuSansMonoOblique});
  }

`
