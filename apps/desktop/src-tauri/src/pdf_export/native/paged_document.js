// Trusted code evaluated only in the inert export WebView, after Paged.js has
// produced fixed physical pages. No print-engine link annotations are required.
(includeOutline, expectedWidth, expectedHeight, metadataKey, readyTitle) => {
  const roots = document.querySelectorAll('.mf-pdf-pages');
  if (roots.length !== 1) throw new Error('Expected one prepared page container.');
  const root = roots[0];
  const pages = Array.from(root.querySelectorAll('[data-mf-pdf-page]'));
  if (!pages.length || pages.length > 10000 ||
      document.querySelectorAll('[data-mf-pdf-page]').length !== pages.length) {
    throw new Error('Invalid prepared page count.');
  }
  const boxes = pages.map((page, index) => {
    if (page.parentElement.closest('[data-mf-pdf-page]')) throw new Error('Nested physical pages.');
    const box = page.getBoundingClientRect();
    if (![box.left, box.top, box.width, box.height].every(Number.isFinite) ||
        Math.abs(box.width - expectedWidth) > 1 || Math.abs(box.height - expectedHeight) > 1) {
      throw new Error('Prepared page dimensions changed.');
    }
    if (index && (Math.abs(box.left - pages[0].getBoundingClientRect().left) > 1 ||
        Math.abs(box.top - pages[index - 1].getBoundingClientRect().bottom) > 1)) {
      throw new Error('Prepared physical pages must form one continuous column.');
    }
    return box;
  });
  const rootBox = root.getBoundingClientRect();
  if (Math.abs(rootBox.left - boxes[0].left) > 1 ||
      Math.abs(rootBox.top - boxes[0].top) > 1 ||
      Math.abs(rootBox.width - expectedWidth) > 1 ||
      Math.abs(rootBox.bottom - boxes[boxes.length - 1].bottom) > 1) {
    throw new Error('Prepared pages have unexpected outer layout.');
  }
  const pageIndices = new Map(pages.map((page, index) => [page, index]));
  const headings = [];
  const links = [];
  const publish = () => {
    const prepared = { pageCount: pages.length, headings, links };
    if (metadataKey !== undefined) {
      // Native title notifications are length-limited (WK truncates at 1000).
      // Keep the payload in this inert document and signal only a short token.
      if (typeof metadataKey !== 'string' || typeof readyTitle !== 'string' || readyTitle.length > 128) {
        throw new Error('Invalid native readiness channel.');
      }
      Object.defineProperty(globalThis, metadataKey, {
        value: { title: Array.from(document.title).slice(0, 4096).join(''), ...prepared },
        configurable: true,
      });
      document.title = readyTitle;
    }
    return prepared;
  };
  const hidden = (element) => {
    if (element.hasAttribute('hidden') || element.hasAttribute('inert') ||
        element.getAttribute('aria-hidden')?.trim().toLowerCase() === 'true') return true;
    const style = getComputedStyle(element);
    return style.display === 'none' || style.visibility === 'hidden' ||
      style.visibility === 'collapse' || Number(style.opacity) === 0;
  };

  const styles = new Map();
  const styleOf = (element) => {
    if (!styles.has(element)) styles.set(element, getComputedStyle(element));
    return styles.get(element);
  };
  const clickable = (element) => {
    const visibility = styleOf(element).visibility;
    if (visibility === 'hidden' || visibility === 'collapse') return false;
    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
      const style = styleOf(ancestor);
      if (ancestor.hasAttribute('hidden') || ancestor.hasAttribute('inert') ||
          ancestor.getAttribute('aria-hidden')?.trim().toLowerCase() === 'true' ||
          style.display === 'none' || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  const finiteRect = (rect) => [rect.left, rect.top, rect.right, rect.bottom, rect.width, rect.height]
    .every(Number.isFinite) && rect.width >= 0 && rect.height >= 0;
  const pointOf = (element) => {
    // Named/heading aliases may be empty or aria-hidden and still have a real
    // scroll position. Targets need layout, unlike positive-area click sources.
    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
      if (styleOf(ancestor).display === 'none') return undefined;
    }
    const pageIndex = pageIndices.get(element.closest('[data-mf-pdf-page]'));
    if (pageIndex === undefined) return undefined;
    const pageBox = boxes[pageIndex];
    const rects = Array.from(element.getClientRects());
    if (!rects.length) rects.push(element.getBoundingClientRect());
    const rect = rects.find((rect) => finiteRect(rect) &&
      rect.right >= pageBox.left && rect.bottom >= pageBox.top &&
      rect.left <= pageBox.right && rect.top <= pageBox.bottom);
    if (!rect) return undefined;
    return {
      targetPageIndex: pageIndex,
      targetLeft: Math.max(0, Math.min(1, (rect.left - pageBox.left) / pageBox.width)),
      targetTop: Math.max(0, Math.min(1, (rect.top - pageBox.top) / pageBox.height)),
    };
  };
  const ids = new Map(), dataIds = new Map(), names = new Map(), refs = new Map();
  const add = (map, key, element) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(element);
  };
  for (const element of root.querySelectorAll('[id],[data-id],a[name]')) {
    add(ids, element.getAttribute('id'), element);
    add(dataIds, element.getAttribute('data-id'), element);
    if (element.tagName === 'A') add(names, element.getAttribute('name'), element);
    add(refs, element.getAttribute('data-ref'), element);
  }
  const targetCache = new Map();
  const resolveTarget = (fragment) => {
    if (targetCache.has(fragment)) return targetCache.get(fragment);
    let target;
    if (!fragment) target = { targetPageIndex: 0, targetLeft: 0, targetTop: 0 };
    else {
      const direct = ids.get(fragment) || [];
      // Paged's generated page-N IDs must not mask an authored anchor that it
      // retained only as data-id on a continued fragment.
      const authored = direct.filter((element) => !element.matches('.pagedjs_page[data-mf-pdf-page]'));
      const matches = authored.length ? authored : dataIds.get(fragment) || (direct.length ? direct : names.get(fragment)) || [];
      if (matches.length) {
        const first = matches[0];
        const ref = first.getAttribute('data-ref');
        // Only continuations of the first logical target may replace it. A
        // hidden first ID must not accidentally jump to an unrelated duplicate.
        for (const candidate of ref ? refs.get(ref) || [first] : [first]) {
          target = pointOf(candidate);
          if (target) break;
        }
      } else if (fragment.toLowerCase() === 'top') {
        target = { targetPageIndex: 0, targetLeft: 0, targetTop: 0 };
      }
    }
    targetCache.set(fragment, target);
    return target;
  };
  const currentUrl = new URL(document.URL);
  currentUrl.hash = '';
  const fragmentOf = (href) => {
    if (href.startsWith('#')) return href.slice(1);
    if (!href.includes('#')) return undefined;
    try {
      const url = new URL(href, document.URL);
      const fragment = url.hash.slice(1);
      url.hash = '';
      return url.href === currentUrl.href ? fragment : undefined;
    } catch { return undefined; }
  };
  const sourceBoxes = (anchor) => {
    const own = Array.from(anchor.getClientRects()).filter((rect) => finiteRect(rect) && rect.width > 0 && rect.height > 0);
    if (own.length) return own.map((rect) => ({ rect, element: anchor }));
    // display:contents and anchors around block content can have no own box.
    // Keep visible text fragments (including wrapped lines) and replaced
    // content; selecting all contents at once would include hidden children.
    const result = [];
    const visit = (node) => {
      if (node.nodeType === 3) {
        const element = node.parentElement;
        if (!node.textContent?.trim() || !element || !clickable(element)) return;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) result.push({ rect, element });
        return;
      }
      if (node.nodeType !== 1 || !clickable(node)) return;
      if (['img', 'svg', 'canvas', 'video', 'audio', 'iframe', 'object', 'embed', 'input'].includes(node.tagName.toLowerCase())) {
        for (const rect of node.getClientRects()) result.push({ rect, element: node });
        return;
      }
      for (const child of node.childNodes) visit(child);
    };
    for (const child of anchor.childNodes) visit(child);
    return result;
  };
  const sourceRects = new Set();
  let anchorCount = 0;
  for (const anchor of root.querySelectorAll('a')) {
    const href = anchor.getAttribute('href') ?? anchor.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
    if (href === null) continue;
    const fragment = fragmentOf(href.trim());
    if (fragment === undefined) continue;
    if (++anchorCount > 20000) throw new Error('Too many internal PDF links.');
    let decoded;
    try { decoded = decodeURIComponent(fragment); } catch { continue; }
    const target = resolveTarget(decoded);
    if (!target || !clickable(anchor)) continue;
    const page = anchor.closest('[data-mf-pdf-page]');
    const pageIndex = pageIndices.get(page);
    if (pageIndex === undefined) continue;
    const pageBox = boxes[pageIndex];
    for (const { rect, element } of sourceBoxes(anchor)) {
      if (!finiteRect(rect) || rect.width <= 0 || rect.height <= 0) continue;
      let left = Math.max(rect.left, pageBox.left), top = Math.max(rect.top, pageBox.top);
      let right = Math.min(rect.right, pageBox.right), bottom = Math.min(rect.bottom, pageBox.bottom);
      for (let ancestor = element; ancestor && ancestor !== page; ancestor = ancestor.parentElement) {
        const style = styleOf(ancestor);
        const clipX = /^(hidden|clip|auto|scroll)$/.test(style.overflowX || style.overflow);
        const clipY = /^(hidden|clip|auto|scroll)$/.test(style.overflowY || style.overflow);
        if (!clipX && !clipY) continue;
        const bounds = ancestor.getBoundingClientRect();
        if (clipX) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
        if (clipY) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
      }
      if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) continue;
      const item = { pageIndex,
        left: (left - pageBox.left) / pageBox.width, top: (top - pageBox.top) / pageBox.height,
        right: (right - pageBox.left) / pageBox.width, bottom: (bottom - pageBox.top) / pageBox.height,
        ...target };
      const key = JSON.stringify(item);
      if (sourceRects.has(key)) continue;
      sourceRects.add(key);
      if (links.length >= 20000) throw new Error('Too many internal PDF link rectangles.');
      links.push(item);
    }
  }
  if (!includeOutline) return publish();

  // Explicit accessible labels take precedence over native text alternatives.
  // Referenced nodes may be hidden and a heading may reference itself.
  const nameOf = (node, seen = new Set(), referenced = false, isRoot = false) => {
    if (node.nodeType === 3) return node.textContent || '';
    if (node.nodeType !== 1 || seen.has(node)) return '';
    seen.add(node);
    if (!referenced && !isRoot && hidden(node)) return '';
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

  let totalTitleLength = 0;
  const logicalHeadings = new Map();
  for (const heading of root.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')) {
    const role = heading.getAttribute('role')?.trim().toLowerCase();
    if (role && role !== 'heading') continue;
    const explicitLevel = heading.getAttribute('aria-level');
    if (explicitLevel !== null && !/^[1-6]$/.test(explicitLevel.trim())) continue;
    const headingStyle = getComputedStyle(heading);
    if (headingStyle.visibility === 'hidden' || headingStyle.visibility === 'collapse') continue;
    let excluded = false;
    for (let ancestor = heading; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (ancestor.hasAttribute('hidden') || ancestor.hasAttribute('inert') ||
          ancestor.getAttribute('aria-hidden')?.trim().toLowerCase() === 'true' ||
          style.display === 'none' || Number(style.opacity) === 0) {
        excluded = true;
        break;
      }
    }
    if (excluded) continue;
    const page = heading.closest('[data-mf-pdf-page]');
    const pageIndex = pageIndices.get(page);
    if (pageIndex === undefined) throw new Error('A heading is outside the prepared pages.');
    const pageBox = boxes[pageIndex];
    // Use the first visible fragment. Paged.js has already assigned it to a
    // physical page, and CSS visibility is measured in this final page DOM.
    const box = Array.from(heading.getClientRects()).find((box) => box.width > 0 && box.height > 0 &&
      box.right > pageBox.left && box.bottom > pageBox.top &&
      box.left < pageBox.right && box.top < pageBox.bottom);
    if (!box) continue;
    const title = nameOf(heading, new Set(), false, true).replace(/\s+/g, ' ').trim();
    const explicitLabel = Boolean(heading.getAttribute('aria-label')?.trim() ||
      heading.getAttribute('aria-labelledby')?.trim().split(/\s+/).some((id) => document.getElementById(id)));
    if (!title) continue;
    const sourceKey = heading.getAttribute('data-ref');
    const previous = sourceKey ? logicalHeadings.get(sourceKey) : undefined;
    if (previous) {
      // Paged repeats table headers and may split one heading across pages.
      // Explicit accessible labels describe the complete source heading.
      // Join only marked split fragments; repeated full table-header clones
      // keep the first label and destination. Never deduplicate by title.
      if (heading.hasAttribute('data-split-from') && !explicitLabel && !previous.explicitLabel) {
        previous.heading.title += ' ' + title;
        totalTitleLength += title.length + 1;
        if (previous.heading.title.length > 4096 || totalTitleLength > 1000000) {
          throw new Error('Too many or oversized PDF headings.');
        }
      }
      continue;
    }
    totalTitleLength += title.length;
    if (headings.length >= 10000 || title.length > 4096 || totalTitleLength > 1000000) {
      throw new Error('Too many or oversized PDF headings.');
    }
    const level = explicitLevel === null ? (/^H[1-6]$/.test(heading.tagName) ? Number(heading.tagName[1]) : 2) : Number(explicitLevel);
    const item = { index: headings.length, title, level, pageIndex,
      left: Math.max(0, Math.min(1, (box.left - pageBox.left) / pageBox.width)),
      top: Math.max(0, Math.min(1, (box.top - pageBox.top) / pageBox.height)) };
    headings.push(item);
    if (sourceKey) logicalHeadings.set(sourceKey, { heading: item, explicitLabel });
  }
  return publish();
}
