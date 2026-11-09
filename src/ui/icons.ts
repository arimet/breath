const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

export const icons = {
  back: svg('<path d="M14.5 5.5 8 12l6.5 6.5"/>'),
  settings: svg(
    '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  ),
  pause: svg('<path d="M9 6.5v11M15 6.5v11"/>'),
  play: svg('<path d="M8.5 6.2v11.6L18 12z"/>'),
  stop: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
  minus: svg('<path d="M6.5 12h11"/>'),
  plus: svg('<path d="M12 6.5v11M6.5 12h11"/>'),
}
