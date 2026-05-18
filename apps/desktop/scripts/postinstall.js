import { execSync } from 'child_process'

if (process.env.VERCEL) {
  console.log('Skipping patch-package on Vercel')
  process.exit(0)
}

try {
  execSync('patch-package', { stdio: 'inherit' })
} catch (error) {
  process.exit(1)
}
