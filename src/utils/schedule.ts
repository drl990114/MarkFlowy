
type Task =
  | {
      status: 'pending' | 'fulfilled' | 'rejected'
      value: any
    }
  | Promise<any>

const asyncFinishMap: Map<string, Task> = new Map()

async function getData(promise: Promise<any>) {
  return await promise
}

export function loadTask(id: string, promise: Promise<any>) {
  if (!asyncFinishMap.has(id)) {
    asyncFinishMap.set(id, getData(promise))
  }
  return asyncFinishMap.get(id)
}

export function use(promise: any) {
  if (promise.status === 'fulfilled') {
    return promise.value
  } else if (promise.status === 'rejected') {
    throw promise.reason
  } else if (promise.status === 'pending') {
    throw promise
  } else {
    promise.status = 'pending'
    promise.then(
      (result: any) => {
        promise.status = 'fulfilled'
        promise.value = result
      },
      (reason: any) => {
        promise.status = 'rejected'
        promise.reason = reason
      }
    )
    throw promise
  }
}
