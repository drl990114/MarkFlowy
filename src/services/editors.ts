// cache
const editors = new Map()

const setMarkDownById = (id: string, mdContent: string) => {
  editors.set(id, mdContent)
}

export default {
  editors,
  setMarkDownById
}
