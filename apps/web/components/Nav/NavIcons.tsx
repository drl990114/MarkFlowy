import styled from 'styled-components';

export const Svg = styled.svg`
  svg {
    display: inline-block;

    path {
      fill: currentColor;
    }
  }
`;

export const CloseIcon = () => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" xmlnsXlink="http://www.w3.org/1999/xlink">
    <title>close</title>
    <use fill="#FFF" xlinkHref="#close" transform="translate(1 1)" />
    <defs>
      <path id="close" d="M-.7.7l13 13 1.4-1.4-13-13L-.7.7zm13-1.4l-13 13 1.4 1.4 13-13-1.4-1.4z" />
    </defs>
  </Svg>
);

export const FoldIcon = () => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="17" height="14" xmlnsXlink="http://www.w3.org/1999/xlink">
    <title>fold</title>
    <use fill="#FFF" xlinkHref="#fold" transform="translate(0 1)" />
    <defs>
      <path id="fold" d="M0 1h17v-2H0v2zm17 4H0v2h17V5zM0 13h17v-2H0v2z" />
    </defs>
  </Svg>
);

export const ArrowIcon = () => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="12" height="8" xmlnsXlink="http://www.w3.org/1999/xlink">
    <title>arrow down</title>
    <use fill="#FFF" xlinkHref="#menuArrow" transform="translate(1 1)" />
    <defs>
      <path
        id="menuArrow"
        d="M5 5l-.7.7.7.7.7-.7L5 5zM9.3-.7l-5 5 1.4 1.4 5-5L9.3-.7zm-3.6 5l-5-5L-.7.7l5 5 1.4-1.4z"
      />
    </defs>
  </Svg>
);
export const SearchIcon = () => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="12" height="8" xmlnsXlink="http://www.w3.org/1999/xlink">
    <title>arrow down</title>
    <use fill="#FFF" xlinkHref="#menuSearch" transform="translate(1 1)" />
    <defs>
      <path
        id="menuSearch"
        d="M18.125,15.804l-4.038-4.037c0.675-1.079,1.012-2.308,1.01-3.534C15.089,4.62,12.199,1.75,8.584,1.75C4.815,1.75,1.982,4.726,2,8.286c0.021,3.577,2.908,6.549,6.578,6.549c1.241,0,2.417-0.347,3.44-0.985l4.032,4.026c0.167,0.166,0.43,0.166,0.596,0l1.479-1.478C18.292,16.234,18.292,15.968,18.125,15.804 M8.578,13.99c-3.198,0-5.716-2.593-5.733-5.71c-0.017-3.084,2.438-5.686,5.74-5.686c3.197,0,5.625,2.493,5.64,5.624C14.242,11.548,11.621,13.99,8.578,13.99 M16.349,16.981l-3.637-3.635c0.131-0.11,0.721-0.695,0.876-0.884l3.642,3.639L16.349,16.981z"
      />
    </defs>
  </Svg>
);
