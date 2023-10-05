import { useGlobalTheme } from "@/hooks"
import { useCommands } from "@markflowy/editor"
import { useEffect } from "react"

const useChangeCodeMirrorTheme = () => {
  const { theme } = useGlobalTheme()
  const commands = useCommands()

  useEffect(() => {
    commands.changeCodeMirrorTheme(theme)
  }, [theme, commands])
}

export default useChangeCodeMirrorTheme
