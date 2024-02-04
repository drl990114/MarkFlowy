import { useCommands } from "rme"
import { useEffect } from "react"
import useThemeStore from "@/stores/useThemeStore"

const useChangeCodeMirrorTheme = () => {
  const { curTheme } = useThemeStore()
  const commands = useCommands()

  useEffect(() => {
    commands.changeCodeMirrorTheme(curTheme.codemirorTheme)
  }, [curTheme, commands])
}

export default useChangeCodeMirrorTheme
