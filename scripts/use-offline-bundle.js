// TODO https://tauri.app/distribute/microsoft-store/#offline-installer
async function useOfflineBundle() {
  const fs = require('fs')
  const path = require('path')

  const tauriConfPath = path.join(__dirname, '../apps/desktop/src-tauri/tauri.conf.json')
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf-8'))
  tauriConf.bundle.windows.webviewInstallMode = {
    type: 'offlineInstaller',
  }
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2))
  console.log('Updated tauri.conf.json to use offline installer for WebView2.')
}

useOfflineBundle().catch(console.error)
