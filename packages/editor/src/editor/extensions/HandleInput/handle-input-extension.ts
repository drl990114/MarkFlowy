import type { CreateExtensionPlugin } from '@rme-sdk/core'
import { PlainExtension } from '@rme-sdk/core'
import type { Node as ProsemirrorNode } from '@rme-sdk/pm/model'
import type { Transaction } from '@rme-sdk/pm/state'
import {
  getHtmlImageInputRule,
  getInlineMathInputRule,
  getMdImageInputRule,
} from '../../inline-input-regex'

/**
 * 输入处理规则接口
 */
export interface InputRule {
  // 匹配的正则表达式
  regexp: RegExp
  // 要创建的节点类型
  type: string
  // 获取节点属性的函数
  getAttributes?: (match: RegExpMatchArray) => Record<string, any> | null
  // 获取节点内容的函数（可选）
  getContent?: (match: RegExpMatchArray, schema: any) => ProsemirrorNode | ProsemirrorNode[] | null
}

export const excludeNodeName = ['math_block', 'codeMirror', 'reference_def']
export class HandleInputExtension extends PlainExtension {
  private inputRules: InputRule[] = [
    ...getMdImageInputRule<string>('md_image'),
    ...getInlineMathInputRule<string>('math_inline'),
    ...getHtmlImageInputRule<string>('html_image'),
  ]

  constructor(options?: { rules?: InputRule[] }) {
    super()
    if (options?.rules) {
      this.inputRules = [...this.inputRules, ...options.rules]
    }
  }

  get name() {
    return 'handle_input' as const
  }

  addRule(rule: InputRule): void {
    this.inputRules.push(rule)
  }

  createPlugin(): CreateExtensionPlugin {
    return {
      appendTransaction: (transactions, oldState, newState) => {
        if (!transactions.some((tr) => tr.docChanged)) {
          return null
        }

        // 获取最后一个事务的变更信息
        const lastTr = transactions[transactions.length - 1]
        if (!lastTr.docChanged) {
          return null
        }

        // 排除来自 CodeMirror 节点的事务
        // 检查事务是否涉及 codeMirror 节点的变更
        let involvesCodeMirror = false
        lastTr.mapping.maps.forEach((stepMap) => {
          stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
            // 检查变更范围内是否包含 codeMirror 节点
            newState.doc.nodesBetween(newStart, newEnd, (node, pos) => {
              if (excludeNodeName.includes(node.type.name)) {
                involvesCodeMirror = true
                return false // 停止遍历
              }
              return true
            })
          })
        })

        // 如果事务涉及 CodeMirror 节点，则不处理
        if (involvesCodeMirror) {
          return null
        }

        let tr: Transaction | null = null
        const schema = newState.schema

        // 收集所有匹配的位置和替换信息，按照位置倒序排列
        const replacements: Array<{
          from: number
          to: number
          node: ProsemirrorNode
        }> = []

        // 检查变更区域的文本节点
        lastTr.mapping.maps.forEach((stepMap) => {
          stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
            // 扩展搜索范围以包含可能的匹配
            const searchFrom = Math.max(0, newStart - 100)
            const searchTo = Math.min(newState.doc.content.size, newEnd + 100)

            newState.doc.nodesBetween(searchFrom, searchTo, (node, pos) => {
              // 跳过 CodeMirror 节点内部的内容
              if (excludeNodeName.includes(node.type.name)) {
                return false // 不处理 CodeMirror 节点内部
              }

              // 只处理文本节点
              if (!node.isText || !node.text) {
                return true
              }

              // 检查父节点
              const $pos = newState.doc.resolve(pos)
              const parent = $pos.parent
              const excludeParentNodes = ['math_block', 'codeMirror', 'reference_def', 'html_block', 'mermaid_node']
              if (excludeParentNodes.includes(parent.type.name)) {
                return true
              }

              const text = node.text
              // 遍历所有输入规则
              for (const rule of this.inputRules) {
                let match: RegExpMatchArray | null
                // 重置正则表达式的 lastIndex，避免全局匹配状态问题
                rule.regexp.lastIndex = 0

                while ((match = rule.regexp.exec(text)) !== null) {
                  // 计算匹配在文档中的确切起止位置
                  const matchIndex = match.index ?? 0
                  const start = pos + matchIndex
                  const end = start + match[0].length

                  // 检查位置是否有效
                  if (start >= 0 && end <= newState.doc.content.size) {
                    // 创建新节点
                    console.log('nodenode', node)
                    const attrs = rule.getAttributes ? rule.getAttributes(match) : null

                    if (node.attrs['data-rme-from-paste'] === 'true' && attrs) {
                      attrs['data-rme-from-paste'] = 'true'
                    }

                    // 检查节点类型是否存在
                    const nodeType = schema.nodes[rule.type]
                    if (!nodeType) {
                      console.warn(`Node type '${rule.type}' not found in schema`)
                      continue
                    }

                    // 对于 atom 节点，不应该有内容
                    let newNode: ProsemirrorNode
                    if (nodeType.spec.atom) {
                      newNode = nodeType.create(attrs)
                    } else {
                      // 对于非原子节点，添加内容
                      let content = null
                      if (rule.getContent) {
                        content = rule.getContent(match, schema)
                      } else {
                        content = schema.text(match[0])
                      }
                      newNode = nodeType.create(attrs, content)
                    }

                    // 添加到替换列表
                    replacements.push({ from: start, to: end, node: newNode })
                  }

                  // 如果不是全局匹配，退出循环
                  if (!rule.regexp.global) {
                    break
                  }
                }
              }
              return true
            })
          })
        })

        // 如果有替换，按位置倒序排列并执行
        if (replacements.length > 0) {
          // 过滤掉被更长匹配覆盖的短匹配
          replacements.sort((a, b) => a.from - b.from || b.to - a.to)
          const filtered: typeof replacements = []
          for (const r of replacements) {
            let covered = false
            for (const f of filtered) {
              if (f.from <= r.from && f.to >= r.to) {
                covered = true
                break
              }
            }
            if (!covered) {
              filtered.push(r)
            }
          }

          // 按位置倒序排列，从后往前替换，避免位置偏移问题
          filtered.sort((a, b) => b.from - a.from)

          tr = newState.tr

          for (const replacement of filtered) {
            // 验证位置仍然有效
            if (replacement.from >= 0 && replacement.to <= tr.doc.content.size) {
              tr = tr.replaceWith(replacement.from, replacement.to, replacement.node)
            }
          }
        }

        // 如果事务有变化，返回事务，否则返回null
        return tr && tr.docChanged ? tr : null
      },
    }
  }
}
