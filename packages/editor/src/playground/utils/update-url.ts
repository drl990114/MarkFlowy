export function setURLParam(key: string, value: string): void {
    const params = new URLSearchParams(document.location.search)
    if (value) {
        params.set(key, value)
    } else {
        params.delete(key)
    }
    const search = params.toString()
    const url = document.location.pathname + (search ? "?" + search : "")
    history.pushState({}, "", url)
}

export function getURLParam(key: string, defaultValue = ""): string {
    const params = new URLSearchParams(document.location.search)
    return params.get(key) || defaultValue
}
