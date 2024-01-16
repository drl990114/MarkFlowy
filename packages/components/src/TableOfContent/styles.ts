import styled from 'styled-components'
import type { ITocListProps } from './type'
import { darken, type ScThemeProps } from '@markflowy/theme'

export const TocDiv = styled.div`
  position: relative;
  height: 100%;
  width: 100%;
  line-height: 2em;
  padding-bottom: 0.5rem;
  overflow-x: hidden;
  text-overflow: ellipsis;
  font-size: 0.8rem;
  box-sizing: border-box;

  .toc-list {
    height: 100%;
    padding: 0.2rem 1rem;
    overflow: auto;
    box-sizing: border-box;
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
export const TocLink = styled.a<ITocListProps & ScThemeProps>`
  color: ${(props) => (props.active ? props.theme.primaryFontColor : props.theme.labelFontColor)};
  font-weight: ${(props) => (props.active ? `600` : '400')};
  display: block;
  box-shadow: none;
  text-decoration: none;
  overflow-x: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  & .toc-link__chapter {
    margin-right: ${(props) => props.theme.spaceXs};
    text-align: right;
    color: ${(props) =>
      props.active ? props.theme.accentColor : darken(props.theme.accentColor, 0.4)};
    font-weight: bold;
  }
`

const listItemShiftWidthEm = 1

export const TocListItem = styled.li<ITocListProps>`
  margin: 0;
  list-style: none;
  position: relative;
  display: flex;
  align-items: center;
  padding-left: ${(props) => `${props.depth * listItemShiftWidthEm}em`};
  &:hover {
    color: #fff;
  }
`
