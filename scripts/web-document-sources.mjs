import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import glob from 'fast-glob'
import matter from 'gray-matter'
import yaml from 'yaml'

const docsRoot = fileURLToPath(new URL('../docs/', import.meta.url))

// Match Contentlayer's YAML engine so dates stay strings and quoting is semantic.
export function parsePublicMarkdown(source, relativePath) {
  const { data, content } = matter(source, { engines: { yaml: (value) => yaml.parse(value) } })
  for (const field of ['seoTitle', 'description']) {
    if (typeof data[field] !== 'string' || !data[field].trim()) {
      throw new Error(`${relativePath}: missing or invalid ${field}`)
    }
  }
  if (!content.trim()) throw new Error(`${relativePath}: empty document`)
  if (data.updatedAt !== undefined) {
    if (
      typeof data.updatedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.updatedAt) ||
      !Number.isFinite(Date.parse(data.updatedAt)) ||
      new Date(data.updatedAt).toISOString().slice(0, 10) !== data.updatedAt
    ) {
      throw new Error(`${relativePath}: invalid updatedAt`)
    }
  }
  return {
    _id: relativePath,
    locale: relativePath.split('/')[0],
    slug: relativePath.replace(/^[^/]+/, '').replace(/\.md$/, ''),
    seoTitle: data.seoTitle,
    description: data.description,
    ...(data.updatedAt === undefined ? {} : { updatedAt: data.updatedAt }),
    body: { raw: content },
  }
}

export async function loadPublicMarkdownSources(root = docsRoot) {
  const paths = await glob(['en/**/*.md', 'zh/**/*.md'], { cwd: root, onlyFiles: true })
  return Promise.all(
    paths
      .sort()
      .map(async (path) => parsePublicMarkdown(await readFile(`${root}/${path}`, 'utf8'), path)),
  )
}
