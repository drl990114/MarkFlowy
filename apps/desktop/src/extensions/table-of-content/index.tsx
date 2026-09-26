import type { RightBarItem } from '@/components/SideBar'
import { TocView } from '@/components/TableOfContent'
import { RIGHTBARITEMKEYS } from '@/constants'
import { ListIcon } from 'lucide-react'

const TABLEOFCONTENT = {
  title: RIGHTBARITEMKEYS.TableOfContent,
  key: RIGHTBARITEMKEYS.TableOfContent,
  icon: <ListIcon aria-hidden='true' size={14} strokeWidth={1.75} />,
  components: <TocView variant='sidebar' />,
} as RightBarItem

export default TABLEOFCONTENT
