/* eslint-disable react-hooks/rules-of-hooks */
import { prosemirrorNodeToHtml, type Extension, type RemirrorEventListenerProps } from '@rme-sdk/main'
import { Slice } from '@rme-sdk/pm'
import { type Node } from '@rme-sdk/pm/model'
import { forwardRef, memo, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'
import {
  EditorViewType,
  HTMLAstNode,
  Preview,
  WysiwygToolbarProps,
  type CreateWysiwygDelegateOptions,
  type EditorContext,
  type EditorDelegate,
} from '../..'
import SourceEditor, { createSourceCodeDelegate } from './SourceEditor'
import { useContextMounted } from './useContextMounted'
import WysiwygEditor, { createWysiwygDelegate } from './WysiwygEditor'
// @ts-ignore
import HTML from 'html-parse-stringify'
import { nanoid } from 'nanoid'
import { ErrorBoundaryProps } from './ErrorBoundary'
import { ITextProps } from './WysiwygEditor/Text'

export const Editor = memo(
  forwardRef<EditorRef, EditorProps>((props, ref) => {
    const {
      initialType = EditorViewType.WYSIWYG,
      hooks = [],
      onContextMounted,
      ...otherProps
    } = props
    const [type, setType] = useState<EditorViewType>(initialType)
    const editorContextRef = useRef<EditorContext | null>(null)

    const resolveDelegate = useCallback(() => {
      if (otherProps.delegate) {
        return otherProps.delegate
      }
      if (type === EditorViewType.SOURCECODE) {
        return createSourceCodeDelegate()
      }
      return createWysiwygDelegate(otherProps.delegateOptions)
    }, [otherProps.delegate, otherProps.delegateOptions, type])

    const applyContentToView = useCallback(
      (nextContent: string) => {
        const view = editorContextRef.current?.view
        if (!view) {
          return
        }
        const delegate = resolveDelegate()
        const nextDoc = delegate.stringToDoc(nextContent)
        const tr = view.state.tr.replace(
          0,
          view.state.doc.content.size,
          new Slice(nextDoc.content, 0, 0),
        )
        view.dispatch(tr)
      },
      [resolveDelegate],
    )

    const handleContextMounted = useCallback(
      (context: EditorContext) => {
        editorContextRef.current = context
        onContextMounted?.(context)
      },
      [onContextMounted],
    )

    useImperativeHandle(ref, () => ({
      getType: () => type,
      toggleType: (targetType: EditorViewType) => {
        setType(targetType)
      },
      setContent: (nextContent: string) => {
        if (nextContent === otherProps.content) {
          return
        }
        applyContentToView(nextContent)
      },
      exportHtml: async () => {
        return new Promise<string>((resolve) => {
          let targetDoc: Node | string = otherProps.content

          if (typeof targetDoc === 'string') {
            targetDoc = createWysiwygDelegate(otherProps.delegateOptions).stringToDoc(targetDoc)
          }

          const html = prosemirrorNodeToHtml(targetDoc)

          const fullAst = HTML.parse(html)

          const imageLoadTasks: Promise<void>[] = []
          const handleHtmlText = async (ast: HTMLAstNode[]) => {
            const handleNode = (node: HTMLAstNode) => {
              if (!node) {
                return
              }

              if (
                node.name === 'img' &&
                node.attrs?.src &&
                otherProps.delegateOptions?.handleViewImgSrcUrl
              ) {
                imageLoadTasks.push(
                  (async () => {
                    node.attrs.src = await otherProps.delegateOptions?.handleViewImgSrcUrl?.(
                      node.attrs.src,
                    )
                    node.attrs.key = nanoid()
                  })(),
                )
              }

              if (node.children) {
                handleHtmlText(node.children)
              }
            }

            for (let i = 0; i < ast.length; i++) {
              handleNode(ast[i])
            }
          }

          handleHtmlText(fullAst)
          Promise.all(imageLoadTasks)
            .then((res) => {
              resolve(HTML.stringify(fullAst))
            })
            .catch(() => {
              resolve(html)
            })
        })
      },
    }))

    const editorHooks = useMemo(() => {
      return [() => useContextMounted(handleContextMounted), ...hooks]
    }, [handleContextMounted, hooks])

    if (type === 'preview') {
      return (
        <Preview
          doc={otherProps.content}
          delegateOptions={otherProps.delegateOptions}
          handleLinkClick={otherProps.delegateOptions?.handleLinkClick}
        />
      )
    }

    return type === 'sourceCode' ? (
      <SourceEditor {...otherProps} hooks={editorHooks} />
    ) : (
      <WysiwygEditor {...otherProps} hooks={editorHooks} />
    )
  }),
)

export type EditorChangeEventParams = RemirrorEventListenerProps<Extension>
export type EditorChangeHandler = (params: EditorChangeEventParams) => void

export type EditorRef = {
  toggleType: (targetType: EditorViewType) => void
  getType: () => EditorViewType
  exportHtml: () => Promise<string>
  setContent: (nextContent: string) => void
}

export const defaultStyleToken = {
  rootFontSize: '15px',
  rootLineHeight: '1.6',
}

export interface EditorProps {
  initialType?: EditorViewType
  delegate?: EditorDelegate
  styleToken?: {
    /**
     * @default 15px
     */
    rootFontSize?: string
    /**
     * @default 1.6
     */
    rootLineHeight?: string
  }
  content: string
  wysiwygTextContainerProps?: ITextProps
  sourceCodeTextContainerProps?: ITextProps
  isTesting?: boolean
  editable?: boolean
  delegateOptions?: CreateWysiwygDelegateOptions
  onChange?: EditorChangeHandler
  hooks?: (() => void)[]
  markdownToolBar?: React.ReactNode[]
  wysiwygToolBar?: React.ReactNode[]
  wysiwygToolBarOptions?: {
    enable?: boolean
    compProps?: WysiwygToolbarProps
  }
  onContextMounted?: (context: EditorContext) => void
  errorHandler?: Pick<ErrorBoundaryProps, 'onError' | 'fallback'>
}
