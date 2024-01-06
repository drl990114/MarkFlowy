import { memo, useContext } from 'react'
import { ToastBar, Toaster, toast } from 'react-hot-toast'
import styled, { ThemeContext } from 'styled-components'
export { toast } from 'react-hot-toast'

export type Variant = 'default' | 'error' | 'warning' | 'info' | 'success'

const MfToaster = memo(() => {
  const context = useContext(ThemeContext)

  return (
    <Toaster
      toastOptions={{
        className: 'mf-toast',
        style: {
          border: `1px solid ${context?.borderColor}`,
          borderRadius: context?.smallBorderRadius,
          color: context?.primaryFontColor,
          fontSize: context?.fontSm,
          background: context?.bgColor,
          padding: context?.spaceXs,
        },
      }}
    >
      {(t) => (
        <ToastBar toast={t}>
          {({ icon, message }) => (
            <>
              {icon}
              {message}
              {t.type !== 'loading' && (
                <ToastDismiss className='mf-toast__dismiss' onClick={() => toast.dismiss(t.id)}>
                  x
                </ToastDismiss>
              )}
            </>
          )}
        </ToastBar>
      )}
    </Toaster>
  )
})

export const Notifications = styled(MfToaster)`
  .mf-toast {
    &__dismiss {
      padding: ${({ theme }) => theme?.spaceXs};
      cursor: pointer;

      &:hover {
        background: ${({ theme }) => theme?.accentColor};
      }
    }
  }
`

const ToastDismiss = styled.div`
  padding: ${({ theme }) => theme?.spaceXs} ${({ theme }) => theme?.spaceSm};
  border-radius: ${({ theme }) => theme?.smallBorderRadius};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme?.accentColor};
  }
`
