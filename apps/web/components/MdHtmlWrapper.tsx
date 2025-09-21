import { darkTheme } from 'theme'
import Loading from './Loading'
import { useRmeWrapper } from '../hooks/useRme'

const MdHtmlWrapper = ({ children, ...rest }: any) => {
  const { WysiwygThemeWrapper, loading, error } = useRmeWrapper()

  if (loading) {
    return <Loading />
  }

  if (error) {
    return <div>Error loading wrapper: {error.message}</div>
  }

  if (!WysiwygThemeWrapper) {
    return <Loading />
  }

  return (
    <WysiwygThemeWrapper
      style={{
        whiteSpace: 'wrap',
      }}
      {...rest}
    >
      {children}
    </WysiwygThemeWrapper>
  )
}

export default MdHtmlWrapper
