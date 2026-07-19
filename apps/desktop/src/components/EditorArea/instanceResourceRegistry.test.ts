import { describe, expect, it } from 'vitest'
import { InstanceResourceRegistry } from './instanceResourceRegistry'

describe('InstanceResourceRegistry', () => {
  it('promotes an active instance and falls back when that instance is removed', () => {
    const registry = new InstanceResourceRegistry<string>()

    expect(registry.register('file', 'first', 'first-resource')).toEqual({
      current: 'first-resource',
      currentChanged: true,
    })
    expect(registry.register('file', 'second', 'second-resource')).toEqual({
      current: 'first-resource',
      currentChanged: false,
    })

    expect(registry.promote('file', 'second')).toBe('second-resource')
    expect(registry.remove('file', 'second')).toEqual({
      current: 'first-resource',
      currentChanged: true,
      empty: false,
    })
    expect(registry.remove('file', 'first')).toEqual({
      currentChanged: true,
      empty: true,
    })
  })

  it('does not replace the current resource when a non-current instance is removed', () => {
    const registry = new InstanceResourceRegistry<string>()
    registry.register('file', 'first', 'first-resource')
    registry.register('file', 'second', 'second-resource')

    expect(registry.remove('file', 'second')).toEqual({
      current: 'first-resource',
      currentChanged: false,
      empty: false,
    })
    expect(registry.promote('file', 'second')).toBeUndefined()
  })

  it('updates the compatibility resource when its current instance changes resource', () => {
    const registry = new InstanceResourceRegistry<string>()
    registry.register('file', 'instance', 'before')

    expect(registry.register('file', 'instance', 'after')).toEqual({
      current: 'after',
      currentChanged: true,
    })
  })

  it('reads resources by instance without changing the current owner', () => {
    const registry = new InstanceResourceRegistry<string>()
    registry.register('file', 'first', 'first-resource')
    registry.register('file', 'second', 'second-resource')

    expect(registry.get('file', 'second')).toBe('second-resource')
    expect(registry.remove('file', 'second')).toEqual({
      current: 'first-resource',
      currentChanged: false,
      empty: false,
    })
  })

  it('reserves ownership for an active instance until its resource is ready', () => {
    const registry = new InstanceResourceRegistry<string>()
    registry.register('file', 'mounted', 'mounted-resource')

    expect(registry.promote('file', 'loading')).toBeUndefined()
    expect(registry.register('file', 'mounted', 'updated-resource')).toEqual({
      currentChanged: false,
    })
    expect(registry.remove('file', 'loading')).toEqual({
      current: 'updated-resource',
      currentChanged: true,
      empty: false,
    })
  })

  it('keeps a pending active owner when the last inactive resource is removed', () => {
    const registry = new InstanceResourceRegistry<string>()
    registry.register('file', 'inactive', 'inactive-resource')
    registry.promote('file', 'active-loading')

    expect(registry.remove('file', 'inactive')).toEqual({
      currentChanged: false,
      empty: true,
    })
    expect(registry.register('file', 'other-inactive', 'other-resource')).toEqual({
      currentChanged: false,
    })
    expect(registry.register('file', 'active-loading', 'active-resource')).toEqual({
      current: 'active-resource',
      currentChanged: true,
    })
  })
})
