const { execSync } = require('child_process')

const args = process.argv.slice(2)

execSync(`cargo run -p mfdev -- release ${args.join(' ')}`, {
  args,
  cwd: 'apps/desktop/src-tauri',
  stdio: 'inherit',
})
