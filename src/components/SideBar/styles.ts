import styled from 'styled-components'

export const Container = styled.div`
  .app-sidebar {
    flex-grow: 0;
    flex-shrink: 0;
    min-width: 150px;
    max-width: 300px;
    display: flex;
    border-right: #e9e9e9 1px solid;
    flex-direction: row;
    background: #ffffff;
    box-shadow: -8px 2px 22px -7px rgba(0, 0, 0, 0.25);
    border-radius: 10px 0px 0px 10px;
    z-index: 2;
  }

  .app-sidebar .app-sidebar-content {
    flex: 1;
  }

  .app-sidebar .app-sidebar-resizer {
    flex-grow: 0;
    flex-shrink: 0;
    flex-basis: 6px;
    justify-self: flex-end;
    cursor: col-resize;
    resize: horizontal;
  }

  .app-sidebar .app-sidebar-resizer:hover {
    width: 3px;
    background: #c1c3c5b4;
  }
`
