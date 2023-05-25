import customColors from '@/colors'
import styled from 'styled-components'

export const MacOsContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  height: 30px;
  padding: 0 3px;
  user-select: none;
  background: ${customColors.bgColor};
  font-size: 0.8rem;
  z-index: 99999;

  .titlebar-text {
    flex-grow: 1;
    text-align: center;
    line-height: 30px;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
    cursor: default;
  }

  .titlebar-stoplight {
    flex-grow: 0;
    display: flex;
  }
  
  .titlebar-stoplight .titlebar-close,
  .titlebar-stoplight .titlebar-minimize,
  .titlebar-stoplight .titlebar-fullscreen {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin: 6px 4px;
    line-height: 0;
  }

  .titlebar-stoplight .titlebar-close {
    border: 1px solid #e2463f;
    background-color: #ff5f57;
    margin-left: 6px;
  }
  .titlebar-stoplight .titlebar-close:active {
    border-color: #ad3934;
    background-color: #bf4943;
  }
  .titlebar-stoplight .titlebar-close svg {
    width: 6px;
    height: 6px;
    margin-top: 2px;
    margin-left: 2px;
    opacity: 0;
  }
  .titlebar-stoplight .titlebar-minimize {
    border: 1px solid #e1a116;
    background-color: #ffbd2e;
  }
  .titlebar-stoplight .titlebar-minimize:active {
    border-color: #ad7d15;
    background-color: #bf9123;
  }
  .titlebar-stoplight .titlebar-minimize svg {
    width: 8px;
    height: 8px;
    margin-top: 1px;
    margin-left: 1px;
    opacity: 0;
  }
  .titlebar-stoplight .titlebar-fullscreen,
  .titlebar-stoplight .titlebar-maximize {
    border: 1px solid #12ac28;
    background-color: #28c940;
  }
  .titlebar-stoplight .titlebar-fullscreen:active {
    border-color: #128622;
    background-color: #1f9a31;
  }
  .titlebar-stoplight .titlebar-fullscreen svg.fullscreen-svg {
    width: 6px;
    height: 6px;
    margin-top: 2px;
    margin-left: 2px;
    opacity: 0;
  }
  .titlebar-stoplight .titlebar-fullscreen svg.maximize-svg {
    width: 8px;
    height: 8px;
    margin-top: 1px;
    margin-left: 1px;
    opacity: 0;
    display: none;
  }
  .titlebar-stoplight:hover svg,
  .titlebar-stoplight:hover svg.fullscreen-svg,
  .titlebar-stoplight:hover svg.maximize-svg {
    opacity: 1;
  }

  .titlebar:after,
  .titlebar-stoplight:after {
    content: ' ';
    display: table;
    clear: both;
  }
`

export const OtherOsContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  height: 30px;
  user-select: none;
  font-size: 0.8rem;
  background: ${customColors.bgColor};
  z-index: 99999;

  .titlebar-button {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 30px;
    height: 30px;

    &:hover {
      background-color: ${customColors.tipsBgColor};
    }
  }

  #titlebar-close:hover {
    background-color: ${customColors.warnColor};
  }

  .titlebar-icon {
    width: 30px;
    text-align: center;
    cursor: pointer;
  }
`
