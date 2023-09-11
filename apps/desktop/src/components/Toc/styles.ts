import styled from "styled-components"
import type { ITocListProps } from "./type"
import type { ScThemeProps } from "@linebyline/editor"

export const TocDiv = styled.div`
position: relative;
  height: 100%;
  width: 100%;
  line-height: 2em;
  padding-bottom: 0.5rem;
  overflow-x: hidden;
  text-overflow: ellipsis;
  font-size: 0.9rem;
  box-sizing: border-box;

  .toc-title {
    position: sticky;
    top: 0;
    padding: 0.3rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: ${(props: ScThemeProps) => props.theme.bgColor};
    color: ${(props: ScThemeProps) => props.theme.primaryFontColor};
    z-index: 1;
  }

  nav {
    width: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
`
export const TocLink = styled.a`
  color: ${(props: ITocListProps & ScThemeProps) => (props.active ? props.theme.primaryFontColor : props.theme.labelFontColor)};
  font-weight: ${(props: ITocListProps) => props.active ? `600` : '400'};
  display: block;
  box-shadow: none;
  text-decoration: none;
  overflow-x: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const listItemShiftWidthEm = 1

export const TocListItem = styled.li`
  margin: 0;
  list-style: none;
  position: relative;
  display: flex;
  align-items: center;
  padding-left: ${(props: ITocListProps) =>
    `${(props.depth + 1) * listItemShiftWidthEm}em`};
  &:hover {
    color: #fff;
  }
`
