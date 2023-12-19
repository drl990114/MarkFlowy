const singleRow = `hello **strong**! hello *italic*! hello \`code\`! hello [link](https://www.google.com)!`

const justCodeContent = `
\`\`\`js

console.log("hello world")

\`\`\`
`.trim()

const defaultContent = [
    `
hello world! <a href="https://www.baidu.com">baidu</a>

<h1>html node</h1>

paragraph,<img src="https://remixicon.com/img/logo/dark/text.svg"> img inline<iframe src="https://www.youtube.com/embed/sSECWu-xGnE" title="50 Best of Chopin: Nocturnes, Études, Waltzes..." frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ></iframe>

<iframe width="937" height="527" src="https://www.youtube.com/embed/sSECWu-xGnE" title="50 Best of Chopin: Nocturnes, Études, Waltzes..." frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" />

`.trim(),
].join("\n")

const longContent = defaultContent + "\n\n" + (singleRow.repeat(200) + "\n\n").repeat(5)

const tableContent = `
# Table

| First Header  | Second Header |
| ------------- | ------------- |
| Content Cell  | Content Cell  |
| Content Cell  | Content Cell  |

# A larger table

| First Header  | Second Header | Third Header |
| ------------- | ------------- | ------------ |
| Content Cell  | Content Cell  | Content Cell |
| Content Cell  | Content Cell  | Content Cell |
| Content Cell  | Content Cell  | Content Cell |
| Content Cell  | Content Cell  | Content Cell |

`

const headingContent = `
# Heading Level 1

## Heading Level 2

### Heading Level 3

#### Heading Level 4

##### Heading Level 5

###### Heading Level 6
`

export const contentMap: { [key: string]: string } = {
    default: defaultContent,
    "just-code": justCodeContent,
    long: longContent,
    table: tableContent,
    heading: headingContent,
    customize: "",
}
