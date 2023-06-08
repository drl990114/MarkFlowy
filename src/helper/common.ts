export function once(fn: Function): Function {
  let called = false

  return function (this: any, ...args: any[]) {
    if (!called) {
      called = true
      fn.apply(this, args)
    }
  }
}

export function isArray(tar: any): tar is any[] {
  return Array.isArray(tar)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function sleepBeforeError(timeout: number): Promise<never> {
  await sleep(timeout)
  throw new Error(`timed out after ${timeout} milliseconds`)
}

export async function createTimeoutPromise<T>(promise: Promise<T>, delay: number): Promise<T> {
  return await Promise.race([promise, sleepBeforeError(delay)])
}
