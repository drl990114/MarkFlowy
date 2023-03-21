import { EditorsService, Fs } from "@services"
import classnames from 'classnames'
import { FC } from "react"

const Explorer: FC<ExplorerProps> = (props) => {

  const handleOpenFileClick = async () => {
    const mdContent = await Fs.selectMdFileAndRead() || ''
    EditorsService.setMarkDown(mdContent)
  }

  const containerCls = classnames(props.className, '')

  return <div className={containerCls}>
     <button className="btn" onClick={handleOpenFileClick}>open markdown file</button>
  </div>
}

interface ExplorerProps {
  className?: string
}

export default Explorer
