// The game state and one fixed step of it: the player on foot or in a car, the wanted
// level, combat, collisions, the camera and the events the loop (and the sound) reads.
// Everything the renderer draws lives in state; nothing here touches the DOM.

import { BEACH_Y, CAR, PLAYER, STEP, VIEW, WANTED, WORLD } from './config.js';
import { createCity, isWater, resolveCircle } from './city.js';
import { createMissions, updateMissions } from './missions.js';
import { makeCar, spawnCityCars, spawnPeds, updatePeds, updatePolice, updateTraffic } from './entities.js';

export function createWorld(random) {
  const city = createCity(random);
  const state = freshState(city, random);
  return {
    state,
    random,
    reset() {
      const next = freshState(city, random);
      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, next);
    },
    step(dt, input) {
      stepWorld(state, input, dt);
    },
  };
}

function freshState(city, random) {
  const start = city.landmarks.start;
  return {
    random,
    city,
    time: 0,
    lastShot: -1,
    lastCrime: 0,
    player: {
      x: start.x, y: start.y,
      angle: -Math.PI / 2,
      hp: PLAYER.hp,
      cash: 50,
      ammo: PLAYER.magazine,
      onFoot: true,
      car: null,
      speed: 0,
      wanted: 0,
      hideTimer: 0,
      decayTimer: 0,
      invuln: 0,
      punchCd: 0,
      reloadTimer: 0,
      aim: -Math.PI / 2,
    },
    cars: spawnCityCars(city, random),
    peds: spawnPeds(city, random, 26),
    officers: [],
    bullets: [],
    particles: [],
    mission: createMissions(),
    camera: { x: start.x, y: start.y },
    events: [],
    over: null, // 'busted' | 'wasted' | null
    hintTimer: 25,
  };
}

function nearestCar(state, x, y, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (let i = 0; i < state.cars.length; i += 1) {
    const car = state.cars[i];
    if (car.driver === 'player' || car.disabled) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestDist) {
      best = car;
      bestDist = d;
    }
  }
  return best;
}

function addWanted(state, amount) {
  const p = state.player;
  if (amount <= 0) return;
  const before = p.wanted;
  p.wanted = Math.min(WANTED.max, p.wanted + amount);
  p.hideTimer = 0;
  p.decayTimer = 0;
  state.lastCrime = state.time;
  if (p.wanted > before) state.events.push('wanted-up');
}

function stepPlayerOnFoot(state, input, dt) {
  const p = state.player;
  const axis = input.axis();
  const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  let mx = axis.x;
  let my = axis.y;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    p.angle = Math.atan2(my, mx);
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  const fixed = resolveCircle(state.city, p.x + mx * speed * dt, p.y + my * speed * dt, PLAYER.radius);
  p.x = fixed.x;
  p.y = fixed.y;

  // Aim follows the mouse.
  const mouse = input.mousePos();
  const wx = state.camera.x - VIEW.width / 2 + mouse.x;
  const wy = state.camera.y - VIEW.height / 2 + mouse.y;
  p.aim = Math.atan2(wy - p.y, wx - p.x);

  if (p.punchCd > 0) p.punchCd -= dt;
  if (p.reloadTimer > 0) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0) p.ammo = PLAYER.magazine;
  }

  // Punch: Space, a short arc in front of the player.
  if (input.pressed('Space') && p.punchCd <= 0) {
    p.punchCd = PLAYER.punchCooldown;
    state.events.push('punch');
    for (let i = 0; i < state.peds.length; i += 1) {
      const ped = state.peds[i];
      const d = Math.hypot(ped.x - p.x, ped.y - p.y);
      if (d < PLAYER.punchRange && ped.state !== 'down') {
        ped.state = 'down';
        ped.stateTimer = 2;
        addWanted(state, WANTED.hitPed);
      }
    }
    for (let i = 0; i < state.officers.length; i += 1) {
      const off = state.officers[i];
      const d = Math.hypot(off.x - p.x, off.y - p.y);
      if (d < PLAYER.punchRange) {
        state.officers.splice(i, 1);
        state.events.push('officer-down');
        break;
      }
    }
  }

  // Shoot: hold the mouse to fire toward it, at most once every 0.18 s.
  if (input.mouseDown() && p.reloadTimer <= 0 && p.ammo > 0) {
    if (state.time - state.lastShot > 0.18) {
      state.lastShot = state.time;
      p.ammo -= 1;
      state.bullets.push({
        x: p.x + Math.cos(p.aim) * 20,
        y: p.y + Math.sin(p.aim) * 20,
        vx: Math.cos(p.aim) * PLAYER.bulletSpeed,
        vy: Math.sin(p.aim) * PLAYER.bulletSpeed,
        life: PLAYER.bulletRange / PLAYER.bulletSpeed,
      });
      state.events.push('shot');
      const nearWitness = state.officers.length > 0 || state.peds.some(
        (ped) => Math.hypot(ped.x - p.x, ped.y - p.y) < 500,
      );
      if (nearWitness) addWanted(state, WANTED.shoot);
      if (p.ammo === 0) p.reloadTimer = PLAYER.reloadTime;
    }
  }
  if (input.pressed('KeyR') && p.ammo < PLAYER.magazine && p.reloadTimer <= 0) {
    p.reloadTimer = PLAYER.reloadTime;
  }

  // Interact: E near a car steals it; E at the docks crate takes the package.
  if (input.pressed('KeyE')) {
    if (state.mission.stage === 'grab-package') {
      const crate = state.city.landmarks.docksCrate;
      if (Math.hypot(p.x - crate.x, p.y - crate.y) < 70) {
        state.events.push('package');
        state.events.push('pickup');
        return;
      }
    }
    const car = nearestCar(state, p.x, p.y, 60);
    if (car) {
      if (car.driver === 'traffic') car.speed = 0;
      car.driver = 'player';
      p.car = car;
      p.onFoot = false;
      p.speed = 0;
      addWanted(state, WANTED.steal);
      state.events.push('car-stolen');
      state.events.push('car-enter');
    }
  }
}

