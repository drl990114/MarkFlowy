/** Run before hydration so neither the browser nor Next follows a stale homepage hash. */
export const homeScrollResetScript = `
(() => {
  const navigation = performance.getEntriesByType('navigation')[0];
  if (navigation?.type !== 'reload') return;

  const restoration = history.scrollRestoration;
  history.scrollRestoration = 'manual';
  if (location.hash) {
    history.replaceState(history.state, '', location.pathname + location.search);
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

  // Keep restoration disabled through pageshow, then return control to the browser
  // for subsequent back/forward navigation. Do not scroll again after user input.
  window.addEventListener('pageshow', () => {
    requestAnimationFrame(() => {
      history.scrollRestoration = restoration;
    });
  }, { once: true });
})();
`
