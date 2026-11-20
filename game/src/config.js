// Every tuning number and colour in one place. The world is one fixed city, 3600 by 2600,
// and the renderer shows a 1280 by 720 window of it that follows the player.

export const STEP = 1 / 60;

export const VIEW = { width: 1280, height: 720 };

export const WORLD = { width: 3600, height: 2600 };

/** Centre lines of the vertical and horizontal roads. */
export const ROADS_V = [300, 660, 1020, 1380, 1740, 2100, 2460, 2820, 3180];
export const ROADS_H = [260, 620, 980, 1340, 1700, 2060];
export const ROAD_W = 72;

/** The beach strip along the south edge: sand, then water. */
export const BEACH_Y = 2300;
export const WATER_Y = 2480;

/** The docks district on the east edge. */
export const DOCKS = { x0: 3300, y0: 300, y1: 900 };

export const SAVE_KEY = 'solmar-heat-save-v1';

export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  sprintSpeed: 265,
  hp: 100,
  punchRange: 46,
  punchDamage: 25,
  punchCooldown: 0.45,
  magazine: 12,
  reloadTime: 1.0,
  bulletDamage: 34,
  bulletSpeed: 760,
  bulletRange: 560,
};

export const CAR = {
  radius: 20,
  accel: 340,
  brake: 520,
  reverseMax: 150,
  drag: 0.55,
  steer: 2.6,
  maxSpeed: 430,
};

export const CAR_KINDS = {
  sedan: { maxSpeed: 420, accel: 340, color: '#c94f43' },
  sport: { maxSpeed: 500, accel: 430, color: '#e8a13a' },
  van: { maxSpeed: 390, accel: 260, color: '#7d8a99' },
  taxi: { maxSpeed: 430, accel: 350, color: '#f2c230' },
  police: { maxSpeed: 330, accel: 320, color: '#e8e8e8' },
};

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 26;

export const WANTED = {
  max: 5,
  decayDelay: 8,
  decayEvery: 6,
  steal: 1,
  shoot: 1,
  hitPed: 1,
  ramCop: 1,
  bustTime: 1.2,
  fine: 150,
};

export const MISSION_REWARDS = { garage: 100, delivery: 800, fareMin: 40, fareMax: 90 };

export const COLORS = {
  grass: '#7fae5a',
  grassDark: '#74a24f',
  sand: '#e0c98f',
  water: '#2e7fa8',
  waterDeep: '#256b8f',
  road: '#3c3f45',
  roadLine: '#d8c95a',
  sidewalk: '#b9b3a4',
  buildingRoof: ['#b0563f', '#4f7fa8', '#8a6fb0', '#a87f4f', '#5a8a6a', '#94505e', '#6a7a8a'],
  buildingEdge: '#2c2c30',
  park: '#5d9648',
  tree: '#3f7a34',
  dock: '#8a8d90',
  container: ['#c96a3f', '#3f7fa8', '#7fa83f', '#a83f5e'],
};
