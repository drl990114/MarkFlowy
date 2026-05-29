import { useContext } from 'react';
import { BounceLoader, PuffLoader } from 'react-spinners';
import type { LoaderSizeProps } from 'react-spinners/helpers/props';
import { ThemeContext } from '../Theme';

export const Loading = (props: LoaderSizeProps) => {
  const themeContext = useContext(ThemeContext);
  return <BounceLoader color={themeContext.accentColor} {...props} />;
};
