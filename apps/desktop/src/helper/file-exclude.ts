export const FILE_EXCLUDE_PATTERNS_SETTING_KEY = 'file_exclude_patterns'

export function resolveFileExcludePatterns(settingData?: Record<string, unknown>) {
  const value = settingData?.[FILE_EXCLUDE_PATTERNS_SETTING_KEY]
  return typeof value === 'string' ? value : ''
}

export function parseFileExcludePatternLines(patterns: string) {
  return patterns
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function stringifyFileExcludePatternLines(patterns: string[]) {
  return parseFileExcludePatternLines(patterns.join('\n')).join('\n')
}

export function hasFileExcludePatternsChanged(
  prevSettingData?: Record<string, unknown>,
  nextSettingData?: Record<string, unknown>,
) {
  return resolveFileExcludePatterns(prevSettingData) !== resolveFileExcludePatterns(nextSettingData)
}
