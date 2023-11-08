import { useCommands } from "@markflowy/editor"
import { darkTheme } from "@markflowy/theme"
import { useEffect } from "react"

const useChangeCodeMirrorTheme = () => {
  const commands = useCommands()

  useEffect(() => {
    commands.changeCodeMirrorTheme(darkTheme.codemirorTheme)
  }, [commands])
}

export default useChangeCodeMirrorTheme
