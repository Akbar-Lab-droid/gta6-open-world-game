// Keyboard and pointer input. Held keys are read every frame; one-shot presses (start,
// pause, interact, reload, mute) are queued and taken once, so a press between two frames
// is never lost and never counted twice. The mouse position is in canvas pixels.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const held = new Set();
  const pressedQueue = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    pressedQueue.add(event.code);
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    mouse.down = true;
    mouse.clicked = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  return {
    /** True while the key is held down. */
    down(code) {
      return held.has(code);
    },
    /** True once for a fresh press since the last frame; consumed by reading. */
    pressed(code) {
      if (pressedQueue.has(code)) {
        pressedQueue.delete(code);
        return true;
      }
      return false;
    },
    /** Movement axis from WASD or the arrow keys: x -1..1, y -1..1. */
    axis() {
      const x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      const y = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    /** The mouse position in canvas pixels. */
    mousePos() {
      return { x: mouse.x, y: mouse.y };
    },
    /** True while the primary mouse button is held. */
    mouseDown() {
      return mouse.down;
    },
    /** True once for a fresh click since the last frame; consumed by reading. */
    takeClick() {
      const clicked = mouse.clicked;
      mouse.clicked = false;
      return clicked;
    },
    /** The one-shot confirm/pause presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Drop any queued presses (used when changing screens). */
    flush() {
      pressedQueue.clear();
      actions = 0;
      mouse.clicked = false;
    },
  };
}
