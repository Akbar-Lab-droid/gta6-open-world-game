// The moving population of Solmar: traffic cars that keep to the roads, pedestrians on the
// sidewalks, and the police who answer the wanted level. Each update is one fixed step.

import { CAR_KINDS, CAR, PLAYER, ROADS_H, ROADS_V, ROAD_W, WORLD } from './config.js';
import { hitsSolid, isRoad, nearestRoad, resolveCircle, roadPoint, sidewalkPoint } from './city.js';

let nextId = 1;

export function makeCar(x, y, angle, kind, driver) {
  const spec = CAR_KINDS[kind] || CAR_KINDS.sedan;
  return {
    id: nextId,
    x, y,
    angle,
    speed: 0,
    kind,
    color: spec.color,
    maxSpeed: spec.maxSpeed,
    accel: spec.accel,
    driver, // 'traffic' | 'police' | 'player' | null (parked)
    hp: kind === 'police' ? 6 : 999,
    disabled: false,
    smoke: 0,
    // Traffic cars keep a road and a direction; police and the player drive free.
    road: null,
    roadDir: 1,
    stuck: 0,
  };
}

export function makePed(x, y) {
  const colors = ['#e8e8e8', '#f2c230', '#7fa8d8', '#d88a7f', '#9a7fd8', '#7fd8a8'];
  return {
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: 45 + Math.random() * 35,
    color: colors[Math.floor(Math.random() * colors.length)],
    state: 'walk', // 'walk' | 'flee' | 'down'
    stateTimer: 0,
    dirTimer: 1 + Math.random() * 3,
  };
}

export function makeOfficer(x, y) {
  return {
    x, y,
    angle: 0,
    speed: 205,
    bust: 0, // seconds spent touching the player
  };
}

/** Parked cars from the city's bays, plus the traffic already rolling. */
export function spawnCityCars(city, random) {
  const cars = [];
  for (let i = 0; i < city.parkedSpots.length; i += 1) {
    const spot = city.parkedSpots[i];
    cars.push(makeCar(spot.x, spot.y, spot.angle, spot.kind, null));
  }
  for (let i = 0; i < 14; i += 1) {
    const car = spawnTrafficCar(city, random);
    if (car) cars.push(car);
  }
  return cars;
}

export function spawnTrafficCar(city, random) {
  const p = roadPoint(random);
  const vertical = ROADS_V.some((x) => Math.abs(p.x - x) < 4);
  const kind = random() < 0.12 ? 'taxi' : (random() < 0.15 ? 'van' : 'sedan');
  const car = makeCar(p.x, p.y, vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI), kind, 'traffic');
  car.road = vertical ? 'v' : 'h';
  car.roadDir = random() < 0.5 ? 1 : -1;
  car.speed = 110 + random() * 60;
  return car;
}

export function spawnPeds(city, random, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const p = sidewalkPoint(random);
    peds.push(makePed(p.x, p.y));
  }
  return peds;
}

/** One traffic car follows its road, turning at intersections, slowing for the car ahead. */
function stepTrafficCar(state, car, dt) {
  if (car.disabled) return;
  const lane = ROAD_W / 2 - 20;
  if (car.road === 'v') {
    // Lane: drive on the right side of the road.
    const roadX = nearestRoad(car.x, car.y).x;
    const targetX = roadX + (car.roadDir > 0 ? lane : -lane);
    car.x += (targetX - car.x) * Math.min(1, dt * 3);
    car.angle = car.roadDir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    const roadY = nearestRoad(car.x, car.y).y;
    const targetY = roadY + (car.roadDir > 0 ? lane : -lane);
    car.y += (targetY - car.y) * Math.min(1, dt * 3);
    car.angle = car.roadDir > 0 ? 0 : Math.PI;
  }
  // Slow for the car ahead on the same road.
  let ahead = Infinity;
  for (let i = 0; i < state.cars.length; i += 1) {
    const other = state.cars[i];
    if (other === car || other.driver !== 'traffic' || other.road !== car.road) continue;
    const along = car.road === 'v' ? (other.y - car.y) * car.roadDir : (other.x - car.x) * car.roadDir;
    const across = car.road === 'v' ? Math.abs(other.x - car.x) : Math.abs(other.y - car.y);
    if (along > 0 && along < 90 && across < 50 && along < ahead) ahead = along;
  }
  const speed = ahead < 90 ? Math.max(0, (ahead - 45) * 2) : car.speed;
  if (car.road === 'v') car.y += car.roadDir * speed * dt;
  else car.x += car.roadDir * speed * dt;

  // At an intersection, sometimes turn onto the crossing road.
  const nearV = ROADS_V.find((x) => Math.abs(car.x - x) < 14);
  const nearH = ROADS_H.find((y) => Math.abs(car.y - y) < 14);
  if (nearV !== undefined && nearH !== undefined && state.random() < 0.02) {
    if (car.road === 'v' && state.random() < 0.5) {
      car.road = 'h';
      car.roadDir = state.random() < 0.5 ? 1 : -1;
      car.y = nearH;
    } else if (car.road === 'h') {
      car.road = 'v';
      car.roadDir = state.random() < 0.5 ? 1 : -1;
      car.x = nearV;
    }
  }
  // Out of the city: respawn on another road.
  if (car.x < 40 || car.x > WORLD.width - 40 || car.y < 40 || car.y > WORLD.height - 200) {
    const fresh = spawnTrafficCar(state.city, state.random);
    car.x = fresh.x; car.y = fresh.y; car.road = fresh.road; car.roadDir = fresh.roadDir;
    car.speed = fresh.speed; car.kind = fresh.kind; car.color = fresh.color;
    car.maxSpeed = fresh.maxSpeed; car.accel = fresh.accel;
  }
  const fixed = resolveCircle(state.city, car.x, car.y, CAR.radius);
  car.x = fixed.x;
  car.y = fixed.y;
}

