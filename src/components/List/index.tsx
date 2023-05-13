import { FC, memo } from 'react'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import MuiList from '@mui/material/List'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import { ListContainer } from './styles'
import { Icon } from '@components'
import { ICONSNAME } from '@constants'
import Tooltip from '@mui/material/Tooltip/Tooltip'
import { TooltipProps } from '@mui/material/Tooltip'

const List: FC<ListProps> = (props) => {
  const { title, data, tip, onItemClick } = props

  return (
    <ListContainer>
      <MuiList dense className="list">
        <h5 className="list-title">{title}</h5>
        {data.map((item) => {
          return (
            <ListItem key={item.key} className="list-item label-hover" onClick={() => onItemClick?.(item)}>
              {item.iconName ? (
                <ListItemAvatar className="list-item__avatar">
                  <Icon iconProps={{ className: 'list-item__avatar' }} name={item.iconName} />
                </ListItemAvatar>
              ) : null}
              {tip === false ? (
                <ListItemText
                  className="list-item__text"
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
                <Tooltip title={item.title} placement="right" arrow {...tip}>
                  <ListItemText
                    className="list-item__text"
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
  iconName?: ICONSNAME
}

interface ListProps {
  title: string
  tip?: TooltipProps | false
  data: ListDataItem[]
  onItemClick?: (item: ListDataItem) => void
}

export default memo(List)
