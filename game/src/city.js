// The city of Solmar: one fixed grid of roads and blocks, generated once from a seed.
// Buildings, trees, parks, the beach, the docks and the landmarks all come from here, and
// so do the collision tests the cars, the player and the pedestrians share.

import { BEACH_Y, COLORS, DOCKS, ROADS_H, ROADS_V, ROAD_W, WATER_Y, WORLD } from './config.js';

const PALETTE = COLORS.buildingRoof;

/** A point on a road, for spawning police and traffic. */
export function roadPoint(random) {
  if (random() < 0.5) {
    const y = ROADS_H[Math.floor(random() * ROADS_H.length)];
    return { x: 60 + random() * (WORLD.width - 120), y };
  }
  const x = ROADS_V[Math.floor(random() * ROADS_V.length)];
  return { x, y: 60 + random() * (WORLD.height - 420) };
}

/** A point on a sidewalk beside a road, for spawning pedestrians. */
export function sidewalkPoint(random) {
  const p = roadPoint(random);
  const off = ROAD_W / 2 + 14;
  if (random() < 0.5) p.y += (random() < 0.5 ? off : -off);
  else p.x += (random() < 0.5 ? off : -off);
  p.x = Math.max(20, Math.min(WORLD.width - 20, p.x));
  p.y = Math.max(20, Math.min(BEACH_Y - 20, p.y));
  return p;
}

/** True when the point is in the water (not walkable, not drivable). */
export function isWater(x, y) {
  return y >= WATER_Y || x >= WORLD.width - 40;
}

/** True when the point is on a road surface. */
export function isRoad(x, y) {
  if (y >= BEACH_Y) return false;
  for (let i = 0; i < ROADS_V.length; i += 1) {
    if (Math.abs(x - ROADS_V[i]) <= ROAD_W / 2) return true;
  }
  for (let i = 0; i < ROADS_H.length; i += 1) {
    if (Math.abs(y - ROADS_H[i]) <= ROAD_W / 2) return true;
  }
  return false;
}

/** Push a circle out of every building and the water. Returns the corrected position. */
export function resolveCircle(city, x, y, r) {
  // Water is one big rectangle along the south edge and the east edge.
  if (y + r > WATER_Y) y = WATER_Y - r;
  if (x + r > WORLD.width - 40) x = WORLD.width - 40 - r;
  if (x - r < 0) x = r;
  if (y - r < 0) y = r;
  const solids = city.buildings.concat(city.containers);
  for (let i = 0; i < solids.length; i += 1) {
    const b = solids[i];
    const nearestX = Math.max(b.x, Math.min(x, b.x + b.w));
    const nearestY = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nearestX;
    const dy = y - nearestY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= r * r) continue;
    if (distSq === 0) {
      // Centre inside the building: push out along the smallest overlap.
      const left = x - b.x;
      const right = b.x + b.w - x;
      const top = y - b.y;
      const bottom = b.y + b.h - y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) x = b.x - r;
      else if (min === right) x = b.x + b.w + r;
      else if (min === top) y = b.y - r;
      else y = b.y + b.h + r;
    } else {
      const dist = Math.sqrt(distSq);
      x = nearestX + (dx / dist) * r;
      y = nearestY + (dy / dist) * r;
    }
  }
  return { x, y };
}

