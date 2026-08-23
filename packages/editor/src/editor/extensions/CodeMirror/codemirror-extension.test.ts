import { LineTextExtension } from '../Text/text-extension'
import { LineParagraphExtension } from '../Paragraph/paragraph-extension'
import { fakeIndentedLanguage, LineCodeMirrorExtension } from './codemirror-extension'
import { renderEditor } from "jest-remirror"
import { describe, expect, test } from "vitest"
import { buildMarkdownParser, buildMarkdownSerializer } from '@/editor/components/WysiwygEditor/delegate'
import { dedent } from '@/editor/utils/common'

class StaticLineCodeMirrorExtension extends LineCodeMirrorExtension {
    createNodeViews() {
        return () => {
            const dom = document.createElement('pre')
            const contentDOM = document.createElement('code')
            dom.append(contentDOM)
            return { contentDOM, dom }
        }
    }
}

const setup = ({ staticCodeMirror = false } = {}) => {
    const codeMirrorExtension = staticCodeMirror
        ? new StaticLineCodeMirrorExtension({ hideDecoration: true })
        : new LineCodeMirrorExtension({})
    const editor = renderEditor([
        new LineParagraphExtension(),
        new LineTextExtension(),
        codeMirrorExtension,
    ])
    const {
        view,
        add,
        nodes: { doc, p },
        attributeNodes: { codeMirror },
        manager,
        schema,
    } = editor

    return {
        manager,
        view,
        schema,
        add,
        doc,
        p,
        codeMirror,
        codeBlock: codeMirror,
    }
}

describe("fromMarkdown", () => {
    const { manager, doc, codeBlock } = setup()
    const parser = buildMarkdownParser(manager)

    describe("Indented code blocks", () => {
        test("indented code blocks", () => {
            expect(parser.parse(["    markdown", "    code", "    block"].join("\n"))).toEqualRemirrorDocument(
                doc(
                    codeBlock({
                        language: fakeIndentedLanguage,
                    })("markdown\ncode\nblock"),
                ),
            )
        })
    })
    describe("Fenced code blocks", () => {
        test("python language", () => {
            expect(
                parser.parse(["```python", "print('hello world!')", "print('hello world!')", "print('hello world!')", "```"].join("\n")),
            ).toEqualRemirrorDocument(
                doc(
                    codeBlock({
                        language: "python",
                    })("print('hello world!')\nprint('hello world!')\nprint('hello world!')"),
                ),
            )
        })

        test("unknow language", () => {
            expect(parser.parse(["```unknow", "bla bla bla bla", "```"].join("\n"))).toEqualRemirrorDocument(
                doc(
                    codeBlock({
                        language: "unknow",
                    })("bla bla bla bla"),
                ),
            )
        })

        test("empty language", () => {
            expect(parser.parse(["```", "echo 'hello world!'", "```"].join("\n"))).toEqualRemirrorDocument(
                doc(
                    codeBlock({
                        language: "",
                    })("echo 'hello world!'"),
                ),
            )
        })
    })
})

describe("toMarkdown", () => {
    const { manager, doc, codeBlock, p } = setup()
    const serializer = buildMarkdownSerializer(manager)

    describe("Indented code blocks", () => {
        test("one-line code with 0 newline at the end", () => {
            expect(
                serializer.serialize(
                    doc(
                        codeBlock({
                            language: fakeIndentedLanguage,
                        })("markdown"),
                    ),
                ),
            ).toEqual("    markdown\n")
        })
        test("one-line code with 1 newline at the end", () => {
            expect(
                serializer.serialize(
                    doc(
                        codeBlock({
                            language: fakeIndentedLanguage,
                        })("markdown\n"),
                    ),
                ),
            ).toEqual("    markdown\n    \n")
        })
        test("multi-line code with 0 newline at the end", () => {
            expect(
                serializer.serialize(
                    doc(
                        codeBlock({
                            language: fakeIndentedLanguage,
                        })("markdown\nmarkdown\nmarkdown"),
                    ),
                ),
            ).toEqual("    markdown\n    markdown\n    markdown\n")
        })
        test("multi-line code with 1 newline at the end", () => {
            expect(
                serializer.serialize(
                    doc(
                        codeBlock({
                            language: fakeIndentedLanguage,
                        })("markdown\nmarkdown\nmarkdown\n"),
                    ),
                ),
            ).toEqual("    markdown\n    markdown\n    markdown\n    \n")
        })
    })

    describe("Fenced code blocks", () => {
        test("one-line code with 0 newline at the end", () => {
            expect(
                serializer.serialize(
                    doc(
                        codeBlock({
                            language: "",
                        })("markdown"),
                    ),
                ),
            ).toEqual("```\nmarkdown\n```\n")
        })
        test("one-line code with 1 newline at the end", () => {
            expect(
                serializer.serialize(
                    doc(
                        codeBlock({
                            language: "",
                        })("markdown\n"),
                    ),
                ),
            ).toEqual("```\nmarkdown\n\n```\n")
        })
        test("one-line code with 2 newlines at the end", () => {
            expect(
                serializer.serialize(
                    doc(
                        codeBlock({
                            language: "",
                        })("markdown\n\n"),
                    ),
                ),
            ).toEqual("```\nmarkdown\n\n\n```\n")
        })

        describe("Mixed with other blocks", () => {
            test("case 1", () => {
                expect(
                    serializer.serialize(
                        doc(
                            p("p0"),
                            p("p1"),
                            codeBlock({
                                language: "",
                            })("code"),
                            codeBlock({
                                language: fakeIndentedLanguage,
                            })("code"),
                            p("p2"),
                        ),
                    ),
                ).toEqual(
                    // TODO: I don't need two empty lines between two blocks
                    dedent(
                        `
                        p0

                        p1

                        \`\`\`
                        code
                        \`\`\`

                            code

                        p2
                        `,
                    ).trim(),
                )
            })
        })
    })
})

describe('keyboard shortcuts', () => {
    test('turns a document-leading code fence into a regular code block on Enter', () => {
        const { add, doc, manager, p, view } = setup({ staticCodeMirror: true })

        try {
            add(doc(p('```<cursor>')))
            view.dom.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))

            expect(view.state.doc.firstChild?.type.name).toBe('codeMirror')
            expect(view.state.doc.firstChild?.attrs).toMatchObject({
                'front-matter': false,
                language: '',
            })
            expect(view.state.selection.$from.parent.type.name).toBe('codeMirror')
            expect(view.state.selection.$from.parentOffset).toBe(0)
        } finally {
            manager.destroy()
        }
    })
})
