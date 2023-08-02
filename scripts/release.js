const path = require('path')
const { execSync } = require('child_process')
const fs = require('fs')

const cwd = process.cwd()
const tauriConfFilePath = path.resolve(cwd, './src-tauri/tauri.conf.json')
const tauriConf = require(tauriConfFilePath)

const nextVersion = process.argv[2] || getNextVersion(tauriConf.package.version)

function updateVersion() {
  tauriConf.package.version = nextVersion
  fs.writeFileSync(tauriConfFilePath, JSON.stringify(tauriConf, null, 2))
  execSync('git add . && git commit -m "chore: bump version" && git push')
}

function getNextVersion(version) {
  let V4 = version.match(/\d+/g)
  let next = parseInt(V4.pop()) + 1
  if (next === 100) {
    return [getNextVersion(V4.join('.')), 0].join('.')
  } else {
    V4.push(next)
    return V4.join('.')
  }
}

updateVersion()

execSync(`git tag -a v${nextVersion}-alpha -m "v${nextVersion}-alpha" && git push linebyline v${nextVersion}-alpha`)
