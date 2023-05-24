import customColors from '@colors'
import styled from 'styled-components'

export const Container = styled.div`
  height: calc(100vh - 30px);
  margin-top: 30px;
  display: flex;

  #sidebar {
    width: 250px;
    background-color: ${customColors.bgColor};
    border-right: 1px solid ${customColors.borderColor};
  }

  #sidebar .title {
    padding-bottom: 10px;
    margin-bottom: 0;
    border-bottom: 1px solid ${customColors.borderColor};
  }

  #sidebar > * {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  #sidebar > div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-top: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid ${customColors.borderColor};
  }

  #sidebar > div .search-form {
    position: relative;
  }

  #sidebar > div .search-form input[type='search'] {
    width: 100%;
    padding-left: 2rem;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' class='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='%23999' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' /%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: 0.625rem 0.75rem;
    background-size: 1rem;
    position: relative;
  }

  #sidebar > div .search-form input[type='search'].loading {
    background-image: none;
  }

  #sidebar nav {
    flex: 1;
    overflow: auto;
    padding-top: 1rem;
  }

  #sidebar nav a.active span {
    color: inherit;
  }

  #sidebar nav .active i {
    color: inherit;
  }

  #sidebar ul {
    padding: 0;
    margin: 0;
    list-style: none;
  }

  #sidebar li {
    margin: 0.25rem 0;
  }

  #sidebar nav li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    overflow: hidden;

    white-space: pre;
    padding: 0.5rem;
    border-radius: 8px;
    color: inherit;
    text-decoration: none;
    gap: 1rem;
    cursor: pointer;
  }

  #sidebar nav li:hover {
    background: ${customColors.tipsBgColor};
  }

  #sidebar nav li.active {
    background: ${customColors.accentColor};
    color: white;
  }

  #sidebar nav li.pending {
    color: ${customColors.accentColor};
  }

  #detail {
    flex: 1;
    padding: 2rem 4rem;
    width: 100%;
  }
`
