import { render, screen } from '@testing-library/react'
import { PromiseStatus } from '@markflowy/interface'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskList } from './TaskList'

const mocks = vi.hoisted(() => ({
  taskList: [] as { id: string; status: PromiseStatus; title: string }[],
}))

vi.mock('@/stores/useTasksStore', () => ({
  default: () => ({ taskList: mocks.taskList }),
}))

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'common.error': 'error',
        'common.fetching': 'loading',
        'common.success': 'success',
      })[key] ?? key,
  }),
}))

describe('Desktop task status', () => {
  beforeEach(() => {
    mocks.taskList = []
  })

  it('keeps the failure marker before a truncatable task title', () => {
    mocks.taskList = [
      {
        id: 'task-1',
        status: PromiseStatus.Rejected,
        title: 'A very long failed export task name',
      },
    ]

    const { container } = render(<TaskList />)
    const status = screen.getByRole('status', {
      name: 'A very long failed export task name: error',
    })

    expect(status.firstElementChild?.classList.contains('shrink-0')).toBe(true)
    expect(container.querySelector('.text-destructive')).not.toBeNull()
    expect(status.lastElementChild?.classList.contains('truncate')).toBe(true)
  })
})
