import type MarkdownIt from 'markdown-it';
import { normalizeReference } from 'markdown-it/lib/common/utils.mjs';

const imageRefRegex = /^!\[([^\]]*)\]\[([^\]]+)\]/g;

function inlineReference(state: any, silent: boolean) {
  const pos = state.pos;
  const srcFromPos = state.src.slice(pos);

  const match = imageRefRegex.exec(srcFromPos);
  if (!match) {
    return false;
  }

  const alt = match[1] || '';
  const label = (match[2] || '').trim();

  const defs = state.env && state.env.rmeReferences;

  const normalizeLabel = normalizeReference(label);
  const def = defs && defs[normalizeLabel];
  if (!def) {
    return false;
  }

  if (!silent) {
    const token = state.push('md_image', '', 0);

    token.attrs = {
      src: '',
      alt: alt,
      'data-refer-label': label
    };

    token.tag = 'img'
  }

  state.pos = pos + match[0].length;
  return true;
}

export default function MarkdownItReferenceImage(md: MarkdownIt) {
  md.inline.ruler.push('reference_image', inlineReference);
}
