export interface Event {
  name: string
  executes: Execute[]
}

export interface Execute {
  id: string
  execute: Function
  ctx?: any
}
