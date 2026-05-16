import type { Node as ProseMirrorNode, Slice } from '@rme-sdk/pm/model';
import { NodeSelection } from '@rme-sdk/pm/state';
import type { EditorView } from '@rme-sdk/pm/view';

export type DragEventHandler = (options: DragEventHandlerOptions) => boolean
/**
 * Options for {@link DragEventHandler}.
 *
 * @public
 */
export interface DragEventHandlerOptions {
  /**
   * The editor's view.
   */
  view: EditorView
  /**
   * The drop position in current document.
   */
  pos: number
  /**
   * The `dragover` event.
   */
  event: DragEvent
}

/**
 * 节点指示器的状态接口
 */
export interface NodeIndicatorState {
  node: ProseMirrorNode | null;
  pos: number | null;
  rect: Rect | null;
}

export interface Rect {
  top: number
  right: number
  bottom: number
  left: number
}


/**
 * 显示处理函数的选项
 */
export interface ShowHandlerOptions {
  view: EditorView;
  pos: number;
  node: ProseMirrorNode;
  line: Line;
}

/**
 * 显示处理函数类型
 */
export type ShowHandler = (options: ShowHandlerOptions) => void;

/**
 * 隐藏处理函数类型
 */
export type HideHandler = () => void;

/**
 * 点接口
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * 线接口
 */
export interface Line {
  readonly p1: Point;
  readonly p2: Point;
}

/**
 * 节点指示器插件选项
 */
export interface NodeIndicatorPluginOptions {
  onShow?: ShowHandler;
  onHide?: HideHandler;
}

export interface ViewDragging {
  readonly slice: Slice
  readonly move: boolean
  readonly node?: NodeSelection
}
