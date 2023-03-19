import { Fs } from "@services"

const Explorer = () => {

  const handleOpenFileClick = async () => {
    Fs.selectMdFileAndRead()
  }

  return <div>
     <button className="btn" onClick={handleOpenFileClick}>open file</button>
  </div>
}

export default Explorer
