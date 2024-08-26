import * as CSS from 'csstype';
import styled from 'styled-components';

export interface ImageProps {
  caption?: string;
  captionSpacing?: number;
  height: number;
  margin?: number;
  renderImage: (props: Pick<ImageProps, 'src' | 'video'>) => React.ReactNode;
  src: string;
  video?: boolean;
  width: number;
}

export default function Image({
  caption,
  captionSpacing,
  height,
  margin = 40,
  renderImage,
  width,
  ...rest
}: ImageProps) {
  const aspectRatio = String((height / width) * 100) + '%';

  return (
    <Figure $margin={margin}>
      <Main $width={width}>
        <ImageWrapper $aspectRatio={aspectRatio}>{renderImage && renderImage(rest)}</ImageWrapper>

        {caption && <Caption $captionSpacing={captionSpacing}>{caption}</Caption>}
      </Main>
    </Figure>
  );
}

export interface VideoProps extends ImageProps {}

export const Video = (props: VideoProps) => <Image {...props} video />;

// This component might look a little complex
// because one could argue that keeping the aspect ratio
// of an image can be solved with `height: auto`,
// but it's actually not that easy if you want to prevent
// element flickering

// Because if you want to do that, you need to set the aspect
// ratio of the image's container BEFORE the image loads

const Figure = styled.figure<{ $margin: number }>`
  display: block;
  text-align: center;
  margin: ${props => props.$margin}px 0;
  max-width: 100%;

  & img {
    height: 100%;
    left: 0;
    position: absolute;
    top: 0;
    width: 100%;
  }

  & .fade-enter {
    opacity: 0.01;
  }

  & .fade-enter.fade-enter-active {
    opacity: 1;
    transition: opacity 500ms ease-in;
  }

  & .fade-exit {
    opacity: 1;
  }

  & .fade-exit.fade-exit-active {
    opacity: 0.01;
    transition: opacity 300ms ease-in;
  }
`;

const Main = styled.div<{ $width: number }>`
  margin: 0 auto;
  max-width: 100%;
  width: ${props => props.$width}px;
`;

const Caption = styled.p<{ $captionSpacing?: number }>`
  color: #999;
  font-size: 12px;
  margin: 0;
  text-align: center;
  ${props => (props.$captionSpacing ? `margin-top: ${props.$captionSpacing}px;` : '')};
`;

const ImageWrapper = styled.div<{ $aspectRatio: CSS.Properties['paddingBottom'] }>`
  position: relative;
  padding-bottom: ${props => props.$aspectRatio};
`;
