declare global {
  interface BaseComponentProps {
    className?: string
    children?: ReactChild | ReactFragment | ReactPortal | boolean | null | undefined
  }

  enum PromiseStatus {
    Pending = 'pending',
    Resolved = 'resolved',
    Rejected = 'rejected',
  }
}

export {}
