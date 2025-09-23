async function fixWebview2() {
  /**
   * 1. 去github https://github.com/westinyang/WebView2RuntimeArchive/releases/download/133.0.3065.92/Microsoft.WebView2.FixedVersionRuntime.133.0.3065.92.x64.cab 下载webview2到本地apps/desktop/src-tauri/webview2
   * 2. 修改desktop/src-tauri/tauri.conf.json
   */

  const fs = require('fs')
  const path = require('path')
  const https = require('https')

  // Step 1: Ensure WebView2 runtime is downloaded
  const webview2Dir = path.join(__dirname, '../apps/desktop/src-tauri/webview2')
  if (!fs.existsSync(webview2Dir)) {
    fs.mkdirSync(webview2Dir, { recursive: true })
    console.log('Created directory for WebView2 runtime:', webview2Dir)
  }
  const webview2CabPath = path.join(
    webview2Dir,
    'Microsoft.WebView2.FixedVersionRuntime.133.0.3065.92.x64.cab',
  )

  // 下载 webview2 runtime
  if (!fs.existsSync(webview2CabPath)) {
    console.log('Downloading WebView2 runtime...')

    const downloadFile = (url, maxRedirects = 5) => {
      return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(webview2CabPath)

        const request = https.get(url, (response) => {
          console.log(`Response status: ${response.statusCode}`)
          console.log(`Response headers:`, response.headers)

          // Handle redirects
          if (
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            if (maxRedirects > 0) {
              console.log(`Redirecting to: ${response.headers.location}`)
              file.close()
              fs.unlink(webview2CabPath, () => {})
              return downloadFile(response.headers.location, maxRedirects - 1)
                .then(resolve)
                .catch(reject)
            } else {
              file.close()
              fs.unlink(webview2CabPath, () => {})
              return reject(new Error('Too many redirects'))
            }
          }

          // Handle successful response
          if (response.statusCode === 200) {
            let downloadedBytes = 0
            response.on('data', (chunk) => {
              downloadedBytes += chunk.length
            })

            response.pipe(file)
            file.on('finish', () => {
              file.close()
              console.log(`Downloaded WebView2 runtime to: ${webview2CabPath}`)
              console.log(`File size: ${downloadedBytes} bytes`)
              resolve()
            })
          } else {
            file.close()
            fs.unlink(webview2CabPath, () => {})
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
          }
        })

        request.on('error', (err) => {
          console.error('Error downloading WebView2 runtime:', err)
          file.close()
          fs.unlink(webview2CabPath, () => {})
          reject(err)
        })
      })
    }

    await downloadFile(
      'https://github.com/westinyang/WebView2RuntimeArchive/releases/download/133.0.3065.92/Microsoft.WebView2.FixedVersionRuntime.133.0.3065.92.x64.cab',
    )
  } else {
    console.log('WebView2 runtime already exists at:', webview2CabPath)
  }

  // Step 2: Update tauri.conf.json
  const tauriConfPath = path.join(__dirname, '../apps/desktop/src-tauri/tauri.conf.json')
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf-8'))
  tauriConf.bundle.windows.webviewInstallMode = {
    type: 'fixedRuntime',
    path: './webview2',
  }
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2))
  console.log('Updated tauri.conf.json to use fixed WebView2 runtime.')
}

fixWebview2().catch(console.error)
