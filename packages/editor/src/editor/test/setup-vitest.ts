import { setupRemirrorEnvironment } from 'jest-remirror'

setupRemirrorEnvironment()

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true

Error.stackTraceLimit = 100
