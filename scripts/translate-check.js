const fs = require('fs')
const path = require('path')

function getAllKeys(obj, prefix = '') {
  let keys = new Set()
  for (const key in obj) {
    const currentKey = prefix ? `${prefix}.${key}` : key
    keys.add(currentKey)
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      const childKeys = getAllKeys(obj[key], currentKey)
      childKeys.forEach(k => keys.add(k))
    }
  }
  return keys
}

function compareKeys(baseKeys, targetKeys, langFile) {
  const missingKeys = [...baseKeys].filter(key => !targetKeys.has(key))
  const extraKeys = [...targetKeys].filter(key => !baseKeys.has(key))

  if (missingKeys.length > 0) {
    console.log(`\n缺失的键 in ${langFile}:`)
    missingKeys.forEach(key => console.log(`  - ${key}`))
  }

  if (extraKeys.length > 0) {
    console.log(`\n多余的键 in ${langFile}:`)
    extraKeys.forEach(key => console.log(`  - ${key}`))
  }

  return missingKeys.length === 0 && extraKeys.length === 0
}

function checkLocaleGroup({ directory, baseFile, files, label }) {
  const baseFilePath = path.join(directory, baseFile)
  const baseContent = JSON.parse(fs.readFileSync(baseFilePath, 'utf8'))
  const baseKeys = getAllKeys(baseContent)
  let allValid = true
  const targetFiles =
    files || fs.readdirSync(directory).filter((file) => file !== baseFile && file.endsWith('.json'))

  targetFiles.forEach((file) => {
    console.log(`\n检查 ${label}/${file}...`)
    const filePath = path.join(directory, file)
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const keys = getAllKeys(content)

    const isValid = compareKeys(baseKeys, keys, `${label}/${file}`)
    if (!isValid) {
      allValid = false
    }
  })

  return allValid
}

function main() {
  const localeGroups = [
    {
      directory: path.join(__dirname, '../locales'),
      baseFile: 'en.json',
      label: 'desktop',
    },
    {
      directory: path.join(__dirname, '../locales/editor'),
      baseFile: 'en.json',
      label: 'editor',
    },
    {
      directory: path.join(__dirname, '../locales/web'),
      baseFile: 'en/common.json',
      files: ['zh/common.json', 'ja/common.json'],
      label: 'web',
    },
  ]
  let allValid = true

  localeGroups.forEach((localeGroup) => {
    if (!checkLocaleGroup(localeGroup)) {
      allValid = false
    }
  })

  if (allValid) {
    console.log('\n✅ 所有翻译文件的键都一致')
  } else {
    console.log('\n❌ 发现键不一致的问题')
    process.exit(1)
  }
}

main()

