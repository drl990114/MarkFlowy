import { useVirtualizer } from '@tanstack/react-virtual';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { IHeadingData } from './HeadingTree';
import { HeadingTree, TraverseResult } from './HeadingTree';
import type HeadingNode from './HeadingTreeNode';
import { isTableOfContentsHeadingActive } from './activeHeading';
import { TocDisclosure, TocDisclosureSlot, TocDiv, TocLink, TocListItem } from './styles'

export type TableOfContentsRef = {
  refresh: (args: { newContainer: HTMLElement; newScroll: HTMLElement }) => void;
  refreshByHeadings: (args: { newHeadings: IHeadingData[] }) => void;
  collapseAll: () => void
  expandAll: () => void
};

export interface TableOfContentsProps {
  /**
   * if false, the toc will expaand all headings
   * if true, the toc will only expand headings that are active
   * @default false
   */
  autoExpand?: boolean;
  headingsData?: IHeadingData[];
  containerEl?: HTMLElement;
  scrollEl?: HTMLElement;
  /**
   * The component to render when there are no headings
   * @default null
   */
  Empty?: React.ReactNode;
  variant?: 'sidebar' | 'editor';
  /**
   * Whether to use compact (thumbnail) mode
   * @default true
   */
  compact?: boolean;
  /**
   * Whether the TOC is pinned (always show scrollbar)
   * @default false
   */
  pinned?: boolean;
  /**
   * Optional toolbar content shown on hover
   */
  toolbar?: React.ReactNode;
  /**
   * Keep toolbar fixed at top while scrolling
   * @default false
   */
  toolbarFixed?: boolean;
  /**
   * Force active heading id when provided
   */
  activeId?: string;
  /**
   * Whether to render chapter text before each heading title.
   * @default true
   */
  showChapter?: boolean;
  /** Opt-in manual folding. Existing automatic expansion remains the default. */
  collapsible?: boolean
  collapsedHeadingIds?: ReadonlySet<string>
  onCollapsedHeadingIdsChange?: (ids: ReadonlySet<string>) => void
  collapseLabel?: string
  expandLabel?: string
}

