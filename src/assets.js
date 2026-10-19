// Loads the SVG files as raw text and strips the outer <svg> wrapper so the
// artwork can be dropped into <g> groups and moved/rotated by the physics loop.
import carRaw from './assets/car-body.svg?raw';
import wheelRaw from './assets/wheel.svg?raw';
import crateRaw from './assets/crate.svg?raw';
import cloudRaw from './assets/cloud.svg?raw';
import mountainRaw from './assets/mountain.svg?raw';
import sunRaw from './assets/sun.svg?raw';
import treeRaw from './assets/tree.svg?raw';

const inner = (s) =>
  s.replace(/^[\s\S]*?<svg[^>]*>/, '')
   .replace(/<\/svg>\s*$/, '');
export const ART = {
  car: inner(carRaw), wheel: inner(wheelRaw), crate: inner(crateRaw),
  cloud: inner(cloudRaw), mountain: inner(mountainRaw), sun: inner(sunRaw), tree: inner(treeRaw),
};
