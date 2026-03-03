import { IHeadingData } from './HeadingTree';

export default class HeadingNode {
  title: string;
  children: HeadingNode[];
  parent: HeadingNode | null;
  private offsetCacheVersion: number | null;
  cachedOffsetTop: number | null;
  private htmlNode: HTMLElement | null;
  depth: number; // relative depth, starts from 0
  id: string;
  key: number; // faster comparison than by id
  chapter: string;
  h: IHeadingData;
  onClick?: (headingItem: IHeadingData) => void;

  constructor(params: {
    depth: number;
    key: number;
    offsetCacheVersion: number;
    chapter: string;
    h: IHeadingData;
  }) {
    const { depth, key, offsetCacheVersion, chapter, h } = params;
    const { htmlNode, value, id, onClick } = h
    this.htmlNode = htmlNode;
    this.title = value;
    this.parent = null;
    this.children = [];
    this.depth = depth;
    this.id = id;
    this.key = key;
    this.cachedOffsetTop = null;
    this.offsetCacheVersion = offsetCacheVersion - 1;
    this.chapter = chapter;
    this.h = h;
    this.onClick = onClick;
  }

  lazyLoad(curCacheVersion: number) {
    if (curCacheVersion === this.offsetCacheVersion) {
      return;
    }
    if (!this.htmlNode) {
      this.htmlNode = document.getElementById(this.id);
    }

    if (this.htmlNode) {
      this.cachedOffsetTop = this.htmlNode.offsetTop;
      this.offsetCacheVersion = curCacheVersion;
    }
  }
}
