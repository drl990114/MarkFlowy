declare global {
  interface BaseComponentProps {
    className?: string
    children?: ReactChild | ReactFragment | ReactPortal | boolean | null | undefined
  }

  interface Window {
    __MF__: MF_CONTEXT
  }
}

export {}
