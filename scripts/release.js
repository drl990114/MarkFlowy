const path = require('path')
const { execSync } = require('child_process')
const fs = require('fs')

const cwd = process.cwd()
const tauriConfFilePath = path.resolve(cwd, './apps/desktop/src-tauri/tauri.conf.json')
const tauriConf = require(tauriConfFilePath)

const nextVersion = process.argv[2] ? extractVersion(process.argv[2]) : getNextVersion(tauriConf.package.version)
const allWorkspaces = getWorkspacePackageByDirName('apps')

allWorkspaces.forEach((workspace) => {
  const packageContent = require(workspace.packageFilePath)
  packageContent.version = nextVersion
  fs.writeFileSync(workspace.packageFilePath, JSON.stringify(packageContent, null, 2))
})

updateVersion()

execSync(`git add . && git commit -m "chore: bump version to ${nextVersion}" && git push`)
execSync(`git tag -a v${nextVersion} -m "v${nextVersion}" && git push markflowy v${nextVersion}`)


// helpers -----------------------------
function extractVersion (string) {
  return string.match(/\d+\.\d+\.\d+/g)[0]
}

function isDirectory(path) {
  return fs.statSync(path).isDirectory()
}

function getWorkspacePackageByDirName(dirName) {
  const appsWorkspaces = []

  fs.readdirSync(path.resolve(cwd, `./${dirName}`)).forEach((file) => {
    if (isDirectory(path.resolve(cwd, `./${dirName}/${file}`))) {
      appsWorkspaces.push({
        packageFilePath: path.resolve(cwd, `./${dirName}/${file}/package.json`)
      })
    }
  })

  return appsWorkspaces
}

function updateVersion() {
  tauriConf.package.version = nextVersion
  fs.writeFileSync(tauriConfFilePath, JSON.stringify(tauriConf, null, 2))
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


