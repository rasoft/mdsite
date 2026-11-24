let tocAutoMode = true; // auto-open/close TOC groups on scroll
let tocHeadings = [];   // [{el, slug, level, tocEl, groupEl, childrenEl}]

let _sidebarTocExpanded = false;
let _tocPinnedEl = null; // heading clicked in the TOC; keep it highlighted until scroll settles
let _tocPinRestTop = null; // scroll position where a short trailing heading came to rest
let _tocPinTimer = 0;
let _tocActiveIdx = -1;

function buildToc() {
  _tocPinnedEl = null;
  _tocPinRestTop = null;
  clearTimeout(_tocPinTimer);
  _tocActiveIdx = -1;
  const container = document.getElementById('tocContainer');
  container.innerHTML = '';
  tocHeadings = [];

  const inRightPanel = rightPanelActive();

  // Toolbar with collapsible "On this page" header
  const toolbar = document.createElement('div');
  toolbar.className = 'toc-toolbar';
  const tocCollapserBtn = inRightPanel
    ? `<button class="toc-panel-collapser" onclick="toggleTocCollapse()" title="Collapse TOC panel"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,18 15,12 9,6"/></svg></button>`
    : '';
  const tocIsExpanded = inRightPanel ? true : _sidebarTocExpanded;
  toolbar.innerHTML = `
    <div class="sidebar-section-label toc-toggle">
      <span class="toc-header-chevron${tocIsExpanded ? '' : ' collapsed'}">&#9660;</span>On this page
    </div>
    <div class="toc-btns">
      <button class="collapse-btn" onclick="tocCollapseAll()" title="Collapse TOC"><svg width="10" height="10" viewBox="0 0 10 10"><polygon points="2,0 8,5 2,10" fill="currentColor"/></svg></button>
      <button class="collapse-btn" onclick="tocExpandAll()" title="Expand TOC"><svg width="10" height="10" viewBox="0 0 10 10"><polygon points="0,2 10,2 5,8" fill="currentColor"/></svg></button>
      ${tocCollapserBtn}
    </div>
  `;
  container.appendChild(toolbar);

  // Content wrapper — preserve expanded state across file switches
  const tocContent = document.createElement('div');
  tocContent.className = 'toc-content' + (tocIsExpanded ? '' : ' collapsed');
  container.appendChild(tocContent);
  if (tocIsExpanded) container.classList.add('toc-expanded');

  // Toggle toc-content on "On this page" label click (disabled in right panel)
  const toggleLabel = toolbar.querySelector('.toc-toggle');
  const headerChevron = toolbar.querySelector('.toc-header-chevron');
  toggleLabel.onclick = () => {
    const inRightPanel = document.getElementById('tocRightPanel')?.contains(container);
    if (inRightPanel) return;
    tocContent.classList.toggle('collapsed');
    headerChevron.classList.toggle('collapsed');
    container.classList.toggle('toc-expanded');
    _sidebarTocExpanded = !_sidebarTocExpanded;
  };

  const headings = document.querySelectorAll('.md h2, .md h3');
  let currentGroup = null;
  let currentChildren = null;
  let currentH2Entry = null;

  const usedSlugs = new Set();
  headings.forEach((h) => {
    const slug = slugifyHeading(h.textContent, usedSlugs);
    h.id = slug;

    if (h.tagName === 'H2') {
      const group = document.createElement('div');
      group.className = 'toc-group';

      const h2Link = document.createElement('a');
      h2Link.className = 'toc-h2 collapsed';
      h2Link.href = '#' + slug;
      h2Link.innerHTML = `<span class="toc-chevron">&#9660;</span><span class="toc-h2-text">${h.textContent}</span>`;

      const children = document.createElement('div');
      children.className = 'toc-children collapsed';

      h2Link.onclick = (e) => {
        e.preventDefault();
        tocScrollTo(h);
      };

      group.appendChild(h2Link);
      group.appendChild(children);
      tocContent.appendChild(group);

      currentGroup = group;
      currentChildren = children;
      currentH2Entry = { el: h, slug, level: 2, tocEl: h2Link, groupEl: group, childrenEl: children };
      tocHeadings.push(currentH2Entry);

    } else if (h.tagName === 'H3') {
      const h3Link = document.createElement('a');
      h3Link.className = 'toc-h3';
      h3Link.textContent = h.textContent;
      h3Link.href = '#' + slug;
      h3Link.onclick = (e) => {
        e.preventDefault();
        tocScrollTo(h);
      };

      if (currentChildren) {
        currentChildren.appendChild(h3Link);
      } else {
        tocContent.appendChild(h3Link);
      }

      tocHeadings.push({ el: h, slug, level: 3, tocEl: h3Link, parentH2: currentH2Entry });
    }
  });

  // Replace chevron with spacer for H2s that have no H3 children (Change 1)
  tocHeadings.forEach(entry => {
    if (entry.level !== 2) return;
    if (!entry.childrenEl || entry.childrenEl.children.length === 0) {
      const chevron = entry.tocEl.querySelector('.toc-chevron');
      if (chevron) {
        const spacer = document.createElement('span');
        spacer.className = 'toc-chevron-spacer';
        chevron.replaceWith(spacer);
      }
    }
  });

  // Empty state: no headings found in right panel mode
  if (tocHeadings.length === 0 && inRightPanel) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'toc-empty-msg';
    emptyMsg.textContent = 'No headings in this file';
    container.appendChild(emptyMsg);
  }

  tocAutoMode = true;
}

