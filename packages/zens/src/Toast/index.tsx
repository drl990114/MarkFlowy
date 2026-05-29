import { useContext } from 'react';
import { Toaster } from 'sonner';
import { ThemeContext } from 'styled-components';

export { toast } from 'sonner';

export type Variant = 'default' | 'error' | 'warning' | 'info' | 'success';

export const Notifications = () => {
  const context = useContext(ThemeContext);

  return (
    <Toaster
      expand={false}
      closeButton
      toastOptions={{
        style: {
          borderColor: context?.borderColor,
          borderRadius: context?.smallBorderRadius,
          color: context?.primaryFontColor,
          background: context?.bgColor,
        },
        duration: 5000,
      }}
    />
  );
};
