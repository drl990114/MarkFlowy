import { useOutlet, usePrefersColor } from 'dumi';
import { ThemeProvider, Notifications } from '../../../src';

const GlobalLayout = () => {
  const [color] = usePrefersColor();
  const outlet = useOutlet();

  return (
    <ThemeProvider
      theme={{
        mode: color,
      }}
    >
      {outlet}
      <Notifications />
    </ThemeProvider>
  );
};

export default GlobalLayout;
