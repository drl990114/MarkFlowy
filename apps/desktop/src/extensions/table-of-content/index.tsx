import { RightBarItem } from "@/components/SideBar"
import { TocView } from "@/components/TableOfContent"
import { RIGHTBARITEMKEYS } from "@/constants"

const TABLEOFCONTENT = {
  title: RIGHTBARITEMKEYS.TableOfContent,
  key: RIGHTBARITEMKEYS.TableOfContent,
  icon: <i className='ri-list-unordered' />,
  components: <TocView variant="editor"/>,
} as RightBarItem

export default TABLEOFCONTENT
