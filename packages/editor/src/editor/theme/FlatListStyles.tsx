import { css } from 'styled-components'

// Flat List Styles based on prosemirror-flat-list
export const FlatListStyles = css`
  --prosekit-list-bullet-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='2.5' fill='currentColor'/%3E%3C/svg%3E");
  --prosekit-list-toggle-open-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpolygon points='8,10 12,14 16,10' fill='currentColor'/%3E%3C/svg%3E");
  --prosekit-list-toggle-closed-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpolygon points='10,8 14,12 10,16' fill='currentColor'/%3E%3C/svg%3E");

  .prosemirror-flat-list {
    & {
      position: relative;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    & > .list-marker {
      position: absolute;
      left: 0;
      width: 1.5em;
      width: 1lh;
      height: 1.5em;
      height: 1lh;
      text-align: center;
    }

    & > .list-content {
      margin-left: 1.5em;
      margin-left: 1lh;
    }

    &[data-list-kind='bullet'] > .list-marker,
    &[data-list-kind='toggle'] > .list-marker {
      background-color: currentColor;
      mask-position: center;
      mask-repeat: no-repeat;
      mask-size: contain;
    }

    &[data-list-kind='bullet'] {
      & > .list-marker {
        mask-image: var(--prosekit-list-bullet-icon);
      }
    }

    &[data-list-kind='toggle'] {
      & > .list-marker {
        mask-image: var(--prosekit-list-toggle-open-icon);
      }

      &[data-list-collapsable][data-list-collapsed] > .list-marker {
        mask-image: var(--prosekit-list-toggle-closed-icon);
      }
    }

    &[data-list-kind='ordered'] {
      /*
      Ensure that the counters in children don't escape, so that the sub lists
      won't affect the counter of the parent list.

      See also https://github.com/ocavue/prosemirror-flat-list/issues/23
      */
      & > * {
        contain: style;
      }

      &::before {
        position: absolute;
        right: calc(100% - 1.5em);
        right: calc(100% - 1lh);
        content: counter(prosemirror-flat-list-counter, decimal) '. ';
        font-variant-numeric: tabular-nums;
      }

      /*
      If the node has a custom order number, set the counter to that value.
      Otherwise, increment the counter normally.
      */
      &[data-list-order] {
        @supports (counter-set: prosemirror-flat-list-counter 1) {
          counter-set: prosemirror-flat-list-counter var(--prosemirror-flat-list-order);
        }

        @supports not (counter-set: prosemirror-flat-list-counter 1) {
          counter-reset: prosemirror-flat-list-counter var(--prosemirror-flat-list-order);
        }
      }

      &:not([data-list-order]) {
        counter-increment: prosemirror-flat-list-counter;
      }

      /*
      Reset the counter for the first list node in the sequence or when
      the previous sibling is not a list (paragraph break).
      */
      &:first-child {
        counter-reset: prosemirror-flat-list-counter;
      }
    }

    &[data-list-kind='task'] {
      & > .list-marker {
        width: 1.5em;
        height: auto;
        &,
        & * {
          /* Make sure that the checkbox is at the center */
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 0;
          cursor: pointer;
        }
      }
    }

    &[data-list-kind='toggle'] {
      &[data-list-collapsable] > .list-marker {
        cursor: pointer;
      }
      &:not([data-list-collapsable]) > .list-marker {
        opacity: 40%;
        pointer-events: none;
      }

      /* If collapsed, hide the second and futher children */
      &[data-list-collapsable][data-list-collapsed] > .list-content > *:nth-child(n + 2) {
        display: none;
      }
    }
  }

  /*
  Reset counter when an ordered list follows a non-list element.
  This handles the case where there's a paragraph break (e.g., h3) between lists.
  */
  :not(.prosemirror-flat-list[data-list-kind='ordered']) + .prosemirror-flat-list[data-list-kind='ordered'] {
    counter-reset: prosemirror-flat-list-counter;

    &[data-list-order] {
      @supports (counter-set: prosemirror-flat-list-counter 1) {
        counter-set: prosemirror-flat-list-counter var(--prosemirror-flat-list-order);
      }

      @supports not (counter-set: prosemirror-flat-list-counter 1) {
        counter-increment: prosemirror-flat-list-counter var(--prosemirror-flat-list-order);
      }
    }
  }
`
