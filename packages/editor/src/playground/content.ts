const singleRow = `hello **strong**! hello *italic*! hello \`code\`! hello [link](https://www.google.com)!`

const justCodeContent = `
# 代码块专项测试

## JavaScript
\`\`\`javascript
const greeting = "Hello, MarkFlowy!"
console.log(greeting)

const sum = (a, b) => a + b
console.log(sum(1, 2))
\`\`\`

## Python
\`\`\`python
def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)
\`\`\`

## SQL
\`\`\`sql
SELECT u.name, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id
HAVING order_count > 5
ORDER BY order_count DESC
\`\`\`

## YAML
\`\`\`yaml
server:
  port: 8080
  host: localhost
database:
  driver: postgresql
  host: db.example.com
  port: 5432
  name: myapp
\`\`\`
`.trim()

const defaultContent = `
# MarkFlowy Editor — 全格式 Markdown 调试手册

欢迎使用 **MarkFlowy**，一个现代化的所见即所得 Markdown 编辑器。本文档覆盖了编辑器的全部 Markdown 格式能力，方便调试与体验。

---

## 一、标题层级

# 一级标题 H1
## 二级标题 H2
### 三级标题 H3
#### 四级标题 H4
##### 五级标题 H5
###### 六级标题 H6

---

## 二、行内格式

这是一段包含多种**粗体文字**、*斜体文字*、~~删除线~~、\`行内代码\` 的段落。还可以组合使用：***粗斜体***、**_粗斜体_**、_**粗斜体**_。

- 上标：X^2^ + Y^2^ = Z^2^
- 下标：H~2~O 是水的化学式
- 高亮：==这是一段高亮文字==
- 键盘：按下 <kbd>Ctrl</kbd> + <kbd>S</kbd> 保存

---

## 三、链接与图片

### 链接
- 普通链接：[MarkFlowy GitHub](https://github.com/drl990114/MarkFlowy)
- 自动链接：https://www.google.com
- 邮箱链接：<example@email.com>

### 引用式链接
引用式链接将 URL 定义与正文分离，适合多处引用同一链接的场景：

正文中使用 [MarkFlowy 项目][repo] 和 [问题追踪][issues] 来引用链接，也可以直接用 [GitHub][] 这种简写形式。

[repo]: https://github.com/drl990114/MarkFlowy "MarkFlowy 主仓库"
[issues]: https://github.com/drl990114/MarkFlowy/issues "问题追踪"
[GitHub]: https://github.com

### 引用式图片
同样支持引用式图片语法：

![MarkFlowy Logo][logo]

[logo]: https://www.markflowy.cc/logo.svg "MarkFlowy 示例图片"

---

## 四、列表

### 无序列表
- 项目一
- 项目二
  - 子项目 2.1
  - 子项目 2.2
    - 子子项目 2.2.1
- 项目三

### 有序列表
1. 第一步：安装依赖
2. 第二步：配置环境
   1. 配置数据库连接
   2. 配置 API 密钥
3. 第三步：启动服务

### 任务列表
- [x] 完成需求分析
- [x] 完成技术方案设计
- [ ] 编写单元测试
- [ ] 代码审查
- [ ] 部署上线

---

## 五、引用块

> 这是一段引用文字。Markdown 是一种轻量级标记语言，创始人为 John Gruber。
>
> — 维基百科

> 嵌套引用示例：
>> 这是第二层引用
>>> 这是第三层引用
>>
>> 回到第二层
>
> 回到第一层

---

## 六、代码块

### JavaScript
\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n
  let prev = 0, curr = 1
  for (let i = 2; i <= n; i++) {
    [prev, curr] = [curr, prev + curr]
  }
  return curr
}

console.log(fibonacci(10)) // 55
\`\`\`

### Python
\`\`\`python
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def inorder_traversal(root: TreeNode) -> list[int]:
    result = []
    def dfs(node):
        if not node:
            return
        dfs(node.left)
        result.append(node.val)
        dfs(node.right)
    dfs(root)
    return result
\`\`\`

### TypeScript
\`\`\`typescript
interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
}

async function fetchUser(id: number): Promise<User> {
  const response = await fetch(\`/api/users/\${id}\`)
  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`)
  }
  return response.json()
}
\`\`\`

### Shell
\`\`\`bash
#!/bin/bash
echo "Building project..."
npm run build
echo "Deploying to production..."
rsync -avz ./dist/ user@server:/var/www/app/
echo "Done!"
\`\`\`

---

## 七、表格

### 基础表格
| 姓名 | 年龄 | 城市 | 职业 |
|------|------|------|------|
| 张三 | 28 | 北京 | 前端工程师 |
| 李四 | 32 | 上海 | 后端工程师 |
| 王五 | 25 | 深圳 | 全栈工程师 |

### 对齐方式
| 左对齐 | 居中对齐 | 右对齐 |
|:-------|:-------:|-------:|
| Apple | Banana | Cherry |
| Dog | Elephant | Fox |
| Green | Blue | Red |

---

## 八、数学公式

### 行内公式
质能方程：$E = mc^2$

勾股定理：$a^2 + b^2 = c^2$

### 块级公式
$$
\\frac{d}{dx}\\left( \\int_{a}^{x} f(t)\\,dt \\right) = f(x)
$$

$$
\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}
$$

$$
\\begin{bmatrix}
1 & 2 & 3 \\\\
4 & 5 & 6 \\\\
7 & 8 & 9
\\end{bmatrix}
$$

---

## 九、Mermaid 图表

### 流程图
\`\`\`mermaid
graph TD
    A[开始] --> B{是否登录?}
    B -->|是| C[进入主页]
    B -->|否| D[跳转登录页]
    D --> E[输入账号密码]
    E --> F{验证通过?}
    F -->|是| C
    F -->|否| G[显示错误提示]
    G --> E
\`\`\`

### 时序图
\`\`\`mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant B as 后端
    participant D as 数据库

    U->>F: 点击登录按钮
    F->>B: POST /api/login
    B->>D: 查询用户信息
    D-->>B: 返回用户数据
    B-->>F: 返回 JWT Token
    F-->>U: 跳转到主页
\`\`\`

---

## 十、HTML 元素

<div style="padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white; text-align: center;">
  <strong>这是一个自定义 HTML 区块</strong>
  <p style="margin: 8px 0 0; opacity: 0.9;">支持内嵌 HTML 样式</p>
</div>

<br>

<details>
<summary>点击展开更多内容</summary>

这里是折叠的详细内容，支持 Markdown 语法。

- 隐藏的列表项 A
- 隐藏的列表项 B

</details>

---

## 十一、Emoji 与特殊字符

:smile: :rocket: :star: :fire: :heart: :zap: :bulb: :book: :computer: :art:

© 2025 MarkFlowy Team &trade; &reg; &para; &sect;

---

## 十二、分隔线

上面是分隔线 ↑

---

中间是分隔线

---

下面是分隔线 ↓

> **提示**：以上涵盖了 MarkFlowy 编辑器支持的全部 Markdown 格式。你可以在调试面板中切换不同的内容模板来测试各种场景。
`.trim()

