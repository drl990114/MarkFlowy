import classNames from 'classnames'
import type { FC } from 'react'
import { memo } from 'react'
import type { TooltipProps } from 'zens'
import { Tooltip } from 'zens'
import { ListContainer } from './styles'

const List: FC<ListProps> = (props) => {
  const { title, data, tip, onItemClick } = props

  return (
    <ListContainer>
      {title ? <h5 className='list-title'>{title}</h5> : null}
      {data.map((item) => {
        return (
          <Tooltip title={item.tooltip || item.title} skipTimeout={0} placement='right' {...tip}>
            <div
              key={item.key}
              className='list-item'
              onClick={() => onItemClick?.(item)}
            >
              {item.iconCls ? (
                <i className={classNames('list-item__avatar', item.iconCls)} />
              ) : null}
              <div className='list-item__text'>{item.title}</div>
            </div>
          </Tooltip>
        )
      })}
    </ListContainer>
  )
}

export interface ListDataItem {
  key: React.Key
  title: string
  tooltip?: string
  iconCls?: string
}

interface ListProps {
  title?: string
  tip?: TooltipProps | false
  data: ListDataItem[]
  onItemClick?: (item: ListDataItem) => void
}

export default memo(List)
