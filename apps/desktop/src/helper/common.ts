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

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function filterObjectEmptyValues(obj: Record<string, any>) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined))
}