function stepPlayerDriving(state, input, dt) {
  const p = state.player;
  const car = p.car;
  if (!car) {
    p.onFoot = true;
    return;
  }
  const axis = input.axis();
  // axis.y is -1 for W (up) and +1 for S (down): forward is W.
  const throttle = -axis.y;
  const steer = axis.x;
  if (throttle > 0) car.speed += car.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 5) car.speed -= CAR.brake * dt;
    else car.speed = Math.max(-CAR.reverseMax, car.speed - car.accel * 0.6 * dt);
  } else {
    car.speed -= car.speed * CAR.drag * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = Math.max(-CAR.reverseMax, Math.min(car.maxSpeed, car.speed));
  const steerRate = CAR.steer * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 120);
  car.angle += steer * steerRate * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = resolveCircle(state.city, nx, ny, CAR.radius);
  const moved = Math.hypot(fixed.x - nx, fixed.y - ny);
  car.x = fixed.x;
  car.y = fixed.y;
  if (moved > 1) {
    if (Math.abs(car.speed) > 180) {
      state.events.push('crash');
      car.speed *= 0.5;
      spawnSparks(state, car.x, car.y, 6);
    } else {
      car.speed *= 0.85;
    }
  }
  // Skid marks at speed.
  if (Math.abs(car.speed) > 260 && Math.abs(steer) > 0.3) {
    state.particles.push({
      x: car.x - Math.cos(car.angle) * 14, y: car.y - Math.sin(car.angle) * 14,
      vx: 0, vy: 0, life: 0.6, color: '#222222', size: 5, skid: true,
    });
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = Math.abs(car.speed);
  // Car-to-car shoves.
  for (let i = 0; i < state.cars.length; i += 1) {
    const other = state.cars[i];
    if (other === car || other.disabled) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d > 0 && d < CAR.radius * 2) {
      const push = (CAR.radius * 2 - d) / 2;
      const nx2 = dx / d;
      const ny2 = dy / d;
      other.x += nx2 * push;
      other.y += ny2 * push;
      car.x -= nx2 * push * 0.5;
      car.y -= ny2 * push * 0.5;
      if (other.driver === 'police' && Math.abs(car.speed) > 200) {
        // A ram only counts as the player's crime when the player drove into the
        // cop; a cop that spawns ahead and drives at the player is not the
        // player's fault. Either way the cop backs off after the hit.
        const dot = (dx / d) * Math.cos(car.angle) + (dy / d) * Math.sin(car.angle);
        const copDot = (-dx / d) * Math.cos(other.angle) + (-dy / d) * Math.sin(other.angle);
        if (dot > 0.3 && copDot < 0.5) {
          addWanted(state, WANTED.ramCop);
        }
        other.ramCd = 2;
        state.events.push('crash');
      }
      if (other.driver === 'traffic') {
        other.speed = Math.max(0, other.speed - 60);
        if (Math.abs(car.speed) > 240) state.events.push('crash');
      }
    }
  }
  // Running over pedestrians.
  for (let i = 0; i < state.peds.length; i += 1) {
    const ped = state.peds[i];
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < CAR.radius + 10 && Math.abs(car.speed) > 60) {
      ped.state = 'down';
      ped.stateTimer = 2.5;
      addWanted(state, WANTED.hitPed);
      state.events.push('crash');
    }
  }
  // Get out: E.
  if (input.pressed('KeyE')) {
    const side = car.angle + Math.PI / 2;
    const ox = car.x + Math.cos(side) * 34;
    const oy = car.y + Math.sin(side) * 34;
    const fixedOut = resolveCircle(state.city, ox, oy, PLAYER.radius);
    p.x = fixedOut.x;
    p.y = fixedOut.y;
    p.onFoot = true;
    p.speed = 0;
    car.driver = null;
    car.speed = 0;
    p.car = null;
    state.events.push('car-exit');
  }
}

