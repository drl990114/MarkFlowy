import React from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { DocsSidebarMenu, SimpleSidebarMenu, SimpleSidebarMenuProps } from './SidebarMenus';

export interface NavProps {
  isSideFolded?: boolean;
  isMobileNavFolded?: boolean;
  onSideToggle?: () => void;
  onMobileNavToggle?: () => void;
  showSideNav?: boolean;
  useDocsSidebarMenu?: boolean;
  pages?: SimpleSidebarMenuProps['pages'];
}

const Nav = (props: NavProps) => {
  const { isSideFolded, isMobileNavFolded, onSideToggle, onMobileNavToggle, showSideNav, useDocsSidebarMenu, pages } =
    props;

  return (
    <div>
      <Navbar
        showSideNav={showSideNav}
        isSideFolded={isSideFolded}
        isMobileNavFolded={isMobileNavFolded}
        onSideToggle={onSideToggle}
        onMobileNavToggle={onMobileNavToggle}
      />

      {showSideNav !== false && (
        <Sidebar $isFolded={isSideFolded}>
          {useDocsSidebarMenu !== false ? <DocsSidebarMenu /> : <SimpleSidebarMenu pages={pages} />}
        </Sidebar>
      )}
    </div>
  );
};

export default Nav;
