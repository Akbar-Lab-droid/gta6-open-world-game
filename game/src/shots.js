// The screenshot scenes behind ?shot=cover|street|docks|beach. Each one stages a real
// situation in the world (a chase, a street on foot, the docks pickup, the beach road),
// then plays the real rules forward for a few seconds with a scripted autopilot — the
// police chase, the traffic drives, the pedestrians walk — so the frame is what a short
// game really looks like, and the same seed always gives the same frame.

import { STEP } from './config.js';
import { SCREEN_PLAY } from './render.js';
import { makeCar } from './entities.js';

const SAMPLE = 1 / 60;

/** An input object with the same shape as the real one, driven by a script. */
function scriptedInput(state, mode, target) {
  return {
    axis() {
      if (mode === 'drive') {
        const car = state.player.car;
        if (!car) return { x: 0, y: 0 };
        // Steer toward the road we are on, heading the way the car faces.
        let desired = car.angle;
        const dx = Math.cos(car.angle);
        const dy = Math.sin(car.angle);
        if (Math.abs(dx) > Math.abs(dy)) {
          // Heading mostly east/west: stay on the nearest horizontal road.
          desired = dx > 0 ? 0 : Math.PI;
        } else {
          desired = dy > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
        let diff = desired - car.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return { x: Math.max(-1, Math.min(1, diff * 2)), y: -1 };
      }
      if (mode === 'walk' && target) {
        const dx = target.x - state.player.x;
        const dy = target.y - state.player.y;
        const d = Math.hypot(dx, dy);
        if (d < 12) return { x: 0, y: 0 };
        return { x: dx / d, y: dy / d };
      }
      return { x: 0, y: 0 };
    },
    down() { return false; },
    pressed() { return false; },
    mousePos() { return { x: 640, y: 360 }; },
    mouseDown() { return false; },
    takeClick() { return false; },
    takeActions() { return 0; },
    flush() {},
  };
}

function giveCar(state, x, y, angle, kind) {
  const car = makeCar(x, y, angle, kind, 'player');
  state.cars.push(car);
  const p = state.player;
  p.car = car;
  p.onFoot = false;
  p.x = x;
  p.y = y;
  p.angle = angle;
  p.speed = 0;
  return car;
}

function runFor(world, input, seconds) {
  const steps = Math.round(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, input);
    if (world.state.over) break;
  }
}

/** Make sure at least one police car is close behind the player for the frame. */
function bringPoliceClose(state, count) {
  const p = state.player;
  let have = 0;
  for (let i = 0; i < state.cars.length; i += 1) {
    const car = state.cars[i];
    if (car.driver === 'police' && !car.disabled && Math.hypot(car.x - p.x, car.y - p.y) < 620) have += 1;
  }
  for (let i = 0; i < state.cars.length && have < count; i += 1) {
    const car = state.cars[i];
    if (car.driver !== 'police' || car.disabled) continue;
    const behind = p.angle + Math.PI;
    car.x = p.x + Math.cos(behind) * (180 + have * 90) + (have % 2 === 0 ? -40 : 40);
    car.y = p.y + Math.sin(behind) * (180 + have * 90);
    car.angle = p.angle;
    car.speed = 320;
    have += 1;
  }
}

function stageCover(world) {
  const state = world.state;
  // Danny, mid-getaway, driving east on the downtown avenue with the heat on.
  giveCar(state, 1380, 1340, 0, 'sport');
  state.player.wanted = 3;
  state.mission.stage = 'lose-heat';
  state.mission.chain = 3;
  runFor(world, scriptedInput(state, 'drive'), 3);
  bringPoliceClose(state, 2);
  state.mission.message = 'Vera: SETUP! Lose the cops, then deliver the package!';
  state.mission.messageTimer = 6;
  state.hintTimer = 0;
}

function stageStreet(world) {
  const state = world.state;
  // Danny on foot by Vera's Garage, traffic rolling past, pedestrians on the sidewalk.
  state.player.x = 760;
  state.player.y = 780;
  state.player.angle = Math.PI / 2;
  state.mission.stage = 'start';
  runFor(world, scriptedInput(state, 'walk', { x: 660, y: 720 }), 4);
  state.mission.message = 'Vera: Steal a car. Any car. Then drive to my garage.';
  state.mission.messageTimer = 6;
  state.hintTimer = 0;
}

function stageDocks(world) {
  const state = world.state;
  // The pickup: Danny on foot at the docks crate, a patrol car closing in.
  state.player.x = 3300;
  state.player.y = 700;
  state.player.wanted = 2;
  state.mission.stage = 'grab-package';
  runFor(world, scriptedInput(state, 'walk', { x: 3360, y: 620 }), 4);
  bringPoliceClose(state, 1);
  state.mission.message = 'Vera: Park up and grab the crate on foot.';
  state.mission.messageTimer = 6;
  state.hintTimer = 0;
}

function stageBeach(world) {
  const state = world.state;
  // Along the sand with the sea below, one unit in pursuit.
  giveCar(state, 2100, 2220, 0, 'sedan');
  state.player.wanted = 1;
  state.mission.stage = 'deliver';
  runFor(world, scriptedInput(state, 'drive'), 3);
  bringPoliceClose(state, 1);
  state.mission.message = 'Vera: Clean! Now get that package to Marina Point.';
  state.mission.messageTimer = 6;
  state.hintTimer = 0;
}

export function stageShot(name, world) {
  world.reset();
  if (name === 'cover') stageCover(world);
  else if (name === 'street') stageStreet(world);
  else if (name === 'docks') stageDocks(world);
  else if (name === 'beach') stageBeach(world);
  else stageCover(world);
  return { screen: SCREEN_PLAY };
}
