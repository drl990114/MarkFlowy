import type { ReactElement } from 'react'
import ErrorTip from './ErrorTip'
import Img, { type ImgProps as RcImageProps } from './Img'
import { Loading } from '../Loading'

export interface ImageProps extends RcImageProps {
  errorTip?: string
  emptyImage?: ReactElement | null
  emptyTip?: string
}

const ImageView = (props: ImageProps) => {
  const { errorTip = 'load error' } = props
  return (
    <Img loader={<Loading size={40} />} unloader={<ErrorTip errortip={errorTip} />} {...props} />
  )
}

export default ImageView
