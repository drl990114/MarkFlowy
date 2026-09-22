/** The chevron extends into an arrow on hover without moving the button's other icons. */
export default function SiteArrow() {
  return (
    <svg
      className='mf-hover-arrow'
      viewBox='0 0 12 12'
      width='12'
      height='12'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.5'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      focusable='false'
    >
      <path className='mf-hover-arrow-shaft' d='M1 6h8' />
      <path className='mf-hover-arrow-chevron' d='m2 2 4 4-4 4' />
    </svg>
  )
}
