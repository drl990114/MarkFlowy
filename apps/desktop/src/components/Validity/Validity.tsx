import { Container } from './styles'

type ValidtyProps = {
  invalidText: string
  invalidState: boolean
} & Global.BaseComponentProps

export const Validity = (props: ValidtyProps) => {
  const { children, invalidText, invalidState, ...otherProps } = props
  return (
    <Container {...otherProps}>
      {children}
      {invalidState ? <div className='invalid-text'>{invalidText}</div> : null}
    </Container>
  )
}
