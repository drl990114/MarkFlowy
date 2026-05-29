import { Icon } from '@/index';

import ErrorTip from './ErrorTip';
import Img, { ImgProps as RcImageProps } from './Img';

interface ImageProps extends RcImageProps {
  errorTip?: string;
  emptyImage?: JSX.Element | null;
  emptyTip?: string;
}

const ImageView = (props: ImageProps) => {
  const { errorTip = 'load error' } = props;
  return (
    <Img
      loader={<Icon.Loading3QuartersOutlined spin size={40} />}
      unloader={<ErrorTip errortip={errorTip} />}
      {...props}
    />
  );
};

export default ImageView;
