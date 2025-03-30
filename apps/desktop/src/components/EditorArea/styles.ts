import styled from 'styled-components'

export const Container = styled.div`
  position: relative;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  display: flex;
  flex-direction: column;

  .editor-area-header {
    padding: 0 0.5rem;
    display: flex;
    flex: initial;
    align-items: center;
    justify-content: flex-end;
    box-sizing: border-box;
    z-index: 10;
  }

  .code-contents {
    flex: 1;
    width: 100%;
    height: 100%;
    overflow: auto;
    scroll-behavior: smooth;
  }
`

export const TabItem = styled.div<TabItemProps>`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 ${(props) => props.theme.spaceXs};
  font-size: ${(props) => props.theme.fontXs};
  border-top: 2px solid ${(props) => (props.active ? props.theme.accentColor : 'transparent')};
  background-color: ${(props) =>
    props.active ? props.theme.editorTabActiveBgColor : props.theme.editorTabBgColor};
  height: calc(100% + 2px);
  box-sizing: border-box;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none; /* Safari */
  -moz-user-select: none; /* Firefox */
  -ms-user-select: none; /* Edge, IE */

  &:hover {
    background-color: ${(props) => props.theme.hoverColor};
  }

  .close {
    cursor: pointer;
    opacity: 0;
  }

  &:hover {
    .close {
      opacity: 1;
    }
  }
`

type DotProps = {
  color?: string
}

export const Dot = styled.div<DotProps>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: ${(props) => props.color || props.theme.warnColor};
  margin: 0 0.25rem;
`

interface TabItemProps {
  active: boolean
}

export const WarningHeader = styled.h3`
  text-align: center;
  color: ${(props) => props.theme.dangerColor};
`

export const EditorPathContainer = styled.div`
  font-size: 0.85em;
  padding: 1em;
  cursor: pointer;
  transition: color 0.2s ease-in-out;

  &:hover {
    color: ${(props) => props.theme.accentColor};
  }
`
