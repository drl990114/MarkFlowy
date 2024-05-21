import React, { ReactElement } from "react";
import mergeRefs from "./merge-refs";
import useResizeObserver from "use-resize-observer";
import styled from "styled-components";

type Props = {
  children: (dimens: { width: number; height: number }) => ReactElement;
};

const style = {
  flex: 1,
  width: "100%",
  height: "100%",
  minHeight: 0,
  minWidth: 0,
};

const Container = styled.div`
.indentLines {
    --indent-size: 15px;

    position: absolute;
    top: 0;
    left: 0;
    z-index: -1;
    display: none;
    align-items: flex-start;
    height: 100%;
}

.indentLines > div {
    height: 100%;
    padding-left: 8px;
    border-right: 1px solid #999;
    margin-right: calc(16px - 8px - 1px);
}
`
export const FillFlexParent = React.forwardRef(function FillFlexParent(
  props: Props,
  forwardRef
) {
  const { ref, width, height } = useResizeObserver();
  return (
    <Container style={style} ref={mergeRefs(ref, forwardRef)}>
      {width && height ? props.children({ width, height }) : null}
    </Container>
  );
});
