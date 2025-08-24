import { styled } from "styled-components"

const HighlightLink = styled.a`
  display: inline-block;
  position: relative;
  text-decoration: none;
  transition: color 0.2s ease;

  &:hover {
    &::before {
      height: 0.25em;
      border-radius: 2px;
    }
  }

  &::before {
    content: '';
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    height: 0.125em;
    border-radius: 6px;
    box-sizing: border-box;
    background-image: linear-gradient(to right, #47b6ff, #ec4899);
  }
`

export default HighlightLink
