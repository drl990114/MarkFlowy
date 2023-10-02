import styled from 'styled-components'

export const Container = styled.div`
  display: flex;
  flex: 1;
  height: 100vh;

  #sidebar {
    width: 250px;
    background-color: ${(props) => props.theme.bgColor};
    border-right: 1px solid ${(props) => props.theme.borderColor};
  }

  #sidebar .title {
    height: 60px;
    width: 60px;
    margin: 0 auto;
    margin-top: 2rem;
    padding: 0;
    background-color: transparent;
    overflow: hidden;
    border: none;
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
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
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
    text-transform: capitalize;
    z-index: 1;
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
    gap: 1rem;
    user-select: none;
    cursor: pointer;
  }

  #sidebar nav li:hover {
    background: ${(props) => props.theme.tipsBgColor};
  }

  #sidebar nav li.active {
    background: ${(props) => props.theme.accentColor};
    color: white;
  }

  #detail {
    flex: 1;
    padding: 1rem 2rem;
    width: 100%;
    overflow: auto;
    background: ${(props) => props.theme.bgColor};

    & .conf-path {
      margin-bottom: 0.5rem;

      a {
        color: ${(props) => props.theme.accentColor};
        cursor: pointer;
      }
    }
  }
`
