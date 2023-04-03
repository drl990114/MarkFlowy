import type { Event } from '@types'
import { createUid, once } from './common'

class EventBus {
  private events: Event[] = []

  on(name: string, execute: Function, ctx?: any): string {
    return this.addEvent(name, execute, ctx)
  }

  once(name: string, execute: Function, ctx?: any): string {
    return this.addEvent(name, once(execute), ctx)
  }

  remove(name: string, eventId: string): EventBus {
    const events = this.events

    const index = events.findIndex(event => event.name === name)

    if (index === -1)
      return this

    if (!eventId) {
      events.splice(index, 1)

      return this
    }

    const executeIndex = events[index].executes.findIndex(item => item.id === eventId)

    if (executeIndex !== -1)
      events[index].executes.splice(executeIndex, 1)

    return this
  }

  emit(name: string, ...args: any[]): EventBus {
    const event = this.find(name)

    if (!event)
      return this

    const funcs = event.executes

    funcs.forEach((func) => {
      if (func.ctx)
        return func.execute.apply(func.ctx, args)

      func.execute(...args)
    })

    return this
  }

  find(name: string): Event | null {
    const events = this.events

    for (let i = 0; i < events.length; i++) {
      if (name === events[i].name)
        return events[i]
    }

    return null
  }

  clear(): EventBus {
    this.events.length = 0

    return this
  }

  private addEvent(name: string, execute: Function, ctx?: any): string {
    const eventId = createUid()

    const events = this.events

    const event = this.find(name)

    if (event !== null) {
      event.executes.push({ id: eventId, execute, ctx })

      return eventId
    }

    events.push({
      name,
      executes: [
        {
          id: eventId,
          execute,
          ctx,
        },
      ],
    })

    return eventId
  }
}

export default new EventBus()
