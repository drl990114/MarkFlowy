import type { ReactFrameworkOutput } from '@remirror/react'
import { listen } from '@tauri-apps/api/event'
import { isArray } from '@utils'

class DataCenter {
  private data: DataCenterData = {
    markdownContent: `
# welcome linebyline

## Feature
- **Super lightweight**. linebyline is based on tauri, which ensures ultra-lightweight and fast performance experience.
- **High availability**. linebyline uses the remirror editor, which not only provides high scalability, but also has a great editing experience. And, linebyline supports multiple editing modes, such as dual, wysiyg.

## Table

| Project | LICENSE | Repo |
| --- | --- | --- |
| linebyline | ![LICENSE](https://img.shields.io/github/license/halodong/recept?style=flat-square) | \[[GitHub](https://github.com/halodong/linebyline)\] |
`,
  }

  editorCtx?: ReactFrameworkOutput<any> | ReactFrameworkOutput<any>[] | undefined

  constructor() {
    listen<{ content: string }>('editor_content_change', (event) => {
      this.data.markdownContent = event.payload.content
    })
  }

  setData = (key: DataCenterDataKeys, value: any) => {
    this.data[key] = value
  }

  getData = (key: DataCenterDataKeys) => {
    return this.data[key]
  }

  setRenderEditorContent = (content: string) => {
    if (isArray(this.editorCtx)) {
      this.editorCtx.forEach((ctx) => {
        ctx.setContent(content)
      })
    }
    else {
      this.editorCtx?.setContent(content)
    }
  }

  setRenderEditorCtx = (ctx: ReactFrameworkOutput<any>) => {
    this.editorCtx = ctx
  }
}

export interface DataCenterData {
  markdownContent: string
}
type DataCenterDataKeys = keyof DataCenterData
const DataCenterInstance = new DataCenter()
export default DataCenterInstance
