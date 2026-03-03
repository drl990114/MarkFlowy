import HeadingNode from './HeadingTreeNode';

export enum TraverseResult {
  Continue = 1,
  NoChildren = 2,
  Stop = 3,
}

export interface IHeadingData {
  depth: number; // h2 => 2, h3 => 3, etc
  value: string;
  id: string;
  htmlNode: HTMLElement | null;
  onClick?: (headingItem: IHeadingData) => void;
}

export class HeadingTree {
  private root?: HeadingNode;

  private offsetCacheVersion: number;

  constructor(headings: IHeadingData[]) {
    // Make depths of nodes relative
    const minDepth = Math.min(...headings.map((h) => h.depth));
    const offsetCacheVersion = 0;

    const headingNodes: HeadingNode[] = headings.map((h, i) => {
      return new HeadingNode({
        h,
        depth: h.depth - minDepth,
        key: i,
        offsetCacheVersion,
        chapter: '0',
      });
    });

    const nodeStack: HeadingNode[] = [
      new HeadingNode({
        h: { depth: -1, value: '', id: '', htmlNode: null },
        depth: -1,
        key: -1,
        offsetCacheVersion,
        chapter: '0',
      }),
    ]; // init with root node
    headingNodes.forEach((node) => {
      while (nodeStack.length && nodeStack[nodeStack.length - 1].depth >= node.depth) {
        nodeStack.pop();
      }

      nodeStack[nodeStack.length - 1].children.push(node);
      node.parent = nodeStack[nodeStack.length - 1];

      const sameDepthSiblings = node.parent.children.filter((n) => n.depth === node.depth);

      let diff = node.depth - Math.max(node.parent.depth, 0);
      if (diff === 0) {
        node.chapter = String(sameDepthSiblings.length);
      } else if (diff === 1) {
        node.chapter = `${node.parent.chapter}.${sameDepthSiblings.length}`;
      } else {
        node.chapter = node.parent.chapter;

        while (diff >= 1) {
          node.chapter += '.';
          if (diff === 1) {
            node.chapter += sameDepthSiblings.length;
          } else {
            node.chapter += 0;
          }
          diff--;
        }
      }

      nodeStack.push(node);
    });

    this.root = nodeStack[0];
    this.offsetCacheVersion = offsetCacheVersion;
  }

  getRoot() {
    return this.root;
  }

  markOffsetCacheStale() {
    this.offsetCacheVersion++;
  }

  traverseInPreorder(f: (h: HeadingNode) => TraverseResult) {
    const visitChildren = (h: HeadingNode): TraverseResult => {
      for (const child of h.children) {
        if (visit(child) === TraverseResult.Stop) {
          return TraverseResult.Stop;
        }
      }
      return TraverseResult.Continue;
    };

    const visit = (h: HeadingNode): TraverseResult => {
      h.lazyLoad(this.offsetCacheVersion);
      const res = f(h);
      if (res !== TraverseResult.Continue) {
        return res;
      }
      return visitChildren(h);
    };

    visitChildren(this.root!);
  }
}
