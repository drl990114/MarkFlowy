// copied by https://github.com/bcerati/js-event-bus/blob/main/src/index.ts
export type EventCallback = (...args: any[]) => void;

type Listener = {
  callback: EventCallback;
  triggerCapacity?: number;
};

class EventBus {
  private listeners: Record<string, Listener[]> = {}

  // creates an event that can be triggered any number of times
  on(eventName: string, callback: EventCallback) {
    this.registerListener(eventName, callback)
  }

  // creates an event that can be triggered only once. If it is emitted twice, the callback will only be executed once!
  once(eventName: string, callback: EventCallback) {
    this.registerListener(eventName, callback, 1)
  }

  // creates an event that can be triggered only a number of times. If it is emitted more than that, the callback will not be be executed anymore!
  exactly(eventName: string, callback: EventCallback, capacity: number) {
    this.registerListener(eventName, callback, capacity)
  }

  // kill an event with all it's callbacks
  die(eventName: string) {
    delete this.listeners[eventName]
  }

  // kill an event with all it's callbacks
  off(eventName: string) {
    this.die(eventName)
  }

  // removes the given callback for the given event
  detach(eventName: string, callback: EventCallback) {
    let listeners = this.listeners[eventName] || []

    listeners = listeners.filter(function (value) {
      return value.callback !== callback
    })

    if (eventName in this.listeners) {
      this.listeners[eventName] = listeners
    }
  }

  // removes all the events for the given name
  detachAll(eventName: string) {
    this.die(eventName)
  }

  emit(eventName: string, context?: any, ...args: any) {
    let listeners: Listener[] = []

    // name exact match
    if (this.hasListeners(eventName)) {
      listeners = this.listeners[eventName]
    } else if (eventName.includes('*')) {
      // wildcards support

      let newName = eventName.replace(/\*\*/, '([^.]+.?)+')
      newName = newName.replace(/\*/g, '[^.]+')

      const match = eventName.match(newName)
      if (match && eventName === match[0]) {
        listeners = this.listeners[eventName]
      }
    }

    listeners.forEach((listener, k) => {
      let callback = listener.callback

      if (context) {
        callback = callback.bind(context)
      }

      callback(...args)

      if (listener.triggerCapacity !== undefined) {
        listener.triggerCapacity--
        listeners[k].triggerCapacity = listener.triggerCapacity
      }

      if (this.checkToRemoveListener(listener)) {
        this.listeners[eventName].splice(k, 1)
      }
    })
  }

  private registerListener(
    eventName: string,
    callback: EventCallback,
    triggerCapacity?: number
  ) {
    if (!this.hasListeners(eventName)) {
      this.listeners[eventName] = []
    }

    this.listeners[eventName].push({ callback, triggerCapacity })
  }

  private checkToRemoveListener(eventInformation: Listener): boolean {
    if (eventInformation.triggerCapacity !== undefined) {
      return eventInformation.triggerCapacity <= 0
    }

    return false
  }

  private hasListeners(eventName: string): boolean {
    return eventName in this.listeners
  }
}

// Signle
const bus = new EventBus()

export default bus
