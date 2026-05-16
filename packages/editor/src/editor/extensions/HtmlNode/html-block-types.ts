import { Extension } from "@codemirror/state";
import { CustomCopyFunction } from "../CodeMirror/codemirror-types";
import type { ExtensionsOptions } from "../index";

export interface LineHtmlBlockExtensionOptions {
  customCopyFunction?: CustomCopyFunction
  codemirrorExtensions?: Extension[]
  handleViewImgSrcUrl?: ExtensionsOptions['handleViewImgSrcUrl']
}
