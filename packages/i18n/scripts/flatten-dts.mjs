import { existsSync, readdirSync, renameSync, rmSync } from 'fs'
import { join } from 'path'

const dist = 'dist'
const nested = join(dist, 'packages', 'i18n', 'src')

if (existsSync(nested)) {
  for (const file of readdirSync(nested)) {
    renameSync(join(nested, file), join(dist, file))
  }
  rmSync(join(dist, 'packages'), { recursive: true })
}