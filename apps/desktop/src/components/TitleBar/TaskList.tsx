import useAppTasksStore from '@/stores/useTasksStore'
import { memo } from 'react'
import styled from 'styled-components'
import { PromiseStatus } from '@/types/global.d'
import { Loading } from 'zens'

export const TaskList = memo(() => {
  const { taskList } = useAppTasksStore()

  const iconMap = {
    [PromiseStatus.Pending]: <Loading size={12} />,
    [PromiseStatus.Resolved]: (
      <TaskIcon>
        <i className='ri-check-fill' />
      </TaskIcon>
    ),
    [PromiseStatus.Rejected]: (
      <TaskIcon>
        <i className='ri-error-warning-line' />
      </TaskIcon>
    ),
  }

  if (taskList.length === 0) {
    return null
  }

  const recentTask = taskList[0]

  return (
    <Container>
      <Title>{recentTask.title}</Title>
      {iconMap[recentTask.status]}
    </Container>
  )
})

const Container = styled.div`
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.labelFontColor};
`

const TaskIcon = styled.span`
  padding: 0;
  font-size: ${({ theme }) => theme.fontH6};
`

const Title = styled.span`
  margin-right: ${({ theme }) => theme.spaceXs};
`
