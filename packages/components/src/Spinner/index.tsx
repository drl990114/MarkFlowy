import { ThemeContext } from '@/Theme'
import { useContext } from 'react'
import type { LoaderSizeProps } from 'react-spinners/helpers/props'
import { PuffLoader } from 'react-spinners'

export const Loading = (props: LoaderSizeProps) => {
  const themeContext = useContext(ThemeContext)
  return <PuffLoader color={themeContext.accentColor} {...props} />
}
