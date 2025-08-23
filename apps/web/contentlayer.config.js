import { defineDocumentType, makeSource } from 'contentlayer2/source-files'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'

export const Post = defineDocumentType(() => ({
  name: 'Post',
  contentType: 'mdx',
  // Location of Post source files (relative to `contentDirPath`)
  filePathPattern: '/*.mdx',
  // At the time of writing, we also have to define the `fields`
  // option to prevent an error on generation. We'll discuss
  // this option later. For now, we'll add an empty object.
  fields: {},
  computedFields: {
    slug: {
      type: 'string',
      resolve: (doc) => {
        return doc._raw.flattenedPath
      },
    },
    // excerpt: {
    //   type: "string",
    //   resolve: (post) =>
    //     post.tldr ? post.tldr : parseMarkdown(post.body.raw, 155),
    // },
    // description: {
    //   type: "string",
    //   resolve: (post) => parseMarkdown(post.body.raw, 300),
    // },
    // timetoread: {
    //   type: "number",
    //   resolve: (post) => parseReadTime(post.body.raw)
    // }
  },
}))

export const Markdown = defineDocumentType(() => ({
  name: 'Markdown',
  contentType: 'markdown',
  // Location of Post source files (relative to `contentDirPath`)
  filePathPattern: './**/*.md',
  // At the time of writing, we also have to define the `fields`
  // option to prevent an error on generation. We'll discuss
  // this option later. For now, we'll add an empty object.
  fields: {},
  computedFields: {
    slug: {
      type: 'string',
      resolve: (doc) => {
        // 去掉 第一个/ 前缀
        // 例如 en/getting-started.md -> /getting-started.md
        return doc._raw.flattenedPath.replace(/^[^/]+/, '')
      },
    },
    title: {
      type: 'string',
      resolve: (doc) => {
        return doc._raw.sourceFileName.split('.md')?.[0]
      },
    },
    locale: {
      type: 'string',
      resolve: (doc) => {
        const pathParts = doc._raw.flattenedPath.split('/')
        return pathParts[0] || 'en'
      },
    }
    // excerpt: {
    //   type: "string",
    //   resolve: (post) =>
    //     post.tldr ? post.tldr : parseMarkdown(post.body.raw, 155),
    // },
    // description: {
    //   type: "string",
    //   resolve: (post) => parseMarkdown(post.body.raw, 300),
    // },
    // timetoread: {
    //   type: "number",
    //   resolve: (post) => parseReadTime(post.body.raw)
    // }
  },
}))

export default makeSource({
  contentDirPath: '../../docs',
  documentTypes: [Post, Markdown],
  mdx: {
    esbuildOptions(options) {
      options.target = 'esnext'
      return options
    },
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeSlug],
  },
})
