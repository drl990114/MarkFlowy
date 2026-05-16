import type { AnyExtension, CommandsFromExtensions } from '@rme-sdk/main'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled, { css } from 'styled-components'
import { Input, Space } from 'zens'
import { nodeTypeIconMap } from '../../const'
import { isSlashKey } from '../../extensions/SlashMenu/utils'
import { isBrowser } from '../../utils/common'
import { getModEventKey, getModKeyIconName } from '../../utils/getOS'
import TablePanel from './TablePanel'

type SlashMenuRootProps = {
  rootRef: React.RefObject<HTMLDivElement>
  commands: CommandsFromExtensions<AnyExtension>
  closeMenu: (config?: { insertSlash?: boolean }) => void
}

export enum ChildrenHandlerNext {
  None,
  ReturnLeftGroup,
  Close,
}

export const SlashMenuRoot: React.FC<SlashMenuRootProps> = memo(
  ({ rootRef, commands, closeMenu }) => {
    const componentRefMap = useRef<Record<string, any>>({})
    const [searchText, setSearchText] = useState('')
    const { t } = useTranslation()

    const menuItems = useMemo(() => {
      const headingItems = Array.from({ length: 6 }).map((_, i) => {
        return {
          title: `Heading ${i + 1}`,
          id: `Heading${i + 1}`,
          handler: () => {
            commands.toggleHeading({ level: i + 1 })
          },
        }
      })

      const res: {
        title: string
        id: string
        iconName: string
        handler?: () => void
        Renderer?: {
          id: string
          Component: React.ReactNode
        }
        children?: {
          title: string
          id: string
          handler?: () => void
        }[]
      }[] = [
        {
          title: 'Text',
          id: 'text',
          iconName: 'ri-text',
          children: headingItems,
        },
        {
          title: 'Table',
          id: 'table',
          iconName: nodeTypeIconMap.table,
          handler: () => {
            componentRefMap.current.table?.createTable()
          },
          Renderer: {
            id: 'table',
            Component: (
              <TablePanel
                ref={(el) => {
                  componentRefMap.current.table = el
                }}
                commands={commands}
                closeMenu={closeMenu}
              />
            ),
          },
        },
        {
          title: 'Code Block',
          id: 'code-block',
          iconName: nodeTypeIconMap.codeMirror,
          handler: () => {
            commands.createCodeMirror()
          },
        },
        {
          title: 'Math Block',
          id: 'math-block',
          iconName: nodeTypeIconMap.math_block,
          handler: () => {
            commands.createMathBlock()
          },
        },
        {
          title: 'Mermaid',
          id: 'mermaid-block',
          iconName: nodeTypeIconMap.mermaid_node,
          handler: () => {
            commands.createMermaidBlock()
          },
        },
        {
          title: 'HTML Block',
          id: 'html-block',
          iconName: nodeTypeIconMap.html_block,
          handler: () => {
            commands.createHtmlBlock()
          },
        },
        {
          title: 'Quote Block',
          id: 'blockquote',
          iconName: nodeTypeIconMap.blockquote,
          handler: () => {
            commands.toggleBlockquote()
          },
        },
        {
          title: 'Horizontal Rule',
          id: 'horizontal-rule',
          iconName: nodeTypeIconMap.horizontalRule,
          handler: () => {
            commands.insertHorizontalRule()
          },
        }
      ]

      if (commands.createAiBlock) {
        res.unshift({
          title: 'AI',
          id: 'ai',
          iconName: 'ri-bard-line',
          handler: () => {
            commands.createAiBlock({})
          },
        })
      }
      return res
    }, [closeMenu, commands])

    // 筛选菜单项
    const filteredMenuItems = useMemo(() => {
      if (!searchText.trim()) {
        return menuItems
      }

      const searchLower = searchText.toLowerCase()

      return menuItems
        .filter((item) => {
          // 检查主菜单项标题
          if (item.title.toLowerCase().includes(searchLower)) {
            return true
          }

          // 检查子菜单项
          if (item.children) {
            const filteredChildren = item.children.filter((child) =>
              child.title.toLowerCase().includes(searchLower),
            )
            if (filteredChildren.length > 0) {
              return true
            }
          }

          return false
        })
        .map((item) => {
          if (item.children && searchText.trim()) {
            const searchLower = searchText.toLowerCase()

            // 如果父菜单项匹配，显示所有子元素
            if (item.title.toLowerCase().includes(searchLower)) {
              return item
            }

            // 如果只有子菜单项匹配，只显示匹配的子元素
            const filteredChildren = item.children.filter((child) =>
              child.title.toLowerCase().includes(searchLower),
            )
            return {
              ...item,
              children: filteredChildren,
            }
          }
          return item
        })
    }, [menuItems, searchText])

    const [activeGroupId, setActiveGroupId] = useState<string | undefined>(
      filteredMenuItems[0]?.id,
    )
    const [activeItemId, setActiveItemId] = useState<string | undefined>()

    // 当筛选结果改变时，重置选中状态
    useEffect(() => {
      if (filteredMenuItems.length > 0) {
        setActiveGroupId(filteredMenuItems[0].id)
        if (filteredMenuItems[0].children) {
          setActiveItemId(filteredMenuItems[0].children[0].id)
        } else {
          setActiveItemId(undefined)
        }
      } else {
        setActiveGroupId(undefined)
        setActiveItemId(undefined)
      }
    }, [filteredMenuItems])

    const currentIndex = filteredMenuItems.findIndex((item) => item.id === activeGroupId)
    const currentMenuItem = filteredMenuItems[currentIndex]

    const handleDown = useCallback(() => {
      if (activeItemId) {
        if (currentMenuItem?.children) {
          const currentChildIndex = currentMenuItem.children.findIndex(
            (item) => item.id === activeItemId,
          )
          const nextIndex = currentChildIndex + 1
          if (nextIndex < currentMenuItem.children.length) {
            setActiveItemId(currentMenuItem.children[nextIndex].id)
          }
        } else if (currentMenuItem?.Renderer) {
          setActiveItemId(currentMenuItem.Renderer.id)
        }
      } else {
        const nextIndex = currentIndex + 1
        if (nextIndex < filteredMenuItems.length) {
          setActiveGroupId(filteredMenuItems[nextIndex].id)
        }
      }
    }, [
      activeItemId,
      currentIndex,
      currentMenuItem?.Renderer,
      currentMenuItem?.children,
      filteredMenuItems,
    ])

    const handleUp = useCallback(() => {
      if (activeItemId) {
        if (currentMenuItem?.children) {
          const currentChildIndex = currentMenuItem.children.findIndex(
            (item) => item.id === activeItemId,
          )
          const nextIndex = currentChildIndex - 1
          if (nextIndex >= 0) {
            setActiveItemId(currentMenuItem.children[nextIndex].id)
          }
        } else if (currentMenuItem?.Renderer) {
          setActiveItemId(currentMenuItem.Renderer.id)
        }
      } else {
        const nextIndex = currentIndex - 1
        if (nextIndex >= 0) {
          setActiveGroupId(filteredMenuItems[nextIndex].id)
        }
      }
    }, [
      activeItemId,
      currentIndex,
      currentMenuItem?.Renderer,
      currentMenuItem?.children,
      filteredMenuItems,
    ])

    const handleRight = useCallback(() => {
      if (currentMenuItem?.children) {
        setActiveItemId(currentMenuItem.children[0].id)
      } else if (currentMenuItem?.Renderer) {
        setActiveItemId(currentMenuItem.Renderer.id)
      }
    }, [currentMenuItem])

    const handleLeft = useCallback(() => {
      setActiveItemId(undefined)
    }, [])

    // 处理搜索输入
    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchText(e.target.value)
    }, [])

    useEffect(() => {
      const keydownHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          return closeMenu()
        }

        if (event.isComposing || event.key === 'Process') {
          return
        }

        const isNavigationKey =
          event.key === 'ArrowDown' ||
          event.key === 'ArrowUp' ||
          event.key === 'ArrowRight' ||
          event.key === 'ArrowLeft' ||
          event.key === 'Enter'

        // 如果正在输入搜索文本，需要 mod 键（导航键除外）
        if (searchText && event[getModEventKey()] === false && !isNavigationKey) {
          return
        }
        if (activeItemId) {
          const componentRef = componentRefMap.current[activeItemId]
          if (componentRef?.handleKeyDown) {
            const next = componentRef.handleKeyDown(event)

            if (next === ChildrenHandlerNext.Close) {
              closeMenu()
              return
            } else if (next === ChildrenHandlerNext.None) {
              return
            }
          }
        }

        if (event.key === 'ArrowDown') {
          handleDown()
        } else if (event.key === 'ArrowUp') {
          handleUp()
        } else if (event.key === 'ArrowRight') {
          handleRight()
        } else if (event.key === 'ArrowLeft') {
          handleLeft()
        } else if (event.key === 'Enter') {
          // Prevent paragraph insertion
          event.preventDefault()
          event.stopPropagation()

          if (activeItemId) {
            const item = currentMenuItem?.children?.find((child) => child.id === activeItemId)
            if (item?.handler) {
              item.handler()
            }
          }
          if (currentMenuItem?.handler) {
            currentMenuItem.handler()
          }
          closeMenu()
        }
      }

      if (isBrowser()) {
        document.addEventListener('keydown', keydownHandler)
      }

      return () => {
        if (isBrowser()) {
          document.removeEventListener('keydown', keydownHandler)
        }
      }
    }, [
      activeItemId,
      handleDown,
      handleLeft,
      handleRight,
      handleUp,
      closeMenu,
      filteredMenuItems,
      currentMenuItem,
      searchText,
    ])

    return (
      <div ref={rootRef} style={{ display: 'flex', flexDirection: 'column' }}>
        <SearchContainer>
          <Input
            type="text"
            size="small"
            style={{
              width: '100%',
            }}
            placeholder={t('slashMenu.searchPlaceholder')}
            value={searchText}
            onChange={handleSearchChange}
            autoFocus
            onKeyDown={(e) => {
              if (e.code === 'Backspace') {
                if (searchText === '') {
                  e.preventDefault()
                  e.stopPropagation()
                  closeMenu?.()
                }
              } else if (isSlashKey(e) && (searchText === '' || searchText === '/')) {
                e.preventDefault()
                e.stopPropagation()
                closeMenu?.({
                  insertSlash: true,
                })
              }
            }}
          />
        </SearchContainer>
        <MenuContainer>
          <MenuPanel active location="left">
            {filteredMenuItems.map((item) => {
              const selected = item.id === activeGroupId
              return (
                <MenuItem
                  onClick={() => {
                    setActiveGroupId(item.id)
                    // If there are no submenus and no custom renderer, it means it is a command executed directly
                    if (!item.children && !item.Renderer && item.handler) {
                      item.handler()
                      closeMenu()
                    }
                  }}
                  onMouseEnter={() => {
                    setActiveGroupId(item.id)
                    if (item.children?.length) {
                      setActiveItemId(item.children[0].id)
                    } else if (item.Renderer) {
                      setActiveItemId(item.Renderer.id)
                    } else {
                      setActiveItemId(undefined)
                    }
                  }}
                  key={item.id}
                  selected={selected}
                >
                  <Space size={4}>
                    <i className={item.iconName} /> {item.title}
                  </Space>
                </MenuItem>
              )
            })}
            {filteredMenuItems.length === 0 && (
              <div>
                <span>{t('slashMenu.noResults')}</span>
              </div>
            )}
          </MenuPanel>
          {currentMenuItem?.children || currentMenuItem?.Renderer?.Component ? (
            <MenuPanel active={!!activeItemId} location="right">
              {currentMenuItem?.Renderer
                ? currentMenuItem.Renderer.Component
                : currentMenuItem?.children?.map((item) => {
                    const selected = item.id === activeItemId

                    return (
                      <MenuItem
                        key={item.id}
                        selected={selected}
                        onMouseEnter={() => {
                          setActiveItemId(item.id)
                        }}
                        onClick={() => {
                          setActiveItemId(item.id)
                          item.handler?.()
                          closeMenu()
                        }}
                      >
                        {item.title}
                      </MenuItem>
                    )
                  })}
            </MenuPanel>
          ) : null}
        </MenuContainer>
        <SlashMenuFooter>
          <Shortcut>
            {searchText ? (
              <>
                <kbd>{getModKeyIconName()}</kbd>
                <span> + </span>
              </>
            ) : null}
            <kbd aria-label="Up Arrow">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m5 12 7-7 7 7"></path>
                <path d="M12 19V5"></path>
              </svg>
            </kbd>
            <kbd aria-label="Down Arrow">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14"></path>
                <path d="m19 12-7 7-7-7"></path>
              </svg>
            </kbd>
            {currentMenuItem?.children || currentMenuItem?.Renderer ? (
              <>
                <kbd aria-label="Left Arrow">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m12 19-7-7 7-7"></path>
                    <path d="M19 12H5"></path>
                  </svg>
                </kbd>
                <kbd aria-label="Right Arrow">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14"></path>
                    <path d="m12 5 7 7-7 7"></path>
                  </svg>
                </kbd>
              </>
            ) : null}
            {t('slashMenu.toNavigate')}
          </Shortcut>

          <Shortcut>
            {searchText ? (
              <>
                <kbd>{getModKeyIconName()}</kbd>
                <span> + </span>
              </>
            ) : null}
            <kbd aria-label="Enter">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 10 4 15 9 20"></polyline>
                <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
              </svg>
            </kbd>
            {t('slashMenu.toSelect')}
          </Shortcut>
        </SlashMenuFooter>
      </div>
    )
  },
)

