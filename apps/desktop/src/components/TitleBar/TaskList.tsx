import useAppTasksStore from '@/stores/useTasksStore'
import { memo } from 'react'
import styled from 'styled-components'
import { PromiseStatus } from '@/types/global.d'

export const TaskList = memo(() => {
  const { taskList } = useAppTasksStore()

  const iconMap = {
    [PromiseStatus.Pending]: (
      <RotateIcon>
        <i className='ri-loader-4-line' />
      </RotateIcon>
    ),
    [PromiseStatus.Resolved]: <TaskIcon><i className='ri-check-fill' />,</TaskIcon>,
    [PromiseStatus.Rejected]: <TaskIcon><i className='ri-error-warning-line' /></TaskIcon>,
  }

  if (taskList.length === 0) {
    return null
  }

  const recentTask = taskList[0]

  return (
    <Container>
      {recentTask.title}
      {iconMap[recentTask.status]}
    </Container>
  )
})

const Container = styled.div`
  display: flex;
  align-items: center;
  font-size: ${({ theme }) => theme.fontXs};
  color: ${({ theme }) => theme.labelFontColor};
  padding: 0 ${({ theme }) => theme.spaceBase};
`

const TaskIcon = styled.span`
  margin-left: ${({ theme }) => theme.spaceXs};
  padding: 0;
  font-size: ${({ theme }) => theme.fontH6};
`

const RotateIcon = styled.span`
  margin-left: ${({ theme }) => theme.spaceXs};
  padding: 0;
  font-size: ${({ theme }) => theme.fontH6};
  animation: swirl 1s infinite linear;
`
