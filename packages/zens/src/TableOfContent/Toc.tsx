import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';


import type { IHeadingData } from './HeadingTree';
import { HeadingTree, TraverseResult } from './HeadingTree';
import type HeadingNode from './HeadingTreeNode';
import { TocDiv, TocLink, TocListItem } from './styles';

export type TocRef = {
  refresh: (args: { newContainer: HTMLElement; newScroll: HTMLElement }) => void;
  refreshByHeadings: (args: { newHeadings: IHeadingData[] }) => void;
};

export interface TocProps {
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
}

export const Toc = forwardRef<TocRef, TocProps>((props, ref) => {
    const { headingsData, containerEl, scrollEl, autoExpand = false, Empty = null } = props;
    const [headings, setHeadings] = useState(headingsData);
    const [headingTree, setHeadingTree] = useState<HeadingTree>();
    const [activeNodeState, setActiveNodeState] = useState<HeadingNode>();
    const [activeParentsState, setActiveParentsState] = useState<any>();
    const [container, setContainer] = useState<HTMLElement>();
    const [scroll, setScroll] = useState<HTMLElement | undefined>(scrollEl);

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
        // Mark last heading active only if we didn't scroll after the end of the container.
        // if (scroll.scrollTop <= container.offsetTop + container.offsetHeight) {
          return lastNode;
        // }
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

    const scrollHandler = useCallback(() => {
      const activeNode = findActiveNode();
      if (activeNode && activeNode !== activeNodeState) {
        const activeParents = buildActiveParents(activeNode);
        setActiveNodeState(activeNode);
        setActiveParentsState(activeParents);
      }
    }, [activeNodeState, buildActiveParents, findActiveNode]);

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
    }));

    const renderHeadings = () => {
      if (!headingTree) {
        return;
      }
      const items: React.ReactNode[] = [];
      headingTree.traverseInPreorder((h) => {
        const isActive = !scroll ? true : !!(activeNodeState && activeNodeState.key === h.key);
        items.push(
          <TocListItem depth={h.depth} active={isActive} key={h.key}>
            <TocLink
              href={`#${h.id}`}
              active={isActive}
              depth={h.depth}
              onClick={(ev: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
                ev.preventDefault();
                if (h.onClick) {
                  h.onClick(h.h);
                } else {
                  handleHeadingClick(ev, h);
                }
              }}
            >
              <span className="toc-link__chapter">{h.chapter}</span>
              {h.title}
            </TocLink>
          </TocListItem>,
        );

        return !autoExpand || activeParentsState?.[h.key] || h.parent?.key === -1
          ? TraverseResult.Continue
          : TraverseResult.NoChildren;
      });

      return items;
    };

    return (
      <TocDiv>
        <div className="toc-list">
          {headingTree?.getRoot()?.children?.length === 0 ? (
            Empty
          ) : (
            <nav>
              <ul>{renderHeadings()}</ul>
            </nav>
          )}
        </div>
      </TocDiv>
    );
  });