export function updateTraffic(state, dt) {
  for (let i = 0; i < state.cars.length; i += 1) {
    const car = state.cars[i];
    if (car.driver === 'traffic') stepTrafficCar(state, car, dt);
  }
}

/** Pedestrians walk the sidewalks and run from gunfire and crashes. A ped stays in the
 * sidewalk band beside its nearest road: off the road surface, and not deep in a block. */
export function updatePeds(state, dt) {
  const p = state.player;
  for (let i = 0; i < state.peds.length; i += 1) {
    const ped = state.peds[i];
    ped.stateTimer -= dt;
    ped.dirTimer -= dt;
    if (ped.state === 'down') {
      if (ped.stateTimer <= 0) {
        ped.state = 'flee';
        ped.stateTimer = 2.5;
      }
      continue;
    }
    const dx = ped.x - p.x;
    const dy = ped.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (ped.state === 'walk' && dist < 260 && state.events.includes('shot')) {
      ped.state = 'flee';
      ped.stateTimer = 3;
    }
    if (ped.state === 'flee') {
      const away = Math.atan2(dy, dx);
      ped.angle = away;
      const step = ped.speed * 2.1 * dt;
      const fixed = resolveCircle(state.city, ped.x + Math.cos(away) * step, ped.y + Math.sin(away) * step, 10);
      ped.x = fixed.x;
      ped.y = fixed.y;
      if (ped.stateTimer <= 0) ped.state = 'walk';
      continue;
    }
    // Sidewalk band: the nearest road line and the ped's offset from it.
    const road = nearestRoad(ped.x, ped.y);
    const vertical = road.x !== ped.x;
    const lateral = vertical ? ped.x - road.x : ped.y - road.y;
    const band = ROAD_W / 2 + 14;
    if (Math.abs(lateral) < ROAD_W / 2 + 6) {
      // On the road: step off it, to the side the ped is already on.
      ped.angle = vertical ? (lateral >= 0 ? 0 : Math.PI) : (lateral >= 0 ? Math.PI / 2 : -Math.PI / 2);
    } else if (Math.abs(lateral) > band + 36) {
      // Too deep in a block: step back toward the road.
      ped.angle = vertical ? (lateral > 0 ? Math.PI : 0) : (lateral > 0 ? -Math.PI / 2 : Math.PI / 2);
    } else if (ped.dirTimer <= 0) {
      // On the sidewalk: walk along it, either way.
      ped.dirTimer = 1.5 + state.random() * 3;
      const along = state.random() < 0.5 ? 1 : -1;
      ped.angle = vertical ? along * Math.PI / 2 : (along > 0 ? 0 : Math.PI);
    }
    const step = ped.speed * dt;
    const fixed = resolveCircle(state.city, ped.x + Math.cos(ped.angle) * step, ped.y + Math.sin(ped.angle) * step, 10);
    ped.x = fixed.x;
    ped.y = fixed.y;
  }
}

/** How many police cars the wanted level asks for. */
export function wantedPoliceCount(wanted) {
  return Math.min(3, Math.ceil(wanted / 2));
}

/** Spawn one police car on a road behind the player's direction of travel, so the
 * chase starts as a pursuit, not a head-on collision in the player's path. */
