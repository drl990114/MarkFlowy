import { useGlobalTheme } from "@/hooks"
import { useCommands } from "@markflowy/editor"
import { useEffect } from "react"
import { mfCodemirrorDark, mfCodemirrorLight } from '@markflowy/theme'

const useChangeCodeMirrorTheme = () => {
  const { theme } = useGlobalTheme()
  const commands = useCommands()

  useEffect(() => {
    commands.changeCodeMirrorTheme(theme === 'dark' ? mfCodemirrorDark : mfCodemirrorLight)
  }, [theme, commands])
}

export default useChangeCodeMirrorTheme
