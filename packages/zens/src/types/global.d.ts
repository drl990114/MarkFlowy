declare global {
  interface BaseComponentProps {
    className?: string
    style?: CSSProperties
    children?: ReactChild | ReactFragment | ReactPortal | boolean | null | undefined
  }
}

export {}
