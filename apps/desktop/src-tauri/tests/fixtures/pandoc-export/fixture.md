---
title: Pandoc export fixture
lang: zh-CN
---

# 中英文标题

Paragraph with **bold**, *emphasis*, and `inline code`.

1. Ordered item
   - Nested item
   - [x] Completed task

| Name | Value |
| --- | ---: |
| 中文 | 42 |

A footnote reference.[^note]

Inline math: $E = mc^2$.

```ts
const answer: number = 42
```

```mermaid
flowchart LR
  A --> B
```

![Local image](./local-image.svg)

![Missing image](./missing-image.png)

[^note]: Footnote text.
