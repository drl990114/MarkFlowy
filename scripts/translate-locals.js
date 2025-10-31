const fs = require('fs')
const path = require('path')

const alimt20181012 = require('@alicloud/alimt20181012').default
const $alimt20181012 = require('@alicloud/alimt20181012')
const $OpenApi = require('@alicloud/openapi-client')
const $Util = require('@alicloud/tea-util')

const aliLangTypeMap = {
  'zh-CN': 'zh',
  en: 'en',
  es: 'es',
  'fr-FR': 'fr',
  ja: 'ja',
}

const baseLangName = 'en'
const baseLangFile = path.join(__dirname, `../locales/${baseLangName}.json`)
const langDir = path.join(__dirname, '../locales')

const baseLang = JSON.parse(fs.readFileSync(baseLangFile, 'utf8'))

const createClient = () => {
  let config = new $OpenApi.Config({
    accessKeyId: process.env['ALIBABA_CLOUD_ACCESS_KEY_ID'],
    accessKeySecret: process.env['ALIBABA_CLOUD_ACCESS_KEY_SECRET'],
  })

  config.endpoint = `mt.cn-hangzhou.aliyuncs.com`
  return new alimt20181012(config)
}

const client = createClient()

async function addMissingKeys(base, target, targetLang) {
  for (const key in base) {
    if (base.hasOwnProperty(key)) {
      const baseType = typeof base[key]
      const targetType = typeof target[key]
      
      if (!(key in target)) {
        target[key] = null
      }
      
      if (baseType === 'object') {
        target[key] = target[key] || {}
        await addMissingKeys(base[key], target[key], targetLang)
      } else if (baseType === 'string' && (target[key] === null || targetType !== 'string')) {
        target[key] = await translateValue(base[key], targetLang)
      } else if (target[key] === null || targetType !== baseType) {
        target[key] = base[key]
      }
    }
  }
  return target
}

async function translateValue(value, targetLang) {
  if (value === '') {
    return value
  }

  let translateGeneralRequest = new $alimt20181012.TranslateGeneralRequest({
    formatType: 'text',
    sourceText: value,
    sourceLanguage: aliLangTypeMap[baseLangName] || baseLangName,
    targetLanguage: aliLangTypeMap[targetLang],
  })
  let runtime = new $Util.RuntimeOptions({})
  try {
    let resp = await client.translateGeneralWithOptions(translateGeneralRequest, runtime)

    console.log(`Translated ${value} to ${resp?.body?.data?.translated}`)

    return resp?.body?.data?.translated || value
  } catch (error) {
    console.log(error.message)
    console.log(error.data['Recommend'])
  }

  return ''
}

const main = async () => {
  const files = fs.readdirSync(langDir)

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (file !== `${baseLangName}.json` && file.endsWith('.json')) {
      const filePath = path.join(langDir, file)
      const lang = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      const targetLang = file.replace('.json', '')
      const updatedLang = await addMissingKeys(baseLang, lang, targetLang)

      fs.writeFileSync(filePath, JSON.stringify(updatedLang, null, 2), 'utf8')
    }
  }
}

main()
