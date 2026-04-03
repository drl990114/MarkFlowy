import React, { memo } from 'react'
import styled from 'styled-components'
import { Loading } from 'zens'

export enum PromiseStatus {
  Pending = 'pending',
  Resolved = 'resolved',
  Rejected = 'rejected',
}

export interface Task {
  id: string
  title: string
  status: PromiseStatus
}

export interface TaskListProps {
  tasks: Task[]
}

export const TaskList = memo((props: TaskListProps) => {
  const { tasks } = props

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

  if (tasks.length === 0) {
    return null
  }

  const recentTask = tasks[0]

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
