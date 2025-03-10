import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'
import { delay } from 'lodash'
import { PromiseStatus } from '@/types/global.d'

const useAppTasksStore = create(
  immer<TasksStore>((set, get) => {
    return {
      taskList: [],

      addAppTask: (task) => {
        const { updateAppTask: updateTask, deleteAppTask: deleteTask } = get()
        const newTask: Task = {
          id: nanoid(),
          status: PromiseStatus.Pending,
          ...task,
        }
        newTask.promise
          .then(() => {
            updateTask(newTask.id, { status: PromiseStatus.Resolved })
            delay(() => {
              deleteTask(newTask.id)
            }, 5000)
          })
          .catch(() => {
            updateTask(newTask.id, { status: PromiseStatus.Rejected })
            delay(() => {
              deleteTask(newTask.id)
            }, 5000)
          })

        set((state) => {
          state.taskList.unshift(newTask)
        })

        return newTask.promise
      },

      updateAppTask: (taskId, props) => {
        set((state) => {
          const task = state.taskList.find((t) => t.id === taskId)
          if (task) {
            Object.assign(task, props)
          }
        })
      },

      deleteAppTask: (taskId) => {
        set((state) => {
          state.taskList = state.taskList.filter((task) => task.id !== taskId)
        })
      },
    }
  }),
)

type Task = {
  id: string
  title: string
  status: PromiseStatus
  promise: Promise<any>
}

interface TasksStore {
  taskList: Task[]
  addAppTask: <T extends any>(task: Omit<Task, 'id' | 'status'>) => Promise<T>
  updateAppTask: (taskId: string, props: Partial<Task>) => void
  deleteAppTask: (taskId: string) => void
}

export default useAppTasksStore
