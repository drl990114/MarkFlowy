import type { CSSProperties } from 'react';
import styled from 'styled-components';

interface ImageEmptyProps {
  emptyTip?: string;
  style?: CSSProperties;
  className?: string;
  width?: number | string;
  height?: number | string;
}
export const ImageEmpty = (props: ImageEmptyProps) => {
  const { emptyTip, style, className, width = 100, height = 100 } = props;
  const resolvedStyle = { width, height, ...style };
  return (
    <Container style={resolvedStyle} className={className}>
      {emptyTip || 'Empty source'}
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${(props) => props.theme.secondaryFontColor};
  border: 1px solid ${(props) => props.theme.borderColor};
  background: ${(props) => props.theme.tipsBgColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  font-size: ${(props) => props.theme.fontSm};
`;
