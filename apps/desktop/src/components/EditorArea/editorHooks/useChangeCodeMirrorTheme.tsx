import { useGlobalTheme } from "@/hooks"
import { useCommands } from "@markflowy/editor"
import { useEffect } from "react"
import { darkTheme, lightTheme } from '@markflowy/theme'

const useChangeCodeMirrorTheme = () => {
  const { theme } = useGlobalTheme()
  const commands = useCommands()

  useEffect(() => {
    commands.changeCodeMirrorTheme(theme === 'dark' ? darkTheme.codemirorTheme : lightTheme.codemirorTheme)
  }, [theme, commands])
}

export default useChangeCodeMirrorTheme
