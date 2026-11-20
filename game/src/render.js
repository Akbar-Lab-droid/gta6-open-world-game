// Drawing only: the world's state and the current screen in, pixels out. The canvas is a
// fixed 1280 by 720 window onto the city; the camera follows the player. Flat shapes and
// canvas text for the HUD, the minimap and the panels — no image assets at all.

import { BEACH_Y, COLORS, DOCKS, ROADS_H, ROADS_V, ROAD_W, VIEW, WATER_Y, WORLD } from './config.js';
import { missionObjective } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const MINIMAP = { x: VIEW.width - 216, y: 12, w: 204, h: 146 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -19, -9, 40, 20, 6);
  ctx.fill();
  ctx.translate(-1, -1);
  // Body.
  ctx.fillStyle = car.disabled ? '#555555' : car.color;
  roundRect(ctx, -20, -10, 40, 20, 6);
  ctx.fill();
  // Roof and windshield.
  ctx.fillStyle = car.disabled ? '#444444' : '#222c38';
  roundRect(ctx, -6, -8, 14, 16, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.7)';
  ctx.fillRect(-2, -8, 3, 16);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(18, -8, 3, 4);
  ctx.fillRect(18, 4, 3, 4);
  // Police light bar, flashing.
  if (car.kind === 'police' && !car.disabled) {
    const phase = Math.floor(time * 4) % 2;
    ctx.fillStyle = phase === 0 ? '#ff2d2d' : '#2d7dff';
    ctx.fillRect(-4, -9, 4, 4);
    ctx.fillStyle = phase === 0 ? '#2d7dff' : '#ff2d2d';
    ctx.fillRect(-4, 5, 4, 4);
    ctx.fillStyle = '#101418';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 8, 3);
  }
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 8, 3);
  }
  ctx.restore();
  if (car.disabled && car.smoke < 1) {
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    ctx.beginPath();
    ctx.arc(car.x - 10, car.y - 6, 8 + Math.sin(time * 3) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPedShape(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'down') {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWorld(ctx, state) {
  const cam = state.camera;
  const x0 = cam.x - VIEW.width / 2;
  const y0 = cam.y - VIEW.height / 2;
  const x1 = x0 + VIEW.width;
  const y1 = y0 + VIEW.height;

  // Ground: grass, then the beach and the sea.
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const sandY = BEACH_Y - y0;
  if (sandY < VIEW.height) {
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(0, Math.max(0, sandY), VIEW.width, VIEW.height - Math.max(0, sandY));
  }
  const waterY = WATER_Y - y0;
  if (waterY < VIEW.height) {
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(0, Math.max(0, waterY), VIEW.width, VIEW.height - Math.max(0, waterY));
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let wy = WATER_Y + 24; wy < WORLD.height; wy += 48) {
      const sy = wy - y0;
      if (sy < 0 || sy > VIEW.height) continue;
      ctx.beginPath();
      for (let wx = 0; wx <= VIEW.width; wx += 32) {
        const wave = Math.sin((wx + state.time * 30) * 0.02 + wy) * 3;
        if (wx === 0) ctx.moveTo(0, sy + wave);
        else ctx.lineTo(wx, sy + wave);
      }
      ctx.stroke();
    }
  }
  // East water (the harbour mouth).
  const eastX = WORLD.width - 40 - x0;
  if (eastX < VIEW.width) {
    ctx.fillStyle = COLORS.waterDeep;
    ctx.fillRect(Math.max(0, eastX), 0, VIEW.width - Math.max(0, eastX), VIEW.height);
  }

  // Block shading: alternate blocks a touch darker, so the grid reads as a city
  // even where a block holds no building.
  for (let vi = 0; vi < ROADS_V.length - 1; vi += 1) {
    for (let hi = 0; hi < ROADS_H.length - 1; hi += 1) {
      if ((vi + hi) % 2 !== 0) continue;
      const bx = ROADS_V[vi] + ROAD_W / 2 - x0;
      const by = ROADS_H[hi] + ROAD_W / 2 - y0;
      const bw = ROADS_V[vi + 1] - ROADS_V[vi] - ROAD_W;
      const bh = ROADS_H[hi + 1] - ROADS_H[hi] - ROAD_W;
      if (bx + bw < 0 || bx > VIEW.width || by + bh < 0 || by > VIEW.height) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(bx, by, bw, bh);
    }
  }

  // Parks.
  for (let i = 0; i < state.city.parks.length; i += 1) {
    const park = state.city.parks[i];
    if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(park.x - x0, park.y - y0, park.w, park.h);
  }

  // Docks concrete.
  ctx.fillStyle = COLORS.dock;
  ctx.fillRect(DOCKS.x0 - x0, DOCKS.y0 - y0, WORLD.width - 40 - DOCKS.x0, DOCKS.y1 - DOCKS.y0);
  for (let i = 0; i < state.city.containers.length; i += 1) {
    const c = state.city.containers[i];
    if (c.x > x1 || c.x + c.w < x0 || c.y > y1 || c.y + c.h < y0) continue;
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x - x0, c.y - y0, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(c.x - x0, c.y - y0, c.w, c.h);
  }

  // Roads.
  ctx.fillStyle = COLORS.road;
  for (let i = 0; i < ROADS_V.length; i += 1) {
    const rx = ROADS_V[i] - ROAD_W / 2 - x0;
    if (rx + ROAD_W < 0 || rx > VIEW.width) continue;
    ctx.fillRect(rx, 0, ROAD_W, VIEW.height);
  }
  for (let i = 0; i < ROADS_H.length; i += 1) {
    const ry = ROADS_H[i] - ROAD_W / 2 - y0;
    if (ry + ROAD_W < 0 || ry > VIEW.height) continue;
    ctx.fillRect(0, ry, VIEW.width, ROAD_W);
  }
  // Lane dashes.
  ctx.fillStyle = COLORS.roadLine;
  for (let i = 0; i < ROADS_V.length; i += 1) {
    const rx = ROADS_V[i] - x0;
    if (rx < 0 || rx > VIEW.width) continue;
    for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) {
      ctx.fillRect(rx - 2, y - y0, 4, 22);
    }
  }
  for (let i = 0; i < ROADS_H.length; i += 1) {
    const ry = ROADS_H[i] - y0;
    if (ry < 0 || ry > VIEW.height) continue;
    for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) {
      ctx.fillRect(x - x0, ry - 2, 22, 4);
    }
  }

  // Sidewalk edges around the blocks.
  ctx.strokeStyle = COLORS.sidewalk;
  ctx.lineWidth = 6;
  for (let i = 0; i < ROADS_V.length; i += 1) {
    const rx = ROADS_V[i] - ROAD_W / 2 - x0;
    if (rx < -8 || rx > VIEW.width + 8) continue;
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx, VIEW.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rx + ROAD_W, 0);
    ctx.lineTo(rx + ROAD_W, VIEW.height);
    ctx.stroke();
  }

  // Buildings, with a roof colour, a darker edge and windows.
  for (let i = 0; i < state.city.buildings.length; i += 1) {
    const b = state.city.buildings[i];
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x - x0 + 5, b.y - y0 + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - x0, b.y - y0, b.w, b.h);
    ctx.strokeStyle = COLORS.buildingEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x - x0, b.y - y0, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rows = Math.max(2, Math.floor(b.h / 26));
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        if ((cx * 7 + cy * 3 + i) % 3 === 0) continue;
        ctx.fillRect(b.x - x0 + 8 + cx * ((b.w - 16) / cols), b.y - y0 + 8 + cy * ((b.h - 16) / rows), 9, 7);
      }
    }
  }

  // Landmark labels.
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  const lm = state.city.landmarks;
  const labels = [];
  for (let i = 0; i < state.city.landmarkBuildings.length; i += 1) {
    const b = state.city.landmarkBuildings[i];
    labels.push([b.x, b.y, b.label]);
  }
  labels.push([lm.docksCrate.x, lm.docksCrate.y, 'DOCKS']);
  labels.push([lm.marina.x, lm.marina.y, 'MARINA POINT']);
  for (let i = 0; i < labels.length; i += 1) {
    const [lx, ly, text] = labels[i];
    if (lx < x0 - 100 || lx > x1 + 100 || ly < y0 - 40 || ly > y1 + 40) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const w = ctx.measureText(text).width + 12;
    roundRect(ctx, lx - x0 - 6, ly - y0 - 30, w, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, lx - x0, ly - y0 - 16);
  }

  // Trees.
  for (let i = 0; i < state.city.trees.length; i += 1) {
    const t = state.city.trees[i];
    if (t.x < x0 - 20 || t.x > x1 + 20 || t.y < y0 - 20 || t.y > y1 + 20) continue;
    ctx.fillStyle = COLORS.tree;
    ctx.beginPath();
    ctx.arc(t.x - x0, t.y - y0, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(t.x - x0 - 3, t.y - y0 - 3, t.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mission marker: a pulsing diamond.
  const objective = missionObjective(state);
  if (objective.x !== null && objective.x !== undefined) {
    const mx = objective.x - x0;
    const my = objective.y - y0;
    const pulse = 1 + Math.sin(state.time * 4) * 0.2;
    ctx.save();
    ctx.translate(mx, my);
    ctx.scale(pulse, pulse);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd23a';
    ctx.strokeStyle = '#7a5b00';
    ctx.lineWidth = 3;
    ctx.fillRect(-13, -13, 26, 26);
    ctx.strokeRect(-13, -13, 26, 26);
    ctx.restore();
    ctx.fillStyle = '#7a5b00';
    ctx.beginPath();
    ctx.arc(mx, my, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Skid marks and sparks.
  for (let i = 0; i < state.particles.length; i += 1) {
    const pt = state.particles[i];
    ctx.globalAlpha = Math.max(0, Math.min(1, pt.life * 1.6));
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x - x0, pt.y - y0, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Cars, peds, officers, bullets, player.
  for (let i = 0; i < state.cars.length; i += 1) {
    const car = state.cars[i];
    if (car.x < x0 - 60 || car.x > x1 + 60 || car.y < y0 - 60 || car.y > y1 + 60) continue;
    ctx.save();
    ctx.translate(-x0, -y0);
    drawCarShape(ctx, car, state.time);
    ctx.restore();
  }
  for (let i = 0; i < state.peds.length; i += 1) {
    const ped = state.peds[i];
    if (ped.x < x0 - 30 || ped.x > x1 + 30 || ped.y < y0 - 30 || ped.y > y1 + 30) continue;
    ctx.save();
    ctx.translate(-x0, -y0);
    drawPedShape(ctx, ped);
    ctx.restore();
  }
  for (let i = 0; i < state.officers.length; i += 1) {
    const off = state.officers[i];
    if (off.x < x0 - 30 || off.x > x1 + 30 || off.y < y0 - 30 || off.y > y1 + 30) continue;
    ctx.save();
    ctx.translate(off.x - x0, off.y - y0);
    ctx.rotate(off.angle);
    ctx.fillStyle = '#1c2f4a';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8b25a';
    ctx.beginPath();
    ctx.arc(4, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#ffe9a8';
  for (let i = 0; i < state.bullets.length; i += 1) {
    const b = state.bullets[i];
    ctx.beginPath();
    ctx.arc(b.x - x0, b.y - y0, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const p = state.player;
  ctx.save();
  ctx.translate(p.x - x0, p.y - y0);
  if (!p.onFoot) {
    // The player's car is drawn with the cars; mark it with a white ring.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const blink = p.invuln > 0 && Math.floor(state.time * 10) % 2 === 0;
    if (!blink) {
      ctx.rotate(p.angle);
      ctx.fillStyle = '#19b8a6';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0b5a52';
      ctx.fillRect(8, -3, 12, 6);
      ctx.fillStyle = '#e8c39a';
      ctx.beginPath();
      ctx.arc(3, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Aim line.
    ctx.rotate(p.aim);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(34, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMinimap(ctx, state) {
  const m = MINIMAP;
  const sx = m.w / WORLD.width;
  const sy = m.h / WORLD.height;
  ctx.fillStyle = 'rgba(10,14,20,0.8)';
  roundRect(ctx, m.x - 4, m.y - 4, m.w + 8, m.h + 8, 6);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(m.x, m.y, m.w, m.h);
  ctx.clip();
  ctx.fillStyle = '#5d8a48';
  ctx.fillRect(m.x, m.y, m.w, m.h);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(m.x, m.y + (WATER_Y * sy), m.w, m.h - WATER_Y * sy);
  ctx.strokeStyle = '#3c3f45';
  ctx.lineWidth = 2;
  for (let i = 0; i < ROADS_V.length; i += 1) {
    ctx.beginPath();
    ctx.moveTo(m.x + ROADS_V[i] * sx, m.y);
    ctx.lineTo(m.x + ROADS_V[i] * sx, m.y + m.h);
    ctx.stroke();
  }
  for (let i = 0; i < ROADS_H.length; i += 1) {
    ctx.beginPath();
    ctx.moveTo(m.x, m.y + ROADS_H[i] * sy);
    ctx.lineTo(m.x + m.w, m.y + ROADS_H[i] * sy);
    ctx.stroke();
  }
  const objective = missionObjective(state);
  if (objective.x !== null && objective.x !== undefined) {
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath();
    ctx.arc(m.x + objective.x * sx, m.y + objective.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.mission.fare && !state.mission.fare.passenger) {
    ctx.fillStyle = '#7dff6a';
    ctx.beginPath();
    ctx.arc(m.x + state.mission.fare.pickup.x * sx, m.y + state.mission.fare.pickup.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < state.cars.length; i += 1) {
    const car = state.cars[i];
    if (car.driver !== 'police' || car.disabled) continue;
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(m.x + car.x * sx, m.y + car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const p = state.player;
  ctx.fillStyle = '#ffffff';
  ctx.save();
  ctx.translate(m.x + p.x * sx, m.y + p.y * sy);
  ctx.rotate(p.angle);
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(m.x, m.y, m.w, m.h);
}

function drawHud(ctx, state) {
  const p = state.player;
  // Cash and health, top left.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, 12, 12, 210, 64, 8);
  ctx.fill();
  ctx.fillStyle = '#7dff6a';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${p.cash}`, 24, 38);
  ctx.fillStyle = '#333333';
  roundRect(ctx, 24, 48, 186, 12, 6);
  ctx.fill();
  ctx.fillStyle = p.hp > 40 ? '#7dff6a' : '#ff3b30';
  roundRect(ctx, 24, 48, 186 * Math.max(0, p.hp / 100), 12, 6);
  ctx.fill();

  // Wanted stars, top centre.
  if (p.wanted > 0) {
    ctx.font = '30px sans-serif';
    ctx.textAlign = 'center';
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < p.wanted ? '★' : '☆';
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    const w = ctx.measureText(stars).width + 24;
    roundRect(ctx, VIEW.width / 2 - w / 2, 12, w, 44, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd23a';
    ctx.fillText(stars, VIEW.width / 2, 44);
  }

  // Mission objective banner.
  const objective = missionObjective(state);
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  const ow = Math.min(VIEW.width - 40, ctx.measureText(objective.text).width + 28);
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, VIEW.width / 2 - ow / 2, 64, ow, 32, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd23a';
  ctx.fillText(objective.text, VIEW.width / 2, 85);

  // Vera's message toast, bottom centre.
  if (state.mission.messageTimer > 0 && state.mission.message) {
    ctx.font = '15px sans-serif';
    const tw = Math.min(VIEW.width - 60, ctx.measureText(state.mission.message).width + 28);
    ctx.fillStyle = 'rgba(20,30,48,0.88)';
    roundRect(ctx, VIEW.width / 2 - tw / 2, VIEW.height - 96, tw, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#cfe4ff';
    ctx.fillText(state.mission.message, VIEW.width / 2, VIEW.height - 73);
  }

  drawMinimap(ctx, state);

  // Bottom right: speed or ammo.
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'right';
  if (!p.onFoot && p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    roundRect(ctx, VIEW.width - 150, VIEW.height - 52, 138, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${kmh} km/h`, VIEW.width - 24, VIEW.height - 25);
  } else {
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    roundRect(ctx, VIEW.width - 150, VIEW.height - 52, 138, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    const ammoText = p.reloadTimer > 0 ? 'RELOADING…' : `AMMO ${p.ammo} / 12`;
    ctx.fillText(ammoText, VIEW.width - 24, VIEW.height - 25);
  }

  // Controls hint, bottom left, fades after a while.
  if (state.hintTimer > 0) {
    ctx.globalAlpha = Math.min(1, state.hintTimer / 5);
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    roundRect(ctx, 12, VIEW.height - 52, 430, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#dddddd';
    ctx.fillText('WASD move/drive · E enter car / grab · Click shoot · Space punch · Shift run · M mute', 24, VIEW.height - 27);
    ctx.globalAlpha = 1;
  }
}

function drawPanel(ctx, title, lines, prompt) {
  ctx.fillStyle = 'rgba(8,12,20,0.78)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const panelW = 640;
  const panelH = 150 + lines.length * 30 + 60;
  const px = (VIEW.width - panelW) / 2;
  const py = (VIEW.height - panelH) / 2;
  ctx.fillStyle = '#141c2a';
  roundRect(ctx, px, py, panelW, panelH, 12);
  ctx.fill();
  ctx.strokeStyle = '#ffd23a';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(title, VIEW.width / 2, py + 58);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '16px sans-serif';
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], VIEW.width / 2, py + 104 + i * 30);
  }
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(prompt, VIEW.width / 2, py + panelH - 24);
}

function drawTitle(ctx, state, save) {
  drawWorld(ctx, { ...state, camera: { x: 1800, y: 1300 } });
  ctx.fillStyle = 'rgba(8,12,20,0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SOLMAR HEAT', VIEW.width / 2, 190);
  ctx.fillStyle = '#ffffff';
  ctx.font = '22px sans-serif';
  ctx.fillText('An open-world getaway in the sun-soaked city of Solmar', VIEW.width / 2, 232);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#dddddd';
  const lines = [
    'Danny Cole is back in Solmar with no money and a fixer named Vera Kane.',
    'Steal a car. Run her jobs. Lose the cops. Get paid.',
    '',
    'WASD move / drive · E enter car or grab a package · Click to shoot · Space to punch',
    'Shift sprint · R reload · P pause · M mute',
  ];
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], VIEW.width / 2, 300 + i * 28);
  }
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(save ? 'Press ENTER to continue your game' : 'Press ENTER to start', VIEW.width / 2, 520);
  ctx.fillStyle = '#aaaaaa';
  ctx.font = '14px sans-serif';
  ctx.fillText('Progress saves automatically at every job. Best played with keyboard and mouse.', VIEW.width / 2, 556);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    draw(state, screen, save) {
      ctx.clearRect(0, 0, VIEW.width, VIEW.height);
      if (screen === SCREEN_TITLE) {
        drawTitle(ctx, state, save);
        return;
      }
      drawWorld(ctx, state);
      if (screen === SCREEN_PLAY) {
        drawHud(ctx, state);
      } else if (screen === SCREEN_PAUSED) {
        drawHud(ctx, state);
        drawPanel(ctx, 'PAUSED', ['Take a breath. Solmar waits.'], 'Press P or ENTER to keep playing');
      } else if (screen === SCREEN_BUSTED) {
        drawPanel(ctx, 'BUSTED', ['The Solmar PD caught up with you.', `Fine paid: $150. Cash left: $${state.player.cash}.`], 'Press ENTER to get back out there');
      } else if (screen === SCREEN_WASTED) {
        drawPanel(ctx, 'WASTED', ['Solmar General patched you up.', `Bill paid: $150. Cash left: $${state.player.cash}.`], 'Press ENTER to get back out there');
      }
    },
  };
}
