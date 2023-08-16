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
