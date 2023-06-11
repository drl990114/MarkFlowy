import { useHelpers } from '@remirror/react-core';
import React from 'react';

import { TableStyled } from './styles';
import { TableCellMenu, TableCellMenuProps } from './table-cell-menu';
import { TableDeleteButton, TableDeleteButtonProps } from './table-delete-table-button';

export interface TableComponentsProps {
  /**
   * Whether to use `TableCellMenu`.
   *
   * @defaultValue true
   */
  enableTableCellMenu?: boolean;

  /**
   * The props that will passed to `TableCellMenu`
   */
  tableCellMenuProps?: TableCellMenuProps;

  /**
   * Whether to use `TableDeleteRowColumnButton`.
   *
   * @defaultValue true
   */
  enableTableDeleteRowColumnButton?: boolean;
  
  /**
   * Whether to use `TableDeleteButton`.
   *
   * @defaultValue true
   */
  enableTableDeleteButton?: boolean;

  /**
   * The props that will passed to `TableDeleteButton`
   */
  tableDeleteButtonProps?: TableDeleteButtonProps;
}

export const TableComponents: React.FC<TableComponentsProps> = ({
  enableTableCellMenu = true,
  enableTableDeleteButton = true,
  tableCellMenuProps,
  tableDeleteButtonProps,
}) => {
  const { isViewEditable } = useHelpers();

  if (!isViewEditable()) {
    return null;
  }

  return (
    <>
      <TableStyled />
      {enableTableCellMenu && <TableCellMenu {...tableCellMenuProps} />}
      {enableTableDeleteButton && <TableDeleteButton {...tableDeleteButtonProps} />}
    </>
  );
};
