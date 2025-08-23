import { KeyboardArrowDown } from '@styled-icons/material/KeyboardArrowDown/KeyboardArrowDown';
import styled, { css } from 'styled-components';
import { mobile } from '../../utils/media';
import rem from '../../utils/rem';
import { navbarHeight } from '../../utils/sizes';
import NavButton from './NavButton';
import { CloseIcon, FoldIcon } from './NavIcons';
import NavLinks from './NavLinks';

export interface MobileNavbarProps {
  isMobileNavFolded?: boolean;
  isSideFolded?: boolean;
  onMobileNavToggle?: () => void;
  onSideToggle?: () => void;
  showSideNav?: boolean;
}

export default function MobileNavbar({
  children,
  isMobileNavFolded,
  isSideFolded,
  onMobileNavToggle,
  onSideToggle,
  showSideNav,
}: React.PropsWithChildren<MobileNavbarProps>) {
  return (
    <Wrapper>
      {showSideNav !== false && (
        <NavButton onClick={onSideToggle}>{isSideFolded ? <FoldIcon /> : <CloseIcon />}</NavButton>
      )}

      MarkFlowy
      {children}

      <NavButton onClick={onMobileNavToggle} style={{ position: 'absolute', right: 0 }}>
        <ArrowWrapper $shouldRotate={!isMobileNavFolded}>
          <StyledIcon as={KeyboardArrowDown} $size={36} />
        </ArrowWrapper>
      </NavButton>

      <SecondaryMenu $isOpen={!isMobileNavFolded}>
        <NavLinks />
      </SecondaryMenu>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  display: none;

  ${mobile(css`
    align-items: center;
    display: flex;
    height: ${rem(navbarHeight)};
    justify-content: space-between;
    margin-left: 16px;

    > ${NavButton} {
      margin-left: -8px;
    }
  `)};
`;

const SecondaryMenu = styled.div<{ $isOpen?: boolean }>`
  position: absolute;
  top: ${rem(navbarHeight)};
  left: 0;
  right: 0;

  ${p =>
    p.$isOpen
      ? css`
          height: ${rem(navbarHeight)};
        `
      : css`
          height: 0;
        `};
  -webkit-overflow-scrolling: touch;
  align-items: center;
  background: rgba(33, 33, 33, 0.9);
  backdrop-filter: blur(5px);
  color: #fff;
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  overflow-x: overlay;
  overflow-y: hidden;
  padding: 0 ${rem(20)};
  transition: height 0.1s;
  user-select: none;
`;

const ArrowWrapper = styled.div<{ $shouldRotate?: boolean }>`
  transition: transform 0.2s;

  ${p =>
    p.$shouldRotate &&
    css`
      transform-origin: center center;
      transform: rotate(180deg);
    `};
`;

const StyledIcon = styled.div<{ $size?: number }>`
  && {
    width: ${p => rem(p.$size || 20)};
    height: ${p => rem(p.$size || 20)};
  }
`;
