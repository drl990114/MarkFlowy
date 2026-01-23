import dynamic from 'next/dynamic'
import { useState } from 'react'
import styled from 'styled-components'
import rem from 'utils/rem'
import { navbarHeight } from 'utils/sizes'

const Editor = dynamic(() => import('./Editor'), {
  ssr: false,
  loading: () => <span>Loading Editor...</span>,
})

const PlaygroundContainer = styled.div`
  margin-top: ${rem(navbarHeight)};
  background-color: ${(props) => props.theme.bgColor};
  color: ${(props) => props.theme.primaryFontColor};
  font-family: ${(props) => props.theme.fontFamily};
`

const PlaygroundContent = () => {
  const [viewType, setViewType] = useState<string>('wysiwyg')

  const initialContent = `# Welcome to Markflowy Playground

This is a **playground** page where you can experiment with the RME editor.

## Features

- ✨ **Real-time editing**
- 🎨 **Syntax highlighting**
- 📝 **Markdown support**
- 🔧 **Customizable**

## Try it out

Start typing below to see the editor in action!

\`\`\`javascript
function hello() {
  console.log("Hello, Markflowy!");
}
\`\`\`

> This is a blockquote example.

- List item 1
- List item 2
- List item 3

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |

## Next Steps

This playground demonstrates the full RME editor functionality with:

1. **WYSIWYG Mode**: Visual editing with real-time preview
2. **Source Code Mode**: Direct markdown editing
3. **Real-time Updates**: See changes as you type
4. **Theme Integration**: Consistent with the site's design

Enjoy experimenting with the editor!
`
  return (
    <PlaygroundContainer>
      <Editor initialContent={initialContent} viewType={viewType} />
    </PlaygroundContainer>
  )
}

export default PlaygroundContent
