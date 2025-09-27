import React, { ReactElement } from 'react'
import styled from 'styled-components'
import useResizeObserver from 'use-resize-observer'
import mergeRefs from './merge-refs'

type Props = {
  children: (dimens: { width: number; height: number }) => ReactElement
}

const style = {
  flex: 1,
  width: '100%',
  height: '100%',
  minHeight: 0,
  minWidth: 0,
}

const Container = styled.div`
  ::-webkit-scrollbar {
    display: none;
  }

  .indentLines {
    --indent-size: 16px;

    position: absolute;
    top: 0;
    left: 4px;
    z-index: -1;
    display: flex;
    align-items: flex-start;
    height: 100%;
  }

  .indentLines > div {
    height: 100%;
    padding-left: 10px;
    border-right: 1px solid ${props => props.theme.fileTreeIndentLineColor};
    margin-right: calc(var(--indent-size) - 10px - 1px);
  }
`
export const FillFlexParent = React.forwardRef(function FillFlexParent(props: Props, forwardRef) {
  const { ref, width, height } = useResizeObserver()
  return (
    <Container style={style} ref={mergeRefs(ref, forwardRef)}>
      {width && height ? props.children({ width, height }) : null}
    </Container>
  )
})
