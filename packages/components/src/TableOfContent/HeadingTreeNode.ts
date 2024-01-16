export default class HeadingNode {
  title: string
  children: HeadingNode[]
  parent: HeadingNode | null
  private offsetCacheVersion: number | null
  cachedOffsetTop: number | null
  private htmlNode: HTMLElement | null
  depth: number // relative depth, starts from 0
  id: string
  key: number // faster comparison than by id
  chapter: string

  constructor(
    htmlNode: HTMLElement | null,
    value: string,
    depth: number,
    id: string,
    key: number,
    offsetCacheVersion: number,
    chapter: string
  ) {
    this.htmlNode = htmlNode
    this.title = value
    this.parent = null
    this.children = []
    this.depth = depth
    this.id = id
    this.key = key
    this.cachedOffsetTop = null
    this.offsetCacheVersion = offsetCacheVersion - 1
    this.chapter = chapter
  }

  lazyLoad(curCacheVersion: number) {
    if (curCacheVersion === this.offsetCacheVersion) {
      return
    }

    if (!this.htmlNode) {
      this.htmlNode = document.getElementById(this.id)
      if (!this.htmlNode) {
        throw Error(`no heading with id "${this.id}"`)
      }
    }

    this.cachedOffsetTop = this.htmlNode.offsetTop
    this.offsetCacheVersion = curCacheVersion
  }
}
