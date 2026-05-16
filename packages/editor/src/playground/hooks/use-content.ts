import { useCallback, useEffect, useState } from "react"

import { contentMap } from "../content"
import { getURLParam, setURLParam } from "../utils/update-url"

function getURLContentId(): string {
    if (getURLParam("content")) {
        return "customize"
    } else {
        return getURLParam("contentid", "default")
    }
}

function setURLContentId(contentId: string): void {
    return setURLParam("contentid", contentId === "default" ? "" : contentId)
}

function setURLContent(content: string): void {
    return setURLParam("content", content)
}

export default function useContent() {
    const [contentId, setContentId] = useState(getURLContentId)
    const [content, setContent] = useState(contentId === "customize" ? getURLParam("content") : contentMap[contentId])
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

    useEffect(() => {
        if (contentId !== "customize") {
            setURLContent("")
        }
    }, [contentId])

    useEffect(() => {
        setURLContentId(contentId)
    }, [contentId])

    useEffect(() => {
        contentMap[contentId] = content
    }, [content, contentId])

    return {
        contentId,
        content,
        hasUnsavedChanges,
        setContentId: useCallback((newId: string) => {
            setContentId(newId)
            setContent(contentMap[newId])
        }, []),
        setContent,
        setHasUnsavedChanges,
    }
}
