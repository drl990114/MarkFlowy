export type OpeningReadPriority = 'foreground' | 'visible' | 'background'

export interface OpeningReadOptions {
  priority?: OpeningReadPriority
  signal?: AbortSignal
  /** Workspace identity, not just its path: returning to a root starts a new session. */
  scope?: object
}

interface ReadTask<T> {
  key: string
  scope?: object
  priority: OpeningReadPriority
  started: boolean
  consumers: number
  promise: Promise<T>
  resolve: (result: T) => void
  reject: (error: unknown) => void
  read: () => Promise<T>
}

const rank: Record<OpeningReadPriority, number> = { foreground: 0, visible: 1, background: 2 }
const abortError = () => new DOMException('Document read canceled.', 'AbortError')

/** At most two background reads; one additional slot remains available to visible documents. */
export class OpeningReadQueue<T> {
  private tasks = new Set<ReadTask<T>>()
  private active = 0
  private backgroundActive = 0

  promote(key: string, scope: object | undefined, priority: OpeningReadPriority) {
    const task = [...this.tasks].find((item) => item.key === key && item.scope === scope)
    if (task && !task.started && rank[priority] < rank[task.priority]) {
      task.priority = priority
      this.pump()
    }
  }

  read(key: string, read: () => Promise<T>, options: OpeningReadOptions = {}): Promise<T> {
    if (options.signal?.aborted) return Promise.reject(abortError())
    const priority = options.priority ?? 'foreground'
    let task = [...this.tasks].find((item) => item.key === key && item.scope === options.scope)
    if (!task) {
      let resolve!: (result: T) => void
      let reject!: (error: unknown) => void
      const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
      task = {
        key, scope: options.scope, priority, read, promise, resolve, reject,
        started: false, consumers: 0,
      }
      this.tasks.add(task)
    } else if (!task.started && rank[priority] < rank[task.priority]) {
      task.priority = priority
    }
    task.consumers++
    const result = this.subscribe(task, options.signal)
    this.pump()
    return result
  }

  private subscribe(task: ReadTask<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) return task.promise
    return new Promise<T>((resolve, reject) => {
      const abort = () => {
        signal.removeEventListener('abort', abort)
        task.consumers--
        if (task.consumers === 0) {
          // A started native read cannot be canceled. Keep its capacity until
          // completion, but do not let later opens reuse its obsolete result.
          this.tasks.delete(task)
          if (!task.started) task.reject(abortError())
        }
        reject(abortError())
        this.pump()
      }
      signal.addEventListener('abort', abort, { once: true })
      task.promise.then(
        (value) => { signal.removeEventListener('abort', abort); resolve(value) },
        (error) => { signal.removeEventListener('abort', abort); reject(error) },
      )
    })
  }

  private pump() {
    while (this.active < 3) {
      const next = [...this.tasks]
        .filter((task) => !task.started && (task.priority !== 'background' || this.backgroundActive < 2))
        .sort((a, b) => rank[a.priority] - rank[b.priority])[0]
      if (!next) return
      next.started = true
      const background = next.priority === 'background'
      this.active++
      if (background) this.backgroundActive++
      const finish = () => {
        this.tasks.delete(next)
        this.active--
        if (background) this.backgroundActive--
        this.pump()
      }
      try {
        void next.read().then(
          (value) => { finish(); next.resolve(value) },
          (error) => { finish(); next.reject(error) },
        )
      } catch (error) {
        finish()
        next.reject(error)
      }
    }
  }
}
