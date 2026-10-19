// Builds the layered SVG backdrop (sky, sun, parallax clouds / mountains / hills).
import { ART } from './assets.js';
export const VW = 1280, VH = 720;

const g = (art, x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${art}</g>`;

export function buildBackdrop(svg) {
  const clouds = [[140, 120, 1.0], [520, 90, 0.7], [900, 150, 1.2], [1350, 100, 0.8], [1650, 170, 1.0]];
  const mountains = [[120, 560, 1.15], [520, 580, 0.85], [900, 550, 1.35], [1300, 575, 1.0], [1620, 585, 0.8]];
  const hillPath = 'M0 720 L0 600 Q220 520 450 590 T900 570 T1350 590 T1800 560 L1800 720Z';
  const trees = [60, 210, 380, 520, 690, 830, 980, 1130, 1290, 1450, 1600, 1740]
    .map((x, i) => g(ART.tree, x, 585 + ((i * 17) % 40), 1.1 + (i % 3) * 0.25)).join('');

  const strip = (items) => items + `<g transform="translate(1800 0)">${items}</g>`;
  svg.innerHTML = `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1f9fe6"/><stop offset="1" stop-color="#63e3f2"/>
      </linearGradient>
      <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8bc21f"/><stop offset="1" stop-color="#5f9a16"/>
      </linearGradient>
    </defs>
    <rect width="${VW}" height="${VH}" fill="url(#sky)"/>
    <g transform="translate(1160 100)">${ART.sun}</g>
    <g id="L-clouds">${strip(clouds.map(([x, y, s]) => g(ART.cloud, x, y, s)).join(''))}</g>
    <g id="L-mount">${strip(mountains.map(([x, y, s]) => g(ART.mountain, x, y, s)).join(''))}</g>
    <g id="L-hills">${strip(`<path d="${hillPath}" fill="#1c4a36"/>${trees}`)}</g>
    <g id="world"><g id="terrain"></g><g id="dyn"></g></g>`;
  const layers = [
    { el: svg.querySelector('#L-clouds'), f: 0.1, fy: 0.03 },
    { el: svg.querySelector('#L-mount'), f: 0.22, fy: 0.05 },
    { el: svg.querySelector('#L-hills'), f: 0.4, fy: 0.08 },
  ];
  return {
    world: svg.querySelector('#world'), terrain: svg.querySelector('#terrain'), dyn: svg.querySelector('#dyn'),
    parallax(cx, cy) {
      for (const l of layers) l.el.setAttribute('transform', `translate(${-((cx * l.f) % 1800)} ${-cy * l.fy + 20})`);
    },
  };
}
