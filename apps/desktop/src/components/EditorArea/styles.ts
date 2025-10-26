import styled from 'styled-components'

export const Container = styled.div`
  position: relative;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  display: flex;
  flex-direction: column;

  .editor-area-header {
    display: flex;
    flex: initial;
    align-items: center;
    justify-content: flex-end;
    box-sizing: border-box;
    z-index: 10;
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
    border-left: 1px solid ${(props) => props.theme.borderColor};
  }

  .code-contents {
    flex: 1;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
`

export const TabItem = styled.div<TabItemProps>`
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  top: 1px;
  padding-left: ${(props) => props.theme.spaceXl};
  padding-right: ${(props) => props.theme.spaceXs};
  font-size: ${(props) => props.theme.fontXs};
  border-left: 1px solid ${(props) => props.theme.borderColor};
  background-color: ${(props) =>
    props.active ? props.theme.editorTabActiveBgColor : props.theme.editorTabBgColor};
  border-bottom: 2px solid
    ${(props) => (props.active ? props.theme.editorTabActiveBgColor : props.theme.borderColor)};
  box-sizing: border-box;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none; /* Safari */
  -moz-user-select: none; /* Firefox */
  -ms-user-select: none; /* Edge, IE */

  &:first-child {
    border-left: none;
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
