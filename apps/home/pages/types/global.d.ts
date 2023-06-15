interface ContorlLink {
  id: string
  type: 'contorl'
  title: string
  onClick: () => void
}

interface DefaultLink {
  type?: 'link'
  id: string
  url: string
  title: string
}

type ILink = DefaultLink | ContorlLink

interface LinksProps {
  links: DefaultLink[]
}

interface Paragraph {
  type: 'hero' | 'faq' | 'feature' | 'cards'
  field_heading: string
  field_text: string
  field_background_color?: 'muted'
  field_media_position?: 'left' | 'right'
  field_media?: {
    field_media_image?: {
      url: string
      alt: string
    }
  }
  field_link?: DefaultLink
  field_links?: LinksProps['links']
  field_items?: {
    id: string
    field_heading: string
    field_text: string
  }[]
}

type ReactText = string | number;
type ReactChild = ReactElement | ReactText;

interface ReactNodeArray extends Array<ReactNode> {}
type ReactFragment = {} | ReactNodeArray;
type ReactNode = ReactChild | ReactFragment | ReactPortal | boolean | null | undefined;

type PropsWithChildren<P> = P & { children?: ReactNode };
