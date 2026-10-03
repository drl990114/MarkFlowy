/** Preserve HTML verbatim; JSON IPC already handles string escaping. */
export function exportHtmlDocument(html: string, root: HTMLElement | null, title: string): string {
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (char) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[char]!,
    )
  const styles = Array.from(
    document.head.querySelectorAll('style[data-styled]'),
    (style) => style.innerHTML,
  ).join('\n')
  return `<!DOCTYPE html>
<html lang="${escape(document.documentElement.lang || 'en')}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escape(title)}</title><style>${styles}</style></head>
<body><div class="${escape(root?.className ?? '')}">${html}</div></body></html>`
}
