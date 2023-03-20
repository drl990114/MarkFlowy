import { Fs } from "@services"
import classnames from 'classnames'

const Explorer = (props) => {

  const handleOpenFileClick = async () => {
    Fs.selectMdFileAndRead()
  }

  const containerCls = classnames(props.className)

  return <div className={containerCls}>
     <button className="btn" onClick={handleOpenFileClick}>open markdown file</button>
  </div>
}

export default Explorer
