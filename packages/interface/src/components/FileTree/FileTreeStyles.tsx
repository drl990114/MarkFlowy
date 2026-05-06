import React, { type FC, type ReactNode } from 'react'
import styled from 'styled-components'

export interface FileTreeItemData {
  id: string
  name: string
  kind: 'file' | 'dir'
  path: string
  ext?: string
  children?: FileTreeItemData[]
}

export interface FileTreeStylesProps {
  items: FileTreeItemData[]
  activeId?: string
  onSelect?: (item: FileTreeItemData) => void
  renderItem?: (item: FileTreeItemData, isActive: boolean) => ReactNode
  className?: string
}

const FileTreeContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  font-size: ${(props) => props.theme.fontSm || '13px'};
  position: relative;
`

// 缩进线容器
const IndentLines = styled.div<{ $level: number }>`
  --indent-size: 16px;

  position: absolute;
  top: 0;
  left: 4px;
  z-index: 0;
  display: flex;
  align-items: flex-start;
  height: 100%;
  pointer-events: none;

  & > div {
    height: 100%;
    padding-left: 10px;
    border-right: 1px solid ${(props) => props.theme.fileTreeIndentLineColor || props.theme.borderColor};
    margin-right: calc(var(--indent-size) - 10px - 1px);
    z-index: 1;
  }
`

// 与 desktop 端 NodeContainer 保持一致的样式
const FileTreeItemWrapper = styled.div<{ $active?: boolean }>`
  font-size: ${(props) => props.theme.fontSm};
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  cursor: pointer;
  height: 28px;
  padding: 0 8px;
  margin: 0 4px;
  color: ${(props) =>
    props.$active
      ? props.theme.primaryFontColor
      : props.theme.unselectedFontColor};
  background-color: ${(props) =>
    props.$active
      ? props.theme.fileTreeSelectedBgColor
      : 'transparent'};
  border: 1px solid ${(props) => (props.$active ? props.theme.borderColorFocused : 'transparent')};
  border-radius: ${(props) => props.theme.smallBorderRadius || '4px'};
  box-sizing: border-box;
  position: relative;

  &:hover {
    background-color: ${(props) => props.theme.fileTreeSelectedBgColor};
    color: ${(props) => props.theme.primaryFontColor};
  }
`

// 内部行容器 - 与 desktop 端一致
const ItemRow = styled.div<{ $level: number }>`
  display: flex;
  padding: 0 6px;
  padding-left: calc(6px + ${(props) => props.$level * 16}px);
  width: 100%;
  box-sizing: border-box;
  align-items: center;
  position: relative;
  z-index: 1;

  .file-icon {
    flex-shrink: 0;
    margin-right: 4px;
    font-size: 16px;
    color: inherit;
  }
`

const FileName = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const extFileIconClassMap: Record<string, string> = {
  md: 'ri-markdown-line',
  markdown: 'ri-markdown-line',
  json: 'ri-file-code-line',
}

const getFileIconClass = (file: FileTreeItemData) => {
  const ext = file.ext
  if (ext && extFileIconClassMap[ext]) {
    return extFileIconClassMap[ext]
  }
  return 'ri-file-line'
}

const renderDefaultItem = (item: FileTreeItemData, _isActive: boolean): ReactNode => {
  const isDir = item.kind === 'dir'
  return (
    <>
      <i className={`${isDir ? 'ri-folder-3-fill' : getFileIconClass(item)} file-icon`} />
      <FileName>{item.name}</FileName>
    </>
  )
}

const FileTreeItem: FC<{
  item: FileTreeItemData
  activeId?: string
  onSelect?: (item: FileTreeItemData) => void
  renderItem?: (item: FileTreeItemData, isActive: boolean) => ReactNode
  level?: number
}> = ({ item, activeId, onSelect, renderItem, level = 0 }) => {
  const isActive = activeId === item.id
  const itemRenderer = renderItem || renderDefaultItem

  const handleClick = () => {
    onSelect?.(item)
  }

  return (
    <>
      <FileTreeItemWrapper $active={isActive} onClick={handleClick}>
        <ItemRow $level={level}>
          {itemRenderer(item, isActive)}
        </ItemRow>
      </FileTreeItemWrapper>
      {item.children?.map((child) => (
        <FileTreeItem
          key={child.id}
          item={child}
          activeId={activeId}
          onSelect={onSelect}
          renderItem={renderItem}
          level={level + 1}
        />
      ))}
    </>
  )
}

export const FileTreeStyles: FC<FileTreeStylesProps> = ({
  items,
  activeId,
  onSelect,
  renderItem,
  className,
}) => {
  // 计算最大层级用于显示缩进线
  const maxLevel = React.useMemo(() => {
    const getMaxLevel = (items: FileTreeItemData[], level = 0): number => {
      let max = level
      items.forEach((item) => {
        if (item.children && item.children.length > 0) {
          max = Math.max(max, getMaxLevel(item.children, level + 1))
        }
      })
      return max
    }
    return getMaxLevel(items)
  }, [items])

  return (
    <FileTreeContainer className={className}>
      {maxLevel > 0 && (
        <IndentLines $level={maxLevel}>
          {Array.from({ length: maxLevel }, (_, i) => (
            <div key={i} />
          ))}
        </IndentLines>
      )}
      {items.map((item) => (
        <FileTreeItem
          key={item.id}
          item={item}
          activeId={activeId}
          onSelect={onSelect}
          renderItem={renderItem}
        />
      ))}
    </FileTreeContainer>
  )
}

export default FileTreeStyles
