// Trusted code evaluated only in the inert export WebView. The print engine,
// not screen geometry or text matching, decides which markers reach the PDF.
(token) => {
  const prefix = `https://markflowy.invalid/pdf-outline/${token}/`;
  const attribute = 'data-mf-pdf-outline-marker';
  for (const element of document.querySelectorAll(`[${attribute}]`)) {
    element.removeAttribute(attribute);
  }

  const hidden = (element) => {
    if (element.hasAttribute('hidden') || element.hasAttribute('inert') ||
        element.getAttribute('aria-hidden')?.trim().toLowerCase() === 'true') return true;
    const style = getComputedStyle(element);
    return style.display === 'none' || style.visibility === 'hidden' ||
      style.visibility === 'collapse' || Number(style.opacity) === 0;
  };

  // Respect explicit accessible labels before native text alternatives. This
  // also covers image/SVG-only headings without copying hidden editor controls.
  const nameOf = (node, seen = new Set(), referenced = false, root = false) => {
    if (node.nodeType === 3) return node.textContent || '';
    if (node.nodeType !== 1 || seen.has(node)) return '';
    seen.add(node);
    if (!referenced && !root && hidden(node)) return '';
    // Referenced nodes contribute their own text alternative, not another
    // labelledby traversal. A heading may legitimately reference itself.
    const references = referenced ? undefined : node.getAttribute('aria-labelledby')?.trim().split(/\s+/)
      .map((id) => document.getElementById(id)).filter(Boolean);
    if (references?.length) return Array.from(new Set(references)).map((target) => {
      if (target === node) seen.delete(node);
      return nameOf(target, seen, true);
    }).join(' ');
    const label = node.getAttribute('aria-label')?.trim();
    if (label) return label;
    if (node.tagName === 'IMG') return node.getAttribute('alt') || '';
    if (node.tagName === 'BR') return ' ';
    if (node.tagName.toLowerCase() === 'svg') {
      return Array.from(node.children).find((child) => child.tagName.toLowerCase() === 'title')?.textContent || '';
    }
    if (['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT'].includes(node.tagName)) return '';
    return Array.from(node.childNodes).map((child) => nameOf(child, seen, referenced)).join('');
  };

  const addMarker = (parent, key) => {
    const marker = document.createElement('a');
    marker.href = prefix + key;
    marker.setAttribute(attribute, '');
    marker.setAttribute('aria-hidden', 'true');
    marker.tabIndex = -1;
    // An empty visible box creates a PDF Link annotation without drawing any
    // glyph/pixel or consuming line space. Keep the heading's visibility so a
    // hidden heading cannot acquire a visible link solely through its marker.
    marker.style.cssText = 'all:initial!important;position:absolute!important;display:block!important;left:auto!important;top:auto!important;width:2px!important;height:2px!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;background:none!important;opacity:1!important;visibility:inherit!important;transform:none!important;clip:auto!important;clip-path:none!important;overflow:visible!important;';
    parent.prepend(marker);
  };

  const headings = [];
  let totalTitleLength = 0;
  for (const heading of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    const role = heading.getAttribute('role')?.trim().toLowerCase();
    if (role && role !== 'heading') continue;
    const explicitLevel = heading.getAttribute('aria-level');
    if (explicitLevel !== null && !/^[1-6]$/.test(explicitLevel.trim())) continue;
    // Attribute-based exclusions are semantic. CSS visibility is determined
    // by the printed annotations so @media print-only headings can participate.
    let excluded = false;
    for (let ancestor = heading; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.hasAttribute('hidden') || ancestor.hasAttribute('inert') ||
          ancestor.getAttribute('aria-hidden')?.trim().toLowerCase() === 'true') {
        excluded = true;
        break;
      }
    }
    if (excluded) continue;
    // A screen-hidden heading may be visible in print. While reading its name,
    // undo only inherited visibility; explicitly hidden descendants stay hidden.
    const visibility = heading.style.getPropertyValue('visibility');
    const visibilityPriority = heading.style.getPropertyPriority('visibility');
    let title;
    try {
      heading.style.setProperty('visibility', 'visible', 'important');
      title = nameOf(heading, new Set(), false, true).replace(/\s+/g, ' ').trim();
    } finally {
      if (visibility) heading.style.setProperty('visibility', visibility, visibilityPriority);
      else heading.style.removeProperty('visibility');
    }
    if (!title) continue;
    totalTitleLength += title.length;
    if (headings.length >= 10000 || title.length > 4096 || totalTitleLength > 1000000) throw new Error('Too many or oversized PDF headings.');
    const index = headings.length;
    headings.push({ index, title, level: explicitLevel === null ? Number(heading.tagName[1]) : Number(explicitLevel) });
    addMarker(heading, String(index));
  }

  const style = document.createElement('style');
  style.textContent = `[${attribute}]::before,[${attribute}]::after{content:none!important;display:none!important}`;
  document.head.append(style);
  // Even a document with no printed headings must prove that its renderer
  // preserved link positions; otherwise silently returning zero is misleading.
  addMarker(document.body, 'probe');
  return headings;
}
