type LogArgs = unknown[]

function isDev() {
  return true
}

export const logger = {
  debug: (...args: LogArgs) => {
    if (isDev()) console.debug(...args)
  },
  info: (...args: LogArgs) => {
    if (isDev()) console.info(...args)
  },
  warn: (...args: LogArgs) => {
    console.warn(...args)
  },
  error: (...args: LogArgs) => {
    console.error(...args)
  },
}

