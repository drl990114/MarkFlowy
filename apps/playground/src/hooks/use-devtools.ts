import { useEffect, useState } from "react"

import { setURLParam } from "../utils/update-url"

function setURLDevTools(enable: boolean): void {
    return setURLParam("dev", enable ? "true" : "")
}

function useDevToolsEffect(enableDevTools: boolean) {
    useEffect(() => {
        setURLDevTools(enableDevTools)
    }, [enableDevTools])
}

export default function useDevTools() {
    const [enableDevTools, setEnableDevTools] = useState(true)

    useDevToolsEffect(enableDevTools)

    return {
        enableDevTools,
        setEnableDevTools,
    }
}