export function spawnPoliceCar(state) {
  const p = state.player;
  const heading = { x: Math.cos(p.angle), y: Math.sin(p.angle) };
  let best = null;
  for (let tries = 0; tries < 40; tries += 1) {
    const point = roadPoint(state.random);
    const dist = Math.hypot(point.x - p.x, point.y - p.y);
    if (dist < 900 || dist > 1400) continue;
    // Behind the player: the point must not lie ahead of where they are going.
    const dot = ((point.x - p.x) / dist) * heading.x + ((point.y - p.y) / dist) * heading.y;
    if (dot > 0.3) continue;
    if (!best || dist < best.dist) best = { ...point, dist };
  }
  const spot = best || { x: p.x - heading.x * 1100, y: p.y - heading.y * 1100 };
  const car = makeCar(spot.x, spot.y, Math.atan2(p.y - spot.y, p.x - spot.x), 'police', 'police');
  car.speed = 200;
  state.cars.push(car);
  return car;
}

/** Police cars chase the player; officers get out and chase on foot. */
export function updatePolice(state, dt) {
  const p = state.player;
  const want = wantedPoliceCount(p.wanted);
  let count = 0;
  for (let i = 0; i < state.cars.length; i += 1) {
    if (state.cars[i].driver === 'police' && !state.cars[i].disabled) count += 1;
  }
  while (count < want) {
    spawnPoliceCar(state);
    count += 1;
  }
  // Extra police cars leave when the heat drops.
  for (let i = state.cars.length - 1; i >= 0; i -= 1) {
    const car = state.cars[i];
    if (car.driver === 'police' && count > want) {
      const dist = Math.hypot(car.x - p.x, car.y - p.y);
      if (dist > 700) {
        state.cars.splice(i, 1);
        count -= 1;
      }
    }
  }

  for (let i = 0; i < state.cars.length; i += 1) {
    const car = state.cars[i];
    if (car.driver !== 'police' || car.disabled) continue;
    const dist0 = Math.hypot(p.x - car.x, p.y - car.y);
    // A unit that loses sight of the player for a while gives up and leaves.
    if (dist0 > 800) {
      car.loseTimer = (car.loseTimer || 0) + dt;
      if (car.loseTimer > 5) {
        state.cars.splice(i, 1);
        i -= 1;
        continue;
      }
    } else {
      car.loseTimer = 0;
    }
    if (car.ramCd > 0) {
      // Back off after a ram instead of gluing to the player's bumper.
      car.ramCd -= dt;
      car.speed = Math.max(-140, car.speed - 500 * dt);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const fixed = resolveCircle(state.city, nx, ny, CAR.radius);
      car.x = fixed.x;
      car.y = fixed.y;
      continue;
    }
    const dist = Math.hypot(p.x - car.x, p.y - car.y);
    if (p.onFoot && dist < 170) {
      // Stop and send an officer out on foot.
      car.speed = Math.max(0, car.speed - 400 * dt);
      if (state.officers.length < 3 && state.random() < dt * 1.5) {
        state.officers.push(makeOfficer(car.x, car.y));
        state.events.push('officer-out');
      }
      continue;
    }
    const desired = Math.atan2(p.y - car.y, p.x - car.x);
    let diff = desired - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
    car.angle += turn;
    // Off the roads the police are slower: on a road the player can outrun them.
    const topSpeed = isRoad(car.x, car.y) ? car.maxSpeed : Math.min(car.maxSpeed, 260);
    car.speed = Math.min(topSpeed, car.speed + car.accel * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const before = { x: car.x, y: car.y };
    const fixed = resolveCircle(state.city, nx, ny, CAR.radius);
    car.x = fixed.x;
    car.y = fixed.y;
    if (Math.hypot(fixed.x - nx, fixed.y - ny) > 1 && Math.abs(diff) < 0.6) {
      // Shoved by a building: slow down and steer away.
      car.speed *= 0.6;
      car.angle += 0.6;
    }
    if (Math.hypot(car.x - before.x, car.y - before.y) < 2) car.stuck += dt;
    else car.stuck = 0;
    if (car.stuck > 1.2) {
      car.angle += Math.PI * 0.7;
      car.stuck = 0;
    }
  }

  // Officers on foot chase the player and try to hold them.
  for (let i = state.officers.length - 1; i >= 0; i -= 1) {
    const off = state.officers[i];
    const dist = Math.hypot(p.x - off.x, p.y - off.y);
    if (p.wanted === 0 || dist > 900) {
      state.officers.splice(i, 1);
      continue;
    }
    off.angle = Math.atan2(p.y - off.y, p.x - off.x);
    const step = off.speed * dt;
    const fixed = resolveCircle(state.city, off.x + Math.cos(off.angle) * step, off.y + Math.sin(off.angle) * step, 11);
    off.x = fixed.x;
    off.y = fixed.y;
    if (dist < 26 && p.onFoot) {
      off.bust += dt;
      if (off.bust >= 1.2) state.events.push('busted');
    } else {
      off.bust = Math.max(0, off.bust - dt * 2);
    }
  }
}
