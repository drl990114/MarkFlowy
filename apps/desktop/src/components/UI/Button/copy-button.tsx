import classNames from 'classnames'
import styled from 'styled-components'
import type { FC } from 'react'
import { useCallback, useState } from 'react'
import { writeText } from '@tauri-apps/api/clipboard'

type CopyBtnProps = {
  text: string
}

type ContainerProps = {
  checking: boolean
}

const Container = styled.span<ContainerProps>`
  padding: 4px;
  cursor: pointer;
  color: ${(props) => (props.checking ? props.theme.successColor : props.theme.primaryFontColor)};
`

export const CopyButton: FC<CopyBtnProps> = (props) => {
  const { text } = props
  const [checking, setChecking] = useState(false)

  const copy = useCallback(async () => {
    if (checking) return

    setChecking(true)

    await writeText(text)

    setTimeout(() => {
      setChecking(false)
    }, 3000)
  }, [checking, text])

  const iconCls = classNames({
    'ri-file-copy-line': !checking,
    'ri-check-fill': checking,
  })

  return (
    <Container checking={checking} onClick={copy}>
      <i className={iconCls}></i>
    </Container>
  )
}
