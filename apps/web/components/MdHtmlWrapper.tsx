import dynamic from 'next/dynamic'
import { darkTheme } from 'theme'
import Loading from './Loading'

// 动态导入RME的WysiwygThemeWrapper，禁用SSR
const RmeWysiwygThemeWrapper = dynamic(() => import('rme').then(mod => ({ default: mod.WysiwygThemeWrapper })), {
  ssr: false,
  loading: () => <Loading />,
})

const MdHtmlWrapper = ({ children, ...rest }: any) => {
  return (
    <RmeWysiwygThemeWrapper
      style={{
        whiteSpace: 'wrap',
      }}
      {...rest}
    >
      {children}
    </RmeWysiwygThemeWrapper>
  )
}

export default MdHtmlWrapper
