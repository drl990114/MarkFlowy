const tick = String.fromCharCode(96)
const fence = tick.repeat(3)
const embeddedImage = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40"><rect x="1" y="1" width="118" height="38" rx="5" fill="none" stroke="currentColor"/><path d="M15 20l10 10 20-20M60 12h42M60 20h32M60 28h38" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
)}`
const rows = Array.from({ length: 70 }, (_, index) => {
  const row = `ROW-${String(index + 1).padStart(3, '0')}`
  return `| ${row} | 表格内容第 ${index + 1} 行，中英文混排 Table content | ${index + 1}.50 |`
})

export const fixtureValidation = {
  requiredText: [
    '中文正文可选择', 'MarkFlowy PDF Prototype', 'DOCUMENT-END',
    'MERGED-HEADER', 'MERGED-ROW', 'MERGED-TOTAL', 'MATH-END', 'MERMAID-END', 'TABLE-END',
  ],
  diagramLabels: ['中文起点', '中文终点', '客户端', '导出服务'],
  tableRows: Array.from({ length: 70 }, (_, index) => `ROW-${String(index + 1).padStart(3, '0')}`),
  tableHeader: 'TABLE-HEADER',
  distinctDuplicateTitle: '重复标题',
  // RME intentionally strips authored ids and prefixes retained a[name] values
  // with user-content-. The fixture's hrefs match those actual Preview names.
  links: {
    internal: [
      { label: '文内跳转', targetText: '跨页表格' },
      { label: '编码跳转', targetText: '跨页表格' },
      { label: '脚注跳转', targetText: 'FOOTNOTE-TARGET' },
      { label: '脚注回链', targetText: 'LINKS-ORIGIN' },
    ],
    external: [
      { label: '外部链接', url: 'https://example.com/#%E8%B7%A8%E9%A1%B5%E8%A1%A8%E6%A0%BC' },
    ],
  },
}

export const fixtureMarkdown = String.raw`# MarkFlowy PDF Prototype

本验收文档复用 MarkFlowy 的静态预览和导出文档准备流程。中文正文可选择，Latin text 123、标点“引号”、粗体与链接用于检查字体和文字提取。

## 中文与混排

<a name="pdf-links-origin">LINKS-ORIGIN</a>。**中文粗体 Bold**、*中文斜体 Italic*、行内代码 ${tick}const 中文 = 42${tick}，[文内跳转](#跨页表格)、[编码跳转](#%E8%B7%A8%E9%A1%B5%E8%A1%A8%E6%A0%BC)、[脚注跳转](#user-content-pdf-footnote)、[外部链接](https://example.com/#%E8%B7%A8%E9%A1%B5%E8%A1%A8%E6%A0%BC)。

### 重复标题

第一次出现的同名标题。DUPLICATE-FIRST，用于检查目录是否跳到正确的页，而不是误匹配正文或同名标题。

> 中文引用段落，检查边框、缩进和段落换行。这里继续保留可选择的文字。

![内嵌 SVG 图片](${embeddedImage})

- 中文列表项目一
- English list item two
  - 嵌套列表项目

${fence}typescript
function exportPdfFixture(title: string): string {
  return title + '：中文代码注释';
}
${fence}

### 重复标题

第二次出现的同名标题。DUPLICATE-SECOND，通过实际 PDF 页码和页内标题坐标检查两条同名目录各自的跳转位置。

###### 跳级标题

从三级直接跳到六级标题，检查目录层级没有丢失。深层标题后的可选择文字。

## Mermaid 图表

以下流程图和时序图由项目现有 Mermaid 渲染器生成，不手工绘制替代图。

${fence}mermaid
flowchart LR
  A["中文起点"] --> B{"兼容检查"}
  B -->|通过| C["中文终点"]
  B -->|需要适配| D["保留证据"]
${fence}

${fence}mermaid
sequenceDiagram
  participant C as 客户端
  participant S as 导出服务
  C->>S: 提交静态文档
  S-->>C: 返回 PDF 与标题目录
${fence}

MERMAID-END，用于确认图表之后的正文没有被吞掉。

## 数学公式

行内公式 $E = mc^2$ 应与这段中文文字保持同一行的基线；分式 $\frac{a+b}{c}$ 和根号 $\sqrt{x^2+y^2}$ 应保持完整。

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

$$
\begin{bmatrix} a & b \\ c & d \end{bmatrix}
\begin{pmatrix} x \\ y \end{pmatrix}
= \begin{pmatrix} ax+by \\ cx+dy \end{pmatrix}
$$

MATH-END。公式使用项目已有 MathJax SVG 输出，检查根号、积分、分式和矩阵的图形完整性。

## 跨页表格

以下表格包含 70 条唯一编号记录。检查所有记录均保留、记录不重复、跨页表头重复、列边界与中文换行正常。

| TABLE-HEADER 编号 | 中文说明 Description | 金额 |
| :--- | :--- | ---: |
${rows.join('\n')}

TABLE-END。表格之后的段落应继续正常排版。

## 合并单元格

以下原始 HTML 表格用于检查 colspan 和 rowspan；它经过同一预览与导出链路。

<table>
<thead><tr><th colspan="2">MERGED-HEADER 合并表头</th><th>数量</th></tr></thead>
<tbody>
<tr><td rowspan="2">MERGED-ROW 跨行中文</td><td>第一项</td><td>10</td></tr>
<tr><td>第二项</td><td>20</td></tr>
<tr><td colspan="2">MERGED-TOTAL 合计</td><td>30</td></tr>
</tbody>
</table>

## 结尾检查

DOCUMENT-END。最后一段用于确认正文末尾、目录末节与 PDF 最后一页均完整，且没有额外空白尾页。<a name="pdf-footnote">FOOTNOTE-TARGET</a>，[脚注回链](#user-content-pdf-links-origin)。
`