function spawnSparks(state, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const a = state.random() * Math.PI * 2;
    const s = 60 + state.random() * 140;
    state.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.4 + state.random() * 0.3,
      color: '#f2c230', size: 3, skid: false,
    });
  }
}

function stepBullets(state, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || isWater(b.x, b.y);
    if (!dead) {
      for (let j = 0; j < state.city.buildings.length; j += 1) {
        const bd = state.city.buildings[j];
        if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) {
          dead = true;
          spawnSparks(state, b.x, b.y, 3);
          break;
        }
      }
    }
    if (!dead) {
      for (let j = state.officers.length - 1; j >= 0; j -= 1) {
        const off = state.officers[j];
        if (Math.hypot(off.x - b.x, off.y - b.y) < 14) {
          state.officers.splice(j, 1);
          state.events.push('officer-down');
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (let j = state.peds.length - 1; j >= 0; j -= 1) {
        const ped = state.peds[j];
        if (ped.state !== 'down' && Math.hypot(ped.x - b.x, ped.y - b.y) < 13) {
          ped.state = 'down';
          ped.stateTimer = 2.5;
          addWanted(state, WANTED.hitPed);
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (let j = 0; j < state.cars.length; j += 1) {
        const car = state.cars[j];
        if (car.driver === 'player' || car.disabled) continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < CAR.radius) {
          if (car.driver === 'police') {
            car.hp -= 1;
            if (car.hp <= 0) {
              car.disabled = true;
              car.driver = null;
              state.events.push('cop-disabled');
            }
          } else {
            car.driver = null; // the driver flees; the car sits parked
            state.events.push('car-shot');
          }
          dead = true;
          break;
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

function stepWanted(state, dt) {
  const p = state.player;
  if (p.wanted === 0) return;
  // Is any police close enough to see the player?
  let seen = false;
  for (let i = 0; i < state.cars.length; i += 1) {
    const car = state.cars[i];
    if (car.driver === 'police' && !car.disabled && Math.hypot(car.x - p.x, car.y - p.y) < 420) {
      seen = true;
      break;
    }
  }
  if (!seen && state.officers.length === 0) {
    // A pedestrian right next to the player shortly after a crime also keeps
    // the heat up.
    seen = state.peds.some((ped) => Math.hypot(ped.x - p.x, ped.y - p.y) < 200)
      && state.time - state.lastCrime < 5;
  }
  if (seen) {
    p.hideTimer = 0;
    p.decayTimer = 0;
  } else {
    p.hideTimer += dt;
    if (p.hideTimer > WANTED.decayDelay) {
      p.decayTimer += dt;
      if (p.decayTimer >= WANTED.decayEvery) {
        p.decayTimer = 0;
        p.wanted -= 1;
        state.events.push('wanted-down');
      }
    }
  }
}

function stepParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const pt = state.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }
}

function stepWorld(state, input, dt) {
  state.time += dt;
  state.events = [];
  const p = state.player;
  if (p.invuln > 0) p.invuln -= dt;
  if (state.hintTimer > 0) state.hintTimer -= dt;

  if (p.onFoot) stepPlayerOnFoot(state, input, dt);
  else stepPlayerDriving(state, input, dt);

  stepBullets(state, dt);
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  stepWanted(state, dt);
  updateMissions(state, state.events, dt);
  stepParticles(state, dt);

  // Busted / wasted: pay the fine, respawn, clear the heat.
  if (state.events.includes('busted')) {
    p.cash = Math.max(0, p.cash - WANTED.fine);
    p.wanted = 0;
    p.hp = PLAYER.hp;
    p.onFoot = true;
    if (p.car) {
      p.car.driver = null;
      p.car.speed = 0;
      p.car = null;
    }
    p.x = state.city.landmarks.policeHq.x;
    p.y = state.city.landmarks.policeHq.y + 120;
    p.invuln = 2;
    state.officers = [];
    state.over = 'busted';
    return;
  }
  if (p.hp <= 0) {
    p.cash = Math.max(0, p.cash - WANTED.fine);
    p.wanted = 0;
    p.hp = PLAYER.hp;
    p.onFoot = true;
    if (p.car) {
      p.car.driver = null;
      p.car.speed = 0;
      p.car = null;
    }
    p.x = state.city.landmarks.hospital.x;
    p.y = state.city.landmarks.hospital.y + 120;
    p.invuln = 2;
    state.officers = [];
    state.over = 'wasted';
  }

  // Camera follows the player (or their car), clamped to the world.
  const tx = Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, p.x));
  const ty = Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2, p.y));
  state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 5);
  state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 5);
}

export { STEP };