/** True when a circle of radius r at (x, y) overlaps any building, container or water. */
export function hitsSolid(city, x, y, r) {
  if (y + r > WATER_Y || x + r > WORLD.width - 40 || x - r < 0 || y - r < 0) return true;
  const solids = city.buildings.concat(city.containers);
  for (let i = 0; i < solids.length; i += 1) {
    const b = solids[i];
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

/** The nearest road centre line to a point, used to snap police spawns onto roads. */
export function nearestRoad(x, y) {
  let best = { x: ROADS_V[0], y, dist: Math.abs(x - ROADS_V[0]) };
  for (let i = 1; i < ROADS_V.length; i += 1) {
    const d = Math.abs(x - ROADS_V[i]);
    if (d < best.dist) best = { x: ROADS_V[i], y, dist: d };
  }
  for (let i = 0; i < ROADS_H.length; i += 1) {
    const d = Math.abs(y - ROADS_H[i]);
    if (d < best.dist) best = { x, y: ROADS_H[i], dist: d };
  }
  return best;
}

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const parks = [];
  const containers = [];

  // Landmark plots, kept clear of generated buildings.
  const reserved = [
    { x: 690, y: 650, w: 170, h: 140 }, // Vera's Garage
    { x: 2140, y: 1020, w: 190, h: 130 }, // Solmar General hospital
    { x: 1420, y: 1740, w: 190, h: 130 }, // Solmar PD headquarters
    { x: 200, y: 1960, w: 200, h: 200 }, // Marina Point
  ];
  const overlapsReserved = (x, y, w, h) => reserved.some(
    (r) => x < r.x + r.w + 40 && x + w + 40 > r.x && y < r.y + r.h + 40 && y + h + 40 > r.y,
  );

  // One or two buildings per block, plus the odd park.
  for (let vi = 0; vi < ROADS_V.length - 1; vi += 1) {
    for (let hi = 0; hi < ROADS_H.length - 1; hi += 1) {
      const x0 = ROADS_V[vi] + ROAD_W / 2 + 14;
      const y0 = ROADS_H[hi] + ROAD_W / 2 + 14;
      const x1 = ROADS_V[vi + 1] - ROAD_W / 2 - 14;
      const y1 = ROADS_H[hi + 1] - ROAD_W / 2 - 14;
      const bw = x1 - x0;
      const bh = y1 - y0;
      if (y0 > BEACH_Y - 100) continue;
      if (random() < 0.08) {
        // A park: grass and a ring of trees, no buildings.
        parks.push({ x: x0, y: y0, w: bw, h: bh });
        const count = 5 + Math.floor(random() * 5);
        for (let t = 0; t < count; t += 1) {
          trees.push({ x: x0 + 20 + random() * (bw - 40), y: y0 + 20 + random() * (bh - 40), r: 10 + random() * 8 });
        }
        continue;
      }
      // One or two buildings per block, kept apart: the first in the top half, the
      // second in the bottom half, so they never overlap each other.
      const n = random() < 0.5 ? 1 : 2;
      for (let k = 0; k < n; k += 1) {
        const w = 90 + random() * 110;
        const h = 80 + random() * 90;
        const x = x0 + random() * Math.max(1, bw - w);
        // Top half for the first building, bottom half for the second, so they
        // never overlap each other.
        const y = k === 0
          ? y0 + random() * Math.max(1, bh / 2 - h)
          : y0 + bh / 2 + random() * Math.max(1, bh / 2 - h);
        if (x + w > x1 || y + h > y1) continue;
        if (overlapsReserved(x, y, w, h)) continue;
        buildings.push({
          x, y, w, h,
          color: PALETTE[Math.floor(random() * PALETTE.length)],
          windows: 2 + Math.floor(random() * 4),
        });
      }
    }
  }

  // The docks: containers stacked on concrete at the east edge.
  for (let i = 0; i < 10; i += 1) {
    containers.push({
      x: DOCKS.x0 + 10 + random() * 220,
      y: DOCKS.y0 + 20 + random() * (DOCKS.y1 - DOCKS.y0 - 80),
      w: 60 + random() * 40,
      h: 24 + random() * 10,
      color: COLORS.container[Math.floor(random() * COLORS.container.length)],
    });
  }

  // Parked cars on the streets, in bays beside the roads.
  const parkedSpots = [];
  for (let i = 0; i < 16; i += 1) {
    const p = roadPoint(random);
    const vertical = Math.abs(p.x - ROADS_V[0]) < 200 || random() < 0.5;
    parkedSpots.push({
      x: p.x + (vertical ? 0 : (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 12)),
      y: p.y + (vertical ? (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 12) : 0),
      angle: vertical ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      color: ['#c94f43', '#e8a13a', '#4f7fa8', '#7d8a99', '#5a8a6a', '#a83f5e'][Math.floor(random() * 6)],
      kind: random() < 0.15 ? 'sport' : (random() < 0.2 ? 'van' : 'sedan'),
    });
  }

  // The landmark buildings: Vera's Garage, the hospital and the police HQ, each with
  // its own colour so they read as places, not just more rooftops.
  const landmarkBuildings = [
    { x: 700, y: 660, w: 150, h: 120, color: '#c96a3f', label: "VERA'S GARAGE" },
    { x: 2150, y: 1030, w: 170, h: 110, color: '#e8e4da', label: 'SOLMAR GENERAL' },
    { x: 1430, y: 1750, w: 170, h: 110, color: '#b9c4cc', label: 'SOLMAR PD' },
  ];
  for (let i = 0; i < landmarkBuildings.length; i += 1) {
    const b = landmarkBuildings[i];
    buildings.push({ x: b.x, y: b.y, w: b.w, h: b.h, color: b.color, windows: 3 });
  }

  return {
    buildings,
    trees,
    parks,
    containers,
    parkedSpots,
    landmarkBuildings,
    landmarks: {
      garage: { x: 660, y: 720, label: "Vera's Garage" },
      docksCrate: { x: 3360, y: 620, label: 'Docks Crate' },
      marina: { x: 300, y: 2060, label: 'Marina Point' },
      hospital: { x: 2100, y: 980, label: 'Solmar General' },
      policeHq: { x: 1380, y: 1700, label: 'Solmar PD' },
      start: { x: 680, y: 780 },
    },
  };
}
