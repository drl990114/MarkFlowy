import ErrorTip from './ErrorTip';
import Img, { type ImgProps as RcImageProps } from './Img';
import { Loading } from '../Loading';

interface ImageProps extends RcImageProps {
  errorTip?: string;
  emptyImage?: JSX.Element | null;
  emptyTip?: string;
}

const ImageView = (props: ImageProps) => {
  const { errorTip = 'load error' } = props;
  return (
    <Img
      loader={<Loading size={40} />}
      unloader={<ErrorTip errortip={errorTip} />}
      {...props}
    />
  );
};

export default ImageView;
