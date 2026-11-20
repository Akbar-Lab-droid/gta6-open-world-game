// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, paused, busted, wasted, and the
// shot scenes (?shot=cover|street|docks|beach with &seed=N) that stage a scene instead of
// running the loop, paint it twice and set window.__shotReady for a screenshot.
// Progress saves to localStorage at every job step and on pause.

import { PLAYER, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

// Any script error is reported in the title, so a headless run can see it.
window.addEventListener('error', (event) => {
  document.title = `Solmar Heat — ERROR: ${event.message}`;
});

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save.cash !== 'number' || typeof save.chain !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    const p = world.state.player;
    const m = world.state.mission;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: p.cash,
      chain: m.chain,
      stage: m.stage,
      x: p.x,
      y: p.y,
      hp: p.hp,
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function applySave(save) {
  const p = world.state.player;
  const m = world.state.mission;
  p.cash = save.cash;
  p.hp = save.hp || PLAYER.hp;
  m.chain = save.chain;
  m.stage = save.stage || 'start';
  if (m.chain >= 5) m.stage = 'done';
  p.x = save.x;
  p.y = save.y;
  world.state.camera.x = save.x;
  world.state.camera.y = save.y;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const save = readSave();
  let screen = SCREEN_TITLE;
  let savedChain = save ? save.chain : 0;

  function announce(message) {
    status.textContent = message;
  }

  function playSounds(events) {
    const p = world.state.player;
    if (events.includes('shot')) audio.shot();
    if (events.includes('punch')) audio.punch();
    if (events.includes('crash')) audio.crash();
    if (events.includes('pickup') || events.includes('cash')) audio.pickup();
    if (events.includes('mission-complete')) audio.jingle();
    if (events.includes('busted-screen') || events.includes('wasted-screen')) audio.busted();
    audio.engine(p.onFoot ? 0 : Math.abs(p.car ? p.car.speed : 0) / 500, !p.onFoot);
    audio.siren(p.wanted > 0, world.state.time);
  }

  function startGame(fresh) {
    if (fresh) {
      world.reset();
      savedChain = 0;
    }
    audio.unlock();
    screen = SCREEN_PLAY;
    announce('Playing. Steal a car and drive to Vera\u2019s Garage.');
    input.flush();
  }

  function endToTitle() {
    writeSave();
    screen = SCREEN_TITLE;
    announce('Solmar Heat. Press Enter to start.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (input.pressed('KeyM')) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE) startGame(!save || savedChain === 0);
      else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
        world.state.over = null;
        startGame(false);
      }
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        writeSave();
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step() {
    if (screen !== SCREEN_PLAY) return;
    const before = world.state.mission.chain;
    world.step(STEP, input);
    playSounds(world.state.events);
    if (world.state.mission.chain !== before) writeSave();
    if (world.state.over === 'busted') {
      screen = SCREEN_BUSTED;
      announce('Busted. The Solmar PD caught you.');
    } else if (world.state.over === 'wasted') {
      screen = SCREEN_WASTED;
      announce('Wasted. Solmar General patched you up.');
    }
  }

  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, save !== null && savedChain > 0);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      writeSave();
      announce('Paused.');
    }
  });

  // Continue a saved game from the title screen: Enter starts it.
  if (save) applySave(save);
  announce(save ? 'Solmar Heat. Press Enter to continue.' : 'Solmar Heat. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