type MenuPanelProps = {
  location: 'left' | 'right'
  active: boolean
}

const SlashMenuFooter = styled.div`
  display: flex;
  justify-content: space-between;
  padding: ${(props) => props.theme.spaceXs};
  background-color: ${(props) => props.theme.contextMenuBgColor};
  border-top: 1px solid ${(props) => props.theme.slashMenuBorderColor};
  gap: 8px;
  font-size: 0.85em;
`

export const Shortcut = styled.div`
  display: flex;
  gap: 0.25rem;
  white-space: nowrap;

  & kbd {
    padding: 0 4px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 12px;
  }
`

const MenuPanel = styled.div.attrs<MenuPanelProps>((p) => p)`
  display: flex;
  min-width: 130px;
  width: 100%;
  flex-direction: column;
  overscroll-behavior: contain;
  background-color: ${(props) =>
    props.active ? props.theme.contextMenuBgColorActive : props.theme.contextMenuBgColor};
  padding: ${(props) => props.theme.spaceXs};
  color: ${(props) => props.theme.primaryFontColor};
  font-size: ${(props) => props.theme.fontXs};
  outline: none;
  overflow: visible;
  max-height: 260px;
  overflow-y: auto;
`

const MenuItem = styled.li.attrs<{
  selected: boolean
}>((props) => ({
  ...props,
}))`
  display: flex;
  cursor: default;
  align-items: center;
  border-radius: ${(props) => props.theme.smallBorderRadius};
  padding: ${(props) => props.theme.spaceXs};
  font-size: ${(props) => props.theme.fontXs};
  outline: none !important;

  &:hover {
    background-color: ${(props) => props.theme.contextMenuBgColorHover};
  }

  ${(p) => {
    if (p.selected) {
      return css`
        background-color: ${(props) => props.theme.contextMenuBgColorHover};
      `
    }
  }}
`

const SearchContainer = styled.div`
  padding: ${(props) => props.theme.spaceXs};
  background-color: ${(props) => props.theme.contextMenuBgColor};
  border-bottom: 1px solid ${(props) => props.theme.slashMenuBorderColor};
  border-radius: ${(props) => props.theme.smallBorderRadius}
    ${(props) => props.theme.smallBorderRadius} 0 0;
`

const MenuContainer = styled.div`
  display: flex;
  flex: 1;
`