function tocActivationOffset() {
  const sample = tocHeadings[0]?.el || document.querySelector('.md h2, .md h3');
  const margin = sample ? parseFloat(getComputedStyle(sample).scrollMarginTop) || 0 : 0;
  // scrollIntoView parks a heading at its scroll-margin. The spy line has to
  // sit slightly past that, or the heading above stays highlighted.
  return margin + 8;
}

function scrollTocItemIntoView(el) {
  const scroller = el.closest('.toc-content');
  if (!scroller) return;
  const elRect = el.getBoundingClientRect();
  const scRect = scroller.getBoundingClientRect();
  if (elRect.top < scRect.top) {
    scroller.scrollTop -= scRect.top - elRect.top;
  } else if (elRect.bottom > scRect.bottom) {
    scroller.scrollTop += elRect.bottom - scRect.bottom;
  }
}

function setTocActive(entry) {
  tocHeadings.forEach(t => t.tocEl.classList.remove('active'));
  if (!entry) {
    _tocActiveIdx = -1;
    return;
  }
  entry.tocEl.classList.add('active');

  if (entry.level === 3 && entry.parentH2) {
    entry.parentH2.tocEl.classList.add('active');
  }

  if (tocAutoMode) {
    const activeH2 = entry.level === 2 ? entry : (entry.parentH2 || null);
    tocHeadings.forEach(t => {
      if (t.level !== 2) return;
      const open = t === activeH2;
      t.tocEl.classList.toggle('collapsed', !open);
      if (t.childrenEl) t.childrenEl.classList.toggle('collapsed', !open);
    });
  }

  const idx = tocHeadings.indexOf(entry);
  if (idx !== _tocActiveIdx) {
    _tocActiveIdx = idx;
    scrollTocItemIntoView(entry.tocEl);
  }
}

function settleTocPin() {
  clearTimeout(_tocPinTimer);
  if (!_tocPinnedEl || !_tocPinnedEl.isConnected) {
    _tocPinnedEl = null;
    _tocPinRestTop = null;
    updateScrollSpy();
    return;
  }
  const offset = tocActivationOffset();
  const top = _tocPinnedEl.getBoundingClientRect().top;
  const maxScroll = Math.max(0, document.body.scrollHeight - document.body.clientHeight);
  const atBottom = document.body.scrollTop >= maxScroll - 2;
  if (top <= offset) {
    _tocPinnedEl = null;
    _tocPinRestTop = null;
    updateScrollSpy();
    return;
  }
  // Short trailing section: the page cannot bring this heading up to the
  // spy line. Leave the click highlight in place until the user scrolls away.
  if (atBottom) {
    _tocPinRestTop = document.body.scrollTop;
    const pinned = tocHeadings.find(t => t.el === _tocPinnedEl);
    if (pinned) setTocActive(pinned);
    return;
  }
  _tocPinTimer = setTimeout(settleTocPin, 200);
}

function tocScrollTo(h) {
  // Expand content section if collapsed
  if (h.classList.contains('collapsed')) {
    h.classList.remove('collapsed');
    const body = h.nextElementSibling;
    if (body && body.classList.contains('section-body')) body.classList.remove('collapsed');
  }
  // Hold this heading as current while the smooth scroll is in flight.
  // Otherwise an in-between section steals the highlight, and the final
  // scroll event often never arrives to put it back.
  _tocPinnedEl = h;
  _tocPinRestTop = null;
  clearTimeout(_tocPinTimer);
  const entry = tocHeadings.find(t => t.el === h);
  if (entry) setTocActive(entry);
  h.scrollIntoView({ behavior: 'smooth', block: 'start' });
  h.classList.add('highlight-flash');
  setTimeout(() => h.classList.remove('highlight-flash'), 1500);
  _tocPinTimer = setTimeout(settleTocPin, 1500);
}

document.body.addEventListener('scrollend', () => {
  if (!_tocPinnedEl) return;
  settleTocPin();
});

function tocCollapseAll() {
  tocAutoMode = true;
  document.querySelectorAll('.toc-h2').forEach(el => el.classList.add('collapsed'));
  document.querySelectorAll('.toc-children').forEach(el => el.classList.add('collapsed'));
  // Re-run scroll spy to open current section
  updateScrollSpy();
}

function tocExpandAll() {
  tocAutoMode = false;
  document.querySelectorAll('.toc-h2').forEach(el => el.classList.remove('collapsed'));
  document.querySelectorAll('.toc-children').forEach(el => el.classList.remove('collapsed'));
}

function updateScrollSpy() {
  if (tocHeadings.length === 0) return;

  if (_tocPinnedEl && _tocPinnedEl.isConnected) {
    const movedAway = _tocPinRestTop !== null
      && Math.abs(document.body.scrollTop - _tocPinRestTop) > 2;
    if (!movedAway) {
      const pinned = tocHeadings.find(t => t.el === _tocPinnedEl);
      if (pinned) {
        setTocActive(pinned);
        return;
      }
    }
    _tocPinnedEl = null;
    _tocPinRestTop = null;
  }

  const offset = tocActivationOffset();

  // Find the current heading: last heading whose top has crossed the spy line.
  let activeIdx = -1;
  for (let i = tocHeadings.length - 1; i >= 0; i--) {
    const rect = tocHeadings[i].el.getBoundingClientRect();
    if (rect.top <= offset) { activeIdx = i; break; }
  }

  if (activeIdx < 0) {
    setTocActive(null);
    return;
  }

  setTocActive(tocHeadings[activeIdx]);
}

