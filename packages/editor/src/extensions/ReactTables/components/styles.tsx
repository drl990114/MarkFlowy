// import { MThemeProps } from '@/hooks/useTheme'
import { createGlobalStyle } from 'styled-components'

export const TableStyled = createGlobalStyle<any>`
  .remirror-table-colgroup > col:first-of-type {
    width: 13px;
    overflow: visible;
  }

  .remirror-controllers-toggle {
    visibility: hidden;
  }

  .remirror-table-show-controllers .remirror-controllers-toggle {
    visibility: visible;
  }

  .remirror-table-insert-button {
    position: absolute;
    width: 18px;
    height: 18px;
    z-index: 25;
    cursor: pointer;
    border-radius: 4px;
    transition: background-color 150ms ease;

    background-color: ${(props) => props.theme.tipsBgColor};
  }

  .remirror-table-insert-button svg {
    fill: ${(props) => props.theme.borderColor};
  }

  .remirror-table-insert-button:hover {
    background-color: ${(props) => props.theme.borderColor};
  }

  .remirror-table-insert-button:hover svg {
    fill: ${(props) => props.theme.borderColor};
  }

  .remirror-table-delete-inner-button {
    border: none;
    padding: 0;
    width: 18px;
    height: 18px;

    position: absolute;
    z-index: 30;
    cursor: pointer;
    border-radius: 4px;
    background-color: ${(props) => props.theme.borderColor};
    transition: background-color 150ms ease;

    &:hover {
      background-color: ${(props) => props.theme.warnColor};
    }
  }

  .remirror-table-delete-table-inner-button {
    top: 9px;
    left: 9px;
  }

  /* To show marks */
  .ProseMirror table.remirror-table-with-controllers {
    overflow: visible;
  }

  .remirror-table-waitting-controllers {
    /* Hide the table before controllers injected */
    display: none;
  }

  /* First row contains one corner controller and multiple column controllers */

  .remirror-table-tbody-with-controllers > tr:nth-of-type(1) {
    height: 12px;
    overflow: visible;
  }

  /* First controller cell is the corner controller */

  .remirror-table-tbody-with-controllers > tr:nth-of-type(1) th:nth-of-type(1) {
    overflow: visible;
    padding: 0;
    cursor: pointer;
    z-index: 15;
    position: relative;
    height: 12px;
    width: 12px;
  }

  .remirror-table-tbody-with-controllers > tr:nth-of-type(1) th:nth-of-type(1) div.remirror-table-controller-wrapper {
    overflow: visible;
    display: flex;
    justify-content: flex-end;
    align-items: flex-end;
    width: 12px;
    height: 12px;
  }

  .remirror-table-tbody-with-controllers > tr:nth-of-type(1) th:nth-of-type(1) div.remirror-table-controller-trigger-area {
    flex: 1;
    position: relative;
    z-index: 10;
    display: none;
  }

  .remirror-table-tbody-with-controllers > tr:nth-of-type(1) th:nth-of-type(1) div.remirror-table-controller-mark-row-corner {
    bottom: -2px;
    left: -12px;
    position: absolute;
    width: 0px;
    height: 0px;
    border-radius: 50%;
    border-style: solid;
    border-color: ${(props) => props.theme.borderColor};
    border-width: 2px;
  }

  .remirror-table-tbody-with-controllers > tr:nth-of-type(1) th:nth-of-type(1) div.remirror-table-controller-mark-column-corner {
    position: absolute;
    width: 0px;
    height: 0px;
    border-radius: 50%;
    border-style: solid;
    border-color: ${(props) => props.theme.borderColor};
    border-width: 2px;
    right: -2px;
    top: -12px;
  }

  /* Second and more cells are column controllers */

  .remirror-table-tbody-with-controllers > tr:nth-of-type(1) th:nth-of-type(n + 2) {
    overflow: visible;
    padding: 0;
    cursor: pointer;
    z-index: 15;
    position: relative;
    height: 12px;
  }

  .remirror-table-tbody-with-controllers > tr:nth-of-type(1) th:nth-of-type(n + 2) div.remirror-table-controller-wrapper {
    overflow: visible;
    display: flex;
    justify-content: flex-end;
    align-items: flex-end;
    width: 100%;
    height: 12px;
    flex-direction: row;
  }

  .remirror-table-tbody-with-controllers > tr:nth-of-type(1) th:nth-of-type(n + 2) div.remirror-table-controller-trigger-area {
    flex: 1;
    position: relative;
    z-index: 10; /* Style for debug. Use linear-gradient as background so that we can differentiate two neighbor areas. */ /* background: linear-gradient(to left top, rgba(0, 255, 100, 0.2), rgba(200, 100, 255, 0.2)); */
    height: 36px;
  }

  .remirror-table-tbody-with-controllers > tr:nth-of-type(1) th:nth-of-type(n + 2) div.remirror-table-controller-mark-row-corner {
    display: none;
  }

  .remirror-table-tbody-with-controllers > tr:nth-of-type(1) th:nth-of-type(n + 2) div.remirror-table-controller-mark-column-corner {
    position: absolute;
    width: 0px;
    height: 0px;
    border-radius: 50%;
    border-style: solid;
    border-color: ${(props) => props.theme.borderColor};
    border-width: 2px;
    right: -2px;
    top: -12px;
  }

  /* Second and more rows containes row controllers */

  /* First controller cell in each row is a row controller */

  .remirror-table-tbody-with-controllers > tr:nth-of-type(n + 2) th {
    overflow: visible;
    padding: 0;
    cursor: pointer;
    z-index: 15;
    position: relative;
    width: 12px;
  }

  .remirror-table-tbody-with-controllers > tr:nth-of-type(n + 2) th div.remirror-table-controller-wrapper {
    overflow: visible;
    display: flex;
    justify-content: flex-end;
    align-items: flex-end;
    height: 100%;
    width: 12px;
    flex-direction: column;
  }

  .remirror-table-tbody-with-controllers > tr:nth-of-type(n + 2) th div.remirror-table-controller-trigger-area {
    flex: 1;
    position: relative;
    z-index: 10; /* Style for debug. Use linear-gradient as background so that we can differentiate two neighbor areas. */ /* background: linear-gradient(to left top, rgba(0, 255, 100, 0.2), rgba(200, 100, 255, 0.2)); */
    width: 36px;
  }

  .remirror-table-tbody-with-controllers > tr:nth-of-type(n + 2) th div.remirror-table-controller-mark-row-corner {
    bottom: -2px;
    left: -12px;
    position: absolute;
    width: 0px;
    height: 0px;
    border-radius: 50%;
    border-style: solid;
    border-color: ${(props) => props.theme.borderColor};
    border-width: 2px;
  }

  .remirror-table-tbody-with-controllers > tr:nth-of-type(n + 2) th div.remirror-table-controller-mark-column-corner {
    display: none;
  }

  /* Styles for default */

  .remirror-editor.ProseMirror th.selectedCell,
  .remirror-editor.ProseMirror td.selectedCell {
    border-color: ${(props) => props.theme.borderColor} !important;
    background-color: ${(props) => props.theme.accentColor} !important;
  }

  .remirror-table-tbody-with-controllers th.remirror-table-controller {
    background-color: ${(props) => props.theme.tipsBgColor};
  }

  /* Styles for selected */
  .remirror-table-tbody-with-controllers th.selectedCell.remirror-table-controller {
    background-color: ${(props) => props.theme.tipsBgColor};
  }

  /* Styles for predelete */

  .remirror-table-show-predelete.remirror-table-preselect-all th.selectedCell,
  .remirror-table-show-predelete.remirror-table-preselect-all td.selectedCell {
    border-color: ${(props) => props.theme.borderColor} !important;
    background-color: ${(props) => props.theme.warnColor} !important;
  }

  .remirror-table-show-predelete th.selectedCell {
    background-color: ${(props) => props.theme.warnColor} !important;
  }

  .remirror-table-show-predelete.remirror-table-preselect-all th,
  .remirror-table-show-predelete.remirror-table-preselect-all td {
    border-color: ${(props) => props.theme.borderColor} !important;
    background-color: ${(props) => props.theme.warnColor} !important;
  }

  .remirror-menu-item {
    background-color: ${props => props.theme.bgColor};
    color: ${props => props.theme.primaryFontColor}
  }
`
