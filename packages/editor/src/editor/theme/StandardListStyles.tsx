import { css } from 'styled-components'

export const StandardListStyles = css`
  & :is(ul, ol) {
    --rme-list-item-gap: 0.25em;
    --rme-loose-list-item-gap: 0.75em;
    --rme-nested-list-gap: 0.25em;
    --rme-nested-list-guide-offset: 1em;
    --rme-bullet-list-guide-offset: 0.9em;
    --rme-task-checkbox-size: 1em;
    --rme-task-checkbox-foreground: var(--mf-primary-foreground, #fff);
    margin-top: 0;
    margin-bottom: 16px;
    padding-left: 1.5em;
  }

  & :is(ul, ol) :is(ul, ol) {
    position: relative;
    margin-top: var(--rme-nested-list-gap);
    margin-bottom: 0;
  }

  & ul > li:not([data-checked]) > :is(ul, ol),
  & ul > li:not([data-checked]) > [data-rme-list-item-content] > :is(ul, ol) {
    --rme-nested-list-guide-offset: var(--rme-bullet-list-guide-offset);
  }

  & :is(ul, ol) :is(ul, ol)::before {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(-1 * var(--rme-nested-list-guide-offset));
    width: 1px;
    background: color-mix(in srgb, ${(props) => props.theme.borderColor} 72%, transparent);
    content: '';
    pointer-events: none;
  }

  & ol ol,
  & ul ol {
    list-style-type: lower-roman;
  }

  & ul ul ol,
  & ul ol ol,
  & ol ul ol,
  & ol ol ol {
    list-style-type: lower-alpha;
  }

  & :is(ul, ol) > li {
    margin-top: 0;
  }

  & :is(ul, ol)[data-tight='true'] > li + li {
    margin-top: var(--rme-list-item-gap);
  }

  & :is(ul, ol) > li > p,
  & :is(ul, ol) > li > [data-rme-list-item-content] > p {
    margin-top: 0;
    margin-bottom: 0;
  }

  & :is(ul, ol)[data-tight='false'] > li + li {
    margin-top: var(--rme-loose-list-item-gap);
  }

  & :is(ul, ol)[data-tight='false'] > li > p + p,
  & :is(ul, ol)[data-tight='false'] > li > [data-rme-list-item-content] > p + p {
    margin-top: 0.5em;
  }

  & li::marker {
    font-variant-numeric: tabular-nums;
  }

  & ul > li::marker {
    color: ${(props) => props.theme.labelFontColor};
  }

  & li[data-checked] {
    display: grid;
    grid-template-columns: var(--rme-task-checkbox-size) minmax(0, 1fr);
    column-gap: 0.5em;
    margin-left: -1.5em;
    list-style: none;
  }

  & li[data-checked] > [data-rme-task-checkbox-control] {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--rme-task-checkbox-size);
    height: 1lh;
  }

  & li[data-checked] > [data-rme-task-checkbox-control] > input[data-rme-task-checkbox] {
    flex: none;
    box-sizing: border-box;
    width: var(--rme-task-checkbox-size);
    height: var(--rme-task-checkbox-size);
    border: 1.5px solid ${(props) => props.theme.labelFontColor};
    border-radius: 0.22em;
    background: transparent;
    cursor: pointer;
    transform: none;
    transition:
      border-color var(--mf-motion-duration-fast, 120ms) ease,
      background-color var(--mf-motion-duration-fast, 120ms) ease;
  }

  & li[data-checked]
    > [data-rme-task-checkbox-control]
    > input[data-rme-task-checkbox]:hover:not(:disabled) {
    border-color: ${(props) => props.theme.accentColor};
  }

  & li[data-checked]
    > [data-rme-task-checkbox-control]
    > input[data-rme-task-checkbox]:checked {
    border-color: ${(props) => props.theme.accentColor};
    background-color: ${(props) => props.theme.accentColor};
  }

  & li[data-checked]
    > [data-rme-task-checkbox-control]
    > input[data-rme-task-checkbox]::before {
    width: 0.56em;
    height: 0.3em;
    border: solid var(--rme-task-checkbox-foreground);
    border-width: 0 0 calc(0.1em + 1px) calc(0.1em + 1px);
    border-radius: 1px;
    background: transparent;
    clip-path: none;
    transform: translateY(-0.05em) rotate(-45deg) scale(0);
    transform-origin: center;
  }

  & li[data-checked]
    > [data-rme-task-checkbox-control]
    > input[data-rme-task-checkbox]:checked::before {
    transform: translateY(-0.05em) rotate(-45deg) scale(1);
  }

  & li[data-checked]
    > [data-rme-task-checkbox-control]
    > input[data-rme-task-checkbox]:disabled {
    cursor: default;
  }

  & li[data-checked] > [data-rme-list-item-content] {
    min-width: 0;
  }

  & li[data-checked] > [data-rme-list-item-content] > :first-child {
    margin-top: 0;
  }

  & li[data-checked='true'] > [data-rme-list-item-content] > :first-child {
    color: ${(props) => props.theme.labelFontColor};
    text-decoration: line-through;
    text-decoration-color: color-mix(
      in srgb,
      ${(props) => props.theme.labelFontColor} 84%,
      transparent
    );
    text-decoration-thickness: 0.08em;
  }
`
