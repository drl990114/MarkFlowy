import useAppTasksStore from '@/stores/useTasksStore'
import { memo } from 'react'
import { TaskList as TaskListUI, PromiseStatus } from '@markflowy/interface'

export const TaskList = memo(() => {
  const { taskList } = useAppTasksStore()

  const tasks = taskList.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status as PromiseStatus,
  }))

  return <TaskListUI tasks={tasks} />
})