const longContent = defaultContent + '\n\n' + (singleRow.repeat(200) + '\n\n').repeat(5)

const tableContent = `
# 表格与复杂排版测试

## 产品对比表
| 特性 | MarkFlowy | Typora | Notion | Obsidian |
|------|:---------:|:------:|:------:|:--------:|
| WYSIWYG | ✅ | ✅ | ✅ | ❌ |
| 开源 | ✅ | ❌ | ❌ | ❌ |
| AI 集成 | ✅ | ❌ | ✅ | ❌ |
| 本地优先 | ✅ | ✅ | ❌ | ✅ |
| 插件系统 | 🚧 | ❌ | ❌ | ✅ |

## 性能指标
| 指标 | 数值 | 单位 |
|-----:|:----:|:-----|
| 启动时间 | 1.2 | 秒 |
| 内存占用 | 85 | MB |
| 渲染帧率 | 60 | FPS |
| 文档大小 | 10 | MB |

## 混合内容
- 列表项中包含 **粗体** 和 *斜体*
- 另一个列表项带有 \`行内代码\`

> 引用块中包含表格：
> | 列 A | 列 B |
> |------|------|
> | 值 1 | 值 2 |

1. 有序列表第一项
2. 有序列表第二项
   - 嵌套无序列表
   - 另一个嵌套项
`.trim()

const htmlContent = `
# HTML 混合内容测试

## 内联 HTML
这是普通文字，<mark>这是用 mark 标签高亮的文字</mark>，继续普通文字。

这是 <u>下划线文字</u> 和 <span style="color: #6366f1;">紫色文字</span>。

## 块级 HTML
<div style="padding: 12px; background: var(--bg-tertiary); border-left: 3px solid #6366f1; border-radius: 4px;">
  <strong>📌 自定义提示框</strong>
  <p>这个区块使用 HTML 实现自定义样式。</p>
</div>

## 图片
<img src="https://www.gstatic.com/images/branding/googlelogo/svg/googlelogo_clr_74x24px.svg" alt="Google Logo" />

## 折叠内容
<details>
<summary>点击查看详情</summary>

这里是折叠的内容，可以包含任意 Markdown。

- 项目 A
- 项目 B

</details>
`.trim()
import testMdContent from './test-md/default.md'
import mathContent from './test-md/math.md'
import readmeContent from './test-md/readme.md'


export const contentMap: { [key: string]: string } = {
  default: defaultContent,
  'just-code': justCodeContent,
  long: longContent,
  table: tableContent,
  html: htmlContent,
  'test-md-default': testMdContent.raw,
  'test-md-readme': readmeContent.raw,
  'test-md-math': mathContent.raw,
}
