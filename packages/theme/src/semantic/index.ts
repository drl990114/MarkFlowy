import Color from 'color'
import {
  themeTokens,
  themeTokenNames,
  type ResolvedTokens,
  type ThemeOverrides,
  type ThemeTokenName,
} from './registry'
export * from './registry'
export interface ThemeVariant {
  id: string
  name: string
  mode: 'light' | 'dark'
  tokens: ThemeOverrides
  css?: string
}
export interface ThemeDocument {
  version: 1
  id: string
  name: string
  author?: string
  variants: ThemeVariant[]
}
export interface ResolvedTheme {
  id: string
  name: string
  mode: ThemeVariant['mode']
  tokens: ResolvedTokens
  css: string
}
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const idPattern = /^[a-z0-9][a-z0-9._-]{0,79}$/
const cssNumber = /^(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i
const cssLength = /^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|ch|%))$/
// A font-family list, not arbitrary declarations or CSS expressions. Quoted
// family names may contain escaped quotes; unquoted names support Unicode.
const family = String.raw`(?:"(?:[^"\\\n\r]|\\[^\n\r])*"|'(?:[^'\\\n\r]|\\[^\n\r])*'|[-_\p{L}][-_\p{L}\p{N}]*(?:\s+[-_\p{L}][-_\p{L}\p{N}]*)*)`
const fontFamilies = new RegExp(`^${family}(?:\\s*,\\s*${family})*$`, 'u')
function compositeColor(foreground: Color, background: Color): Color {
  const alpha = foreground.alpha()
  return Color.rgb(
    foreground.red() * alpha + background.red() * (1 - alpha),
    foreground.green() * alpha + background.green() * (1 - alpha),
    foreground.blue() * alpha + background.blue() * (1 - alpha),
  )
}
export function resolveThemeTokens(
  mode: ThemeVariant['mode'],
  overrides: ThemeOverrides = {},
): ResolvedTokens {
  if (mode !== 'light' && mode !== 'dark') throw new Error('Invalid theme mode')
  if (!object(overrides)) throw new Error('Theme tokens must be an object')
  const result = {} as ResolvedTokens
  const visiting = new Set<string>()
  for (const name of Object.keys(overrides)) {
    if (!Object.hasOwn(themeTokens, name)) throw new Error(`Unknown theme token: ${name}`)
  }
  const resolve = (name: ThemeTokenName): string => {
    if (Object.hasOwn(result, name)) return result[name]
    if (visiting.has(name))
      throw new Error(`Circular theme reference: ${[...visiting, name].join(' → ')}`)
    visiting.add(name)
    const definition = themeTokens[name]
    const overridden = Object.hasOwn(overrides, name)
    let value = overridden ? overrides[name] : definition[mode]
    // Derived defaults participate in the same graph as explicit references.
    // This keeps links live and also detects cycles through implicit defaults.
    if (!overridden && name === 'accent.subtle')
      value = Color(resolve('accent.background'))
        .alpha(mode === 'dark' ? 0.18 : 0.24)
        .hexa()
    if (!overridden && name === 'accent.foreground') {
      let background = Color(resolve('accent.background'))
      if (background.alpha() < 1) {
        const canvas = compositeColor(
          Color(resolve('surface.canvas')),
          Color(mode === 'dark' ? '#131313' : '#ffffff'),
        )
        background = compositeColor(background, canvas)
      }
      value = background.contrast(Color('#fff')) >= 4.5 ? '#ffffff' : '#111111'
    }
    let resolved: string
    if (object(value)) {
      if (Object.keys(value).length !== 1 || typeof value.ref !== 'string')
        throw new Error(`${name}: expected a value or { ref }`)
      const target = value.ref as ThemeTokenName
      if (!Object.hasOwn(themeTokens, target))
        throw new Error(`${name}: unknown reference ${target}`)
      if (themeTokens[target].kind !== definition.kind)
        throw new Error(`${name}: incompatible reference ${target}`)
      resolved = resolve(target)
    } else {
      if (typeof value !== 'string' || !value.trim() || /[;{}<>\n\r]/.test(value))
        throw new Error(`${name}: invalid value`)
      resolved = value.trim()
      if (definition.kind === 'color') {
        try {
          resolved = Color(resolved).hexa().toLowerCase()
        } catch {
          throw new Error(`${name}: invalid color`)
        }
      } else if (definition.kind === 'length' && !cssLength.test(resolved)) {
        throw new Error(`${name}: expected a non-negative CSS length`)
      } else if (
        definition.kind === 'number' &&
        (!cssNumber.test(resolved) || !Number.isFinite(Number(resolved)) || Number(resolved) <= 0)
      ) {
        throw new Error(`${name}: expected a positive number`)
      } else if (definition.kind === 'font' && !fontFamilies.test(resolved)) {
        throw new Error(`${name}: expected a CSS font-family list`)
      }
    }
    visiting.delete(name)
    result[name] = resolved
    return resolved
  }
  for (const name of themeTokenNames) resolve(name)
  return result
}
export function parseThemeDocument(input: unknown): ThemeDocument {
  if (
    !object(input) ||
    input.version !== 1 ||
    typeof input.id !== 'string' ||
    !idPattern.test(input.id) ||
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    !Array.isArray(input.variants) ||
    !input.variants.length ||
    input.variants.length > 32
  )
    throw new Error('Invalid theme document (version, id, name, variants)')
  const ids = new Set<string>()
  const variants = input.variants.map((item): ThemeVariant => {
    if (
      !object(item) ||
      typeof item.id !== 'string' ||
      !idPattern.test(item.id) ||
      ids.has(item.id) ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      !['light', 'dark'].includes(String(item.mode))
    )
      throw new Error('Invalid or duplicate theme variant')
    ids.add(item.id)
    if (item.css !== undefined && typeof item.css !== 'string')
      throw new Error(`${item.id}: CSS must be text`)
    if (item.tokens !== undefined && !object(item.tokens))
      throw new Error(`${item.id}: tokens must be an object`)
    const tokens = (item.tokens ?? {}) as ThemeOverrides
    const variant: ThemeVariant = {
      id: item.id,
      name: item.name.trim(),
      mode: item.mode as ThemeVariant['mode'],
      tokens,
      ...(item.css ? { css: item.css as string } : {}),
    }
    resolveThemeTokens(variant.mode, tokens)
    return variant
  })
  return {
    version: 1,
    id: input.id,
    name: input.name.trim(),
    ...(typeof input.author === 'string' ? { author: input.author } : {}),
    variants,
  }
}
export function resolveTheme(
  document: ThemeDocument,
  variant: ThemeVariant,
  preferences: ThemeOverrides = {},
): ResolvedTheme {
  return {
    id: `${document.id}/${variant.id}`,
    name: variant.name,
    mode: variant.mode,
    tokens: resolveThemeTokens(variant.mode, { ...variant.tokens, ...preferences }),
    css: variant.css ?? '',
  }
}
export function themeVariableName(name: ThemeTokenName): string {
  return `--mf-theme-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replaceAll('.', '-')}`
}
export function themeVariables(tokens: ResolvedTokens): Record<string, string> {
  return Object.fromEntries(themeTokenNames.map((key) => [themeVariableName(key), tokens[key]]))
}
export const themeDocumentSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'MarkFlowy Theme',
  type: 'object',
  required: ['version', 'id', 'name', 'variants'],
  properties: {
    version: { const: 1 },
    id: { type: 'string', pattern: idPattern.source },
    name: { type: 'string', minLength: 1 },
    author: { type: 'string' },
    variants: {
      type: 'array',
      minItems: 1,
      maxItems: 32,
      items: {
        type: 'object',
        required: ['id', 'name', 'mode'],
        properties: {
          id: { type: 'string', pattern: idPattern.source },
          name: { type: 'string', minLength: 1 },
          mode: { enum: ['light', 'dark'] },
          css: { type: 'string' },
          tokens: {
            type: 'object',
            additionalProperties: false,
            properties: Object.fromEntries(
              themeTokenNames.map((name) => [
                name,
                {
                  description: themeTokens[name].description || name,
                  oneOf: [
                    { type: 'string' },
                    {
                      type: 'object',
                      required: ['ref'],
                      additionalProperties: false,
                      properties: {
                        ref: {
                          enum: themeTokenNames.filter(
                            (key) => themeTokens[key].kind === themeTokens[name].kind,
                          ),
                        },
                      },
                    },
                  ],
                },
              ]),
            ),
          },
        },
      },
    },
  },
}

export { codeMirrorSyntaxStyles } from './syntax'
