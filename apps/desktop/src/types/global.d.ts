declare global {
  interface BaseComponentProps {
    className?: string
    children?: ReactChild | ReactFragment | ReactPortal | boolean | null | undefined
  }
}

export {}
