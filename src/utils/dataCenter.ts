import type { ReactFrameworkOutput } from '@remirror/react'
import { listen } from '@tauri-apps/api/event'
import { isArray } from '@utils'

class DataCenter {
  private data: DataCenterData = {
    markdownContent: `
# welcome linebyline

[[GitHub](https://github.com/vuejs/jsx-next)\]

- list 
- [[GitHub](https://github.com/vuejs/jsx-next)\]

### Other Projects

| Project | NPM | Repo |
| --- | --- | --- |
| @vue/babel-plugin-jsx |  | \[[GitHub](https://github.com/vuejs/jsx-next)\] |
| eslint-plugin-vue |  | \[[GitHub](https://github.com/vuejs/eslint-plugin-vue)\] |
| @vue/test-utils |  | \[[GitHub](https://github.com/vuejs/vue-test-utils-next)\] |
| vue-class-component |  | \[[GitHub](https://github.com/vuejs/vue-class-component/tree/next)\] |
| vue-loader |  | \[[GitHub](https://github.com/vuejs/vue-loader/tree/next)\] |
| rollup-plugin-vue |  | \[[GitHub](https://github.com/vuejs/rollup-plugin-vue/tree/next)\] |
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