const TableOfContents = forwardRef<TableOfContentsRef, TableOfContentsProps>((props, ref) => {
  const {
    headingsData,
    containerEl,
    scrollEl,
    autoExpand = false,
    variant = 'sidebar',
    compact = true,
    pinned = false,
    toolbar,
    toolbarFixed = false,
    activeId,
    showChapter = true,
    collapsible = false,
    collapsedHeadingIds,
    onCollapsedHeadingIdsChange,
    collapseLabel = 'Collapse',
    expandLabel = 'Expand',
    Empty = null,
  } = props;
  const [headings, setHeadings] = useState(headingsData);
  const [headingTree, setHeadingTree] = useState<HeadingTree>();
  const [activeNodeState, setActiveNodeState] = useState<HeadingNode>();
  const [activeParentsState, setActiveParentsState] = useState<any>();
  const [container, setContainer] = useState<HTMLElement>();
  const [scroll, setScroll] = useState<HTMLElement | undefined>(scrollEl);
  const navRef = useRef<HTMLElement>(null);
  const revealedHeadingIdRef = useRef<string | undefined>(undefined)
  const [localCollapsedIds, setLocalCollapsedIds] = useState<ReadonlySet<string>>(() => new Set())
  const collapsedIds = collapsedHeadingIds ?? localCollapsedIds
  const changeCollapsedIds = (ids: ReadonlySet<string>) => {
    if (collapsedHeadingIds === undefined) setLocalCollapsedIds(ids)
    onCollapsedHeadingIdsChange?.(ids)
  }

  useEffect(() => {
    setHeadings(headingsData);
    if (headingsData) {
      setHeadingTree(new HeadingTree(headingsData));
    }
  }, [headingsData]);

  const flattenedHeadings = useMemo(() => {
    if (!headingTree) return [];
    const items: HeadingNode[] = [];
    headingTree.traverseInPreorder((h) => {
      items.push(h);
      if (collapsible) return collapsedIds.has(h.id) ? TraverseResult.NoChildren : TraverseResult.Continue
      return !autoExpand || activeParentsState?.[h.key] || h.parent?.key === -1
        ? TraverseResult.Continue
        : TraverseResult.NoChildren;
    });
    return items;
  }, [headingTree, autoExpand, activeParentsState, collapsible, collapsedIds])

  const visibleActiveId = useMemo(() => {
    if (!collapsible || !headingTree) return activeId
    const selectedId = activeId ?? activeNodeState?.id
    if (!selectedId) return undefined
    let selected: HeadingNode | undefined
    headingTree.traverseInPreorder((node) => {
      if (node.id !== selectedId) return TraverseResult.Continue
      selected = node
      return TraverseResult.Stop
    })
    let visible = selected
    while (selected?.parent && selected.parent.key !== -1) {
      selected = selected.parent
      if (collapsedIds.has(selected.id)) visible = selected
    }
    return visible?.id ?? activeId
  }, [activeId, activeNodeState?.id, headingTree, collapsible, collapsedIds])

  const rowVirtualizer = useVirtualizer({
    count: flattenedHeadings.length,
    getScrollElement: () => navRef.current,
    estimateSize: () => (variant === 'editor' ? 18 : 28),
    overscan: 10,
  });
  const viewportHeight = rowVirtualizer.scrollRect?.height

  const refreshContainerHeadings = useCallback((targetContainer: HTMLElement) => {
    if (!targetContainer) return;
    const headingElements = targetContainer.querySelectorAll(
      'h1, h2, h3, h4, h5, h6',
    ) as NodeListOf<HTMLHeadingElement>;
    const h: IHeadingData[] = [];
    headingElements.forEach((headingElement, index) => {
      const headingData: IHeadingData = {
        depth: parseInt(headingElement.tagName[1], 10),
        value: headingElement.innerText,
        htmlNode: headingElement,
        id: headingElement.id || `heading-${index}`,
      };
      h.push(headingData);
    });
    setHeadings(h);
    const tree = new HeadingTree(h);
    setHeadingTree(tree);
    return tree;
  }, []);

  const parseHeadings = useCallback(
    (c?: HTMLElement) => {
      const targetContainer = c || containerEl;

      if (!targetContainer && !headings) {
        return;
      }

      if (!headings) {
        if (targetContainer) {
          refreshContainerHeadings(targetContainer);
        } else {
          throw new Error('No headings and containerEl found');
        }
      } else {
        const tree = new HeadingTree(headings);
        setHeadingTree(tree);
      }
      setContainer(targetContainer);

      return targetContainer;
    },
    [containerEl, headings, refreshContainerHeadings],
  );

  const findActiveNode = useCallback(() => {
    if (!headingTree || !scroll) {
      return null;
    }

    const offsetToBecomeActive = 10;
    const curScrollPos = scroll.scrollTop + offsetToBecomeActive;

    let activeNode = null;
    let lastNode: HeadingNode | null = null;
    headingTree.traverseInPreorder((h: HeadingNode) => {
      const hOffsetTop = Math.max( (h.cachedOffsetTop || 0) - (container?.offsetTop || 0), 0);

      if (curScrollPos > hOffsetTop) {
        lastNode = h;
        return TraverseResult.Continue;
      }

      activeNode = lastNode;
      return TraverseResult.Stop;
    });

    if (activeNode === null && lastNode !== null && container) {
      return lastNode;
    }

    return activeNode;
  }, [headingTree, container, scroll]);

  const buildActiveParents = useCallback(
    (activeNode: HeadingNode) => {
      if (headingTree) {
        let curNode = activeNode;
        const activeParents: Record<string, any> = {};
        const root = headingTree.getRoot();
        if (root) {
          activeParents[root.key] = true;
          while (curNode !== null) {
            activeParents[curNode.key] = true;
            curNode = curNode.parent!;
          }
          return activeParents;
        }
      }
    },
    [headingTree],
  );

  useEffect(() => {
    if (!activeId || !headingTree) {
      return;
    }

    let targetNode: HeadingNode | null = null;
    headingTree.traverseInPreorder((h: HeadingNode) => {
      if (h.id === activeId) {
        targetNode = h;
        return TraverseResult.Stop;
      }

      return TraverseResult.Continue;
    });

    if (targetNode && targetNode !== activeNodeState) {
      setActiveNodeState(targetNode);
      setActiveParentsState(buildActiveParents(targetNode));
    }
  }, [activeId, headingTree, activeNodeState, buildActiveParents]);

  const scrollHandler = useCallback(() => {
    if (activeId) {
      return;
    }

    const activeNode = findActiveNode();
    if (activeNode && activeNode !== activeNodeState) {
      const activeParents = buildActiveParents(activeNode);
      setActiveNodeState(activeNode);
      setActiveParentsState(activeParents);
    }
  }, [activeId, activeNodeState, buildActiveParents, findActiveNode]);

  const handleHeadingClick = (
    event: React.MouseEvent<HTMLAnchorElement, MouseEvent>,
    h: HeadingNode,
  ) => {
    event.preventDefault();
    const elemTopOffset = (h.cachedOffsetTop || 0) - (container?.offsetTop || 0);
    scroll?.scrollTo(0, elemTopOffset!);

    setActiveNodeState(h);
    setActiveParentsState(buildActiveParents(h));
  };

  useEffect(() => {
    if (!headingTree) {
      parseHeadings();
    } else {
      scrollHandler()
    }

    scroll?.addEventListener('scroll', scrollHandler);

    return () => {
      scroll?.removeEventListener('scroll', scrollHandler);
    };
  }, [headingTree, scroll, parseHeadings, scrollHandler]);

  useEffect(() => {
    if (!flattenedHeadings.length) {
      revealedHeadingIdRef.current = undefined
      return
    }
    const nav = navRef.current
    if (!nav || nav.clientHeight <= 0) return
    // The controlled node and its expanded parents settle together. A sibling
    // can move when the previously active branch collapses in the next render.
    if (!collapsible && autoExpand && activeId && activeNodeState?.id !== activeId) return
    const index = flattenedHeadings.findIndex((h) =>
      isTableOfContentsHeadingActive({
        activeId: visibleActiveId,
        activeNodeKey: activeNodeState?.key,
        firstHeadingKey: flattenedHeadings[0]?.key,
        headingId: h.id,
        headingKey: h.key,
      }),
    )
    // A controlled id may arrive before its headings or expanded parents.
    if (index < 0) return
    // Folding is a manual view operation, not a new document navigation intent.
    // Keep the semantic active id so folding its ancestors never steals scrolling.
    const headingId = activeId ?? activeNodeState?.id ?? flattenedHeadings[index].id
    if (revealedHeadingIdRef.current === headingId) return

    if (flattenedHeadings.length > 50) {
      const offset = rowVirtualizer.getOffsetForIndex(index, 'auto')?.[0]
      if (offset === undefined) return
      revealedHeadingIdRef.current = headingId
      // Rows have fixed heights, so one offset is enough. scrollToIndex retries
      // across frames and can undo a user's immediate manual outline scroll.
      if (offset !== nav.scrollTop) rowVirtualizer.scrollToOffset(offset)
      return
    }

    const row = nav.querySelector<HTMLElement>(`li[aria-posinset="${index + 1}"]`)
    if (!row) return
    revealedHeadingIdRef.current = headingId
    // Compact and expanded nonvirtual rows have different actual heights.
    // Scroll this nav only; scrollIntoView would also move ancestor panels.
    const rowRect = row.getBoundingClientRect()
    const top = nav.getBoundingClientRect().top + nav.clientTop
    const bottom = top + nav.clientHeight
    const delta = rowRect.top < top ? rowRect.top - top : Math.max(0, rowRect.bottom - bottom)
    if (delta) nav.scrollTo({ top: nav.scrollTop + delta, behavior: 'auto' })
    // Remember the semantic id across tree refreshes. Reading elsewhere in the
    // outline must not be pulled back by a scroll render or a title update.
  }, [activeId, activeNodeState?.id, activeNodeState?.key, autoExpand, collapsible, visibleActiveId, flattenedHeadings, rowVirtualizer, viewportHeight])

  useImperativeHandle(ref, () => ({
    refresh: ({ newContainer, newScroll }) => {
      refreshContainerHeadings(newContainer || container);
      setContainer(newContainer);
      setScroll(newScroll);
    },
    refreshByHeadings: ({ newHeadings }) => {
      setHeadings(newHeadings);
      setHeadingTree(new HeadingTree(newHeadings));
      setScroll(undefined)
      setContainer(undefined)
    },
    collapseAll: () => {
      if (!collapsible) return
      const ids = new Set<string>()
      headingTree?.traverseInPreorder((node) => {
        if (node.children.length) ids.add(node.id)
        return TraverseResult.Continue
      })
      changeCollapsedIds(ids)
    },
    expandAll: () => {
      if (collapsible) changeCollapsedIds(new Set())
    },
  }));

  const renderHeadings = () => {
    if (flattenedHeadings.length === 0) {
      return null;
    }

    const renderItem = (h: HeadingNode, index: number, style?: React.CSSProperties) => {
      const isActive = isTableOfContentsHeadingActive({
        activeId: visibleActiveId,
        activeNodeKey: activeNodeState?.key,
        firstHeadingKey: flattenedHeadings[0]?.key,
        headingId: h.id,
        headingKey: h.key,
      });
      const titleLength = h.title?.length || 0;
      const baseBarWidth = Math.min(160, Math.max(16, 10 + titleLength * 4 - h.depth * 3));
      const headingLevel = h.h?.depth ?? h.depth + 1;
      const levelIndex = Math.min(6, Math.max(1, headingLevel || 1)) - 1;
      const barWidthByLevel = Math.max(4, 24 - levelIndex * 4);
      const barWidth = variant === 'editor' ? barWidthByLevel : baseBarWidth;

      return (
        <TocListItem
          depth={h.depth}
          active={isActive}
          key={h.key}
          aria-posinset={index + 1}
          aria-setsize={flattenedHeadings.length}
          data-mf-toc-collapsible={collapsible || undefined}
          data-collapsed={collapsible && collapsedIds.has(h.id) || undefined}
          style={style}
        >
          {collapsible ? (
            <TocDisclosureSlot style={{ marginInlineStart: `calc(7px + ${h.depth}em)` }}>
              {h.children.length ? (
                <TocDisclosure
                  data-slot='toc-disclosure'
                  aria-label={`${collapsedIds.has(h.id) ? expandLabel : collapseLabel} ${h.title}`}
                  aria-expanded={!collapsedIds.has(h.id)}
                  size='icon-chrome'
                  variant='ghost'
                  onClick={() => {
                    const next = new Set(collapsedIds)
                    if (next.has(h.id)) next.delete(h.id)
                    else next.add(h.id)
                    changeCollapsedIds(next)
                  }}
                >
                  <svg aria-hidden='true' viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='1.5'>
                    <path d={collapsedIds.has(h.id) ? 'm6 4 4 4-4 4' : 'm4 6 4 4 4-4'} />
                  </svg>
                </TocDisclosure>
              ) : null}
            </TocDisclosureSlot>
          ) : null}
          <TocLink
            aria-current={isActive ? 'location' : undefined}
            href={`#${h.id}`}
            active={isActive}
            depth={h.depth}
            compact={compact}
            tocBarWidth={barWidth}
            onClick={(ev: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
              ev.preventDefault();
              if (h.onClick) {
                h.onClick(h.h);
              } else {
                handleHeadingClick(ev, h);
              }
            }}
          >
            {showChapter && h.h.chapter !== null ? (
              <span className="toc-link__chapter">{h.h.chapter ?? h.chapter}</span>
            ) : null}
            <span className="toc-link__title">{h.title}</span>
          </TocLink>
        </TocListItem>
      );
    };

    if (flattenedHeadings.length > 50) {
      const handleScrollWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
      };

      const navStyle: React.CSSProperties = {
        height: `${rowVirtualizer.getTotalSize()}px`,
        width: '100%',
        position: 'relative',
      };

      return (
        <nav
          ref={navRef}
          onWheel={handleScrollWheel}
          className={!compact || pinned ? 'show-scrollbar' : ''}
        >
          <ul style={navStyle}>
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const h = flattenedHeadings[virtualItem.index];
              return renderItem(h, virtualItem.index, {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              });
            })}
          </ul>
        </nav>
      );
    }

    return (
      <nav ref={navRef} className={!compact || pinned ? 'show-scrollbar' : ''}>
        <ul>{flattenedHeadings.map((h, index) => renderItem(h, index))}</ul>
      </nav>
    );
  };

  return (
    <TocDiv variant={variant} compact={compact} toolbarFixed={toolbarFixed} hasToolbar={!!toolbar}>
      <div className={`toc-list ${!compact || pinned ? 'toc-list--expanded' : ''}`}>
        {toolbar}
        {headingTree?.getRoot()?.children?.length === 0 ? (
          Empty
        ) : (
          <>{renderHeadings()}</>
        )}
      </div>
    </TocDiv>
  );
});

TableOfContents.displayName = 'TableOfContents';

export default TableOfContents;
