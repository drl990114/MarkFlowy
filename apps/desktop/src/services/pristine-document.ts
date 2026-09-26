// Only automatically created, never-edited documents are disposable placeholders.
const pristine = new Set<string>()

export const markPristineDocument = (id: string) => pristine.add(id)
export const touchDocument = (id: string) => pristine.delete(id)
export const isPristineDocument = (id: string) => pristine.has(id)
