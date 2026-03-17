import { useTranslation } from 'next-i18next'

export const useMockFiles = () => {
  const { t } = useTranslation('common')

  const markdownContent = `
##### ${t('mock.intro.title', 'Welcome to MarkFlowy!')}

- [x] 🧠 **${t('mock.intro.ai_label', 'AI-Powered:')}** ${t('mock.intro.ai_desc', 'Built-in translation, summary, and DeepSeek/ChatGPT support.')}
- [x] ⚡ **${t('mock.intro.lightweight_label', 'Lightweight:')}** ${t('mock.intro.lightweight_desc', 'Tauri-based architecture, under 20MB.')}
- [x] ✍️ **${t('mock.intro.modes_label', 'Editing Modes:')}** ${t('mock.intro.modes_desc', 'Switch between WYSIWYG and Source Code.')}
- [x] 📄 **${t('mock.intro.files_label', 'File Support:')}** ${t('mock.intro.files_desc', 'Handles Markdown, JSON, TXT, and more.')}
- [x] 🎨 **${t('mock.intro.themes_label', 'Custom Themes:')}** ${t('mock.intro.themes_desc', 'Design and share your own editor styles.')}
- [x] ⌨️ **${t('mock.intro.hotkeys_label', 'Hotkeys:')}** ${t('mock.intro.hotkeys_desc', 'Fully customizable keyboard shortcuts.')}
- [x] 🖼️ **${t('mock.intro.images_label', 'Smart Images:')}** ${t('mock.intro.images_desc', 'Easy path management or Base64 conversion.')}
- [x] 🔍 **${t('mock.intro.manager_label', 'File Manager:')}** ${t('mock.intro.manager_desc', 'Powerful tree view with global search.')}
- [x] 🌐 **${t('mock.intro.multilingual_label', 'Multilingual:')}** ${t('mock.intro.multilingual_desc', 'Native support for 5+ major languages.')}

${t('mock.intro.footer', 'Enjoy experimenting with the editor!')}
`

  const jsonContent = `{
  "name": "MarkFlowy",
  "version": "beta",
  "features": [
    "WYSIWYG",
    "Source Code",
    "AI Assistant",
    "Custom Themes"
  ],
  "description": "${t('mock.config.description', 'Next-generation professional text editor designed for AI.')}"
}`

  return {
    markdownContent,
    jsonContent
  }
}
