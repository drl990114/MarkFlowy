import MuiList from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListItemText from '@mui/material/ListItemText'
import type { TooltipProps } from 'zens'
import { Tooltip } from 'zens'
import type { FC } from 'react'
import { memo } from 'react'
import { ListContainer } from './styles'

const List: FC<ListProps> = (props) => {
  const { title, data, tip, onItemClick } = props

  return (
    <ListContainer>
      <MuiList dense className='list'>
        {title ? <h5 className='list-title'>{title}</h5> : null}
        {data.map((item) => {
          return (
            <ListItem
              key={item.key}
              className='list-item label-default'
              onClick={() => onItemClick?.(item)}
            >
              {item.iconCls ? (
                <ListItemAvatar className='list-item__avatar'>
                  <i className={item.iconCls} />
                </ListItemAvatar>
              ) : null}
              {tip === false ? (
                <ListItemText
                  className='list-item__text'
                  primaryTypographyProps={{
                    variant: 'subtitle2',
                    style: {
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    },
                  }}
                  primary={item.title}
                />
              ) : (
                <Tooltip title={item.tooltip || item.title} placement='right' {...tip}>
                  <ListItemText
                    className='list-item__text'
                    primaryTypographyProps={{
                      variant: 'subtitle2',
                      style: {
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      },
                    }}
                    primary={item.title}
                  />
                </Tooltip>
              )}
            </ListItem>
          )
        })}
      </MuiList>
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
