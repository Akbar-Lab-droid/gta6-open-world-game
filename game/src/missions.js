// Vera Kane's job chain and the fares that follow it. The mission is a small state
// machine: each stage names an objective, a marker on the map, and the event that moves it
// on. The world reports events (car stolen, arrived, package taken, delivered) and this
// module answers with the next objective, the cash earned and Vera's message.

import { MISSION_REWARDS } from './config.js';
import { roadPoint } from './city.js';

export function createMissions() {
  return {
    chain: 0, // 0 = not started, 1..4 = stages, 5 = chain done (free roam)
    stage: 'start',
    packageHeld: false,
    heatTimer: 0,
    fare: null, // { pickup: {x,y}, dropoff: {x,y}, passenger: bool, pay: number }
    fareTimer: 0,
    message: '',
    messageTimer: 0,
  };
}

function say(mission, text) {
  mission.message = text;
  mission.messageTimer = 6;
}

/** The current objective text and its map marker (or null when there is none). */
export function missionObjective(state) {
  const m = state.mission;
  const lm = state.city.landmarks;
  switch (m.stage) {
    case 'start':
      return { text: 'Vera: Steal a car. Any car. Then drive to my garage.', x: lm.garage.x, y: lm.garage.y };
    case 'to-garage':
      return { text: 'Drive to Vera\u2019s Garage', x: lm.garage.x, y: lm.garage.y };
    case 'to-docks':
      return { text: 'Drive to the Docks and grab the package', x: lm.docksCrate.x, y: lm.docksCrate.y };
    case 'grab-package':
      return { text: 'Get out and grab the package (E)', x: lm.docksCrate.x, y: lm.docksCrate.y };
    case 'lose-heat':
      return { text: 'SETUP! Lose the cops — get your wanted level to zero', x: null, y: null };
    case 'deliver':
      return { text: 'Deliver the package to Marina Point', x: lm.marina.x, y: lm.marina.y };
    case 'done':
      if (m.fare) {
        if (!m.fare.passenger) return { text: 'Fare waiting — drive to the passenger', x: m.fare.pickup.x, y: m.fare.pickup.y };
        return { text: 'Take the fare to the marker', x: m.fare.dropoff.x, y: m.fare.dropoff.y };
      }
      return { text: 'Free roam — a fare will appear soon. Explore Solmar!', x: null, y: null };
    default:
      return { text: '', x: null, y: null };
  }
}

function spawnFare(state) {
  const m = state.mission;
  const p = state.player;
  // Pickup and dropoff both on roads, so a car can actually reach them.
  let pickup = null;
  for (let tries = 0; tries < 30 && !pickup; tries += 1) {
    const point = roadPoint(state.random);
    if (Math.hypot(point.x - p.x, point.y - p.y) > 400) pickup = point;
  }
  pickup = pickup || { x: 1020, y: 620 };
  let dropoff = null;
  for (let tries = 0; tries < 30 && !dropoff; tries += 1) {
    const point = roadPoint(state.random);
    if (Math.hypot(point.x - pickup.x, point.y - pickup.y) > 900) dropoff = point;
  }
  dropoff = dropoff || { x: 2820, y: 1700 };
  m.fare = {
    pickup,
    dropoff,
    passenger: false,
    pay: MISSION_REWARDS.fareMin + Math.floor(state.random() * (MISSION_REWARDS.fareMax - MISSION_REWARDS.fareMin)),
  };
}

export function updateMissions(state, events, dt) {
  const m = state.mission;
  const p = state.player;
  const lm = state.city.landmarks;
  if (m.messageTimer > 0) m.messageTimer -= dt;

  const near = (x, y, r) => Math.hypot(p.x - x, p.y - y) < r;
  const inCar = !p.onFoot;

  switch (m.stage) {
    case 'start':
      if (events.includes('car-stolen')) {
        m.stage = 'to-garage';
        m.chain = 1;
        say(m, 'Vera: Nice wheels. Now bring it to my garage.');
        state.events.push('mission-advance');
      }
      break;
    case 'to-garage':
      if (inCar && near(lm.garage.x, lm.garage.y, 90)) {
        p.cash += MISSION_REWARDS.garage;
        m.stage = 'to-docks';
        m.chain = 2;
        say(m, 'Vera: $100 for the car. Now the docks — a crate is waiting for you.');
        state.events.push('mission-advance');
        state.events.push('cash');
      }
      break;
    case 'to-docks':
      if (near(lm.docksCrate.x, lm.docksCrate.y, 110)) {
        m.stage = 'grab-package';
        say(m, 'Vera: Park up and grab the crate on foot.');
      }
      break;
    case 'grab-package':
      if (events.includes('package')) {
        m.packageHeld = true;
        m.stage = 'lose-heat';
        m.chain = 3;
        m.heatTimer = 0;
        p.wanted = Math.max(p.wanted, 3);
        p.hideTimer = 0;
        say(m, 'Vera: SETUP! It was a trap — lose the cops, then deliver!');
        state.events.push('mission-advance');
      }
      break;
    case 'lose-heat':
      m.heatTimer += dt;
      if (p.wanted === 0) {
        m.stage = 'deliver';
        m.chain = 4;
        say(m, 'Vera: Clean! Now get that package to Marina Point.');
        state.events.push('mission-advance');
      }
      break;
    case 'deliver':
      if (near(lm.marina.x, lm.marina.y, 100)) {
        p.cash += MISSION_REWARDS.delivery;
        m.packageHeld = false;
        m.stage = 'done';
        m.chain = 5;
        say(m, 'Vera: $800. You\u2019re a proper getaway driver now, Danny.');
        state.events.push('mission-complete');
        state.events.push('cash');
        m.fareTimer = 5;
      }
      break;
    case 'done':
      if (!m.fare) {
        m.fareTimer -= dt;
        if (m.fareTimer <= 0) {
          spawnFare(state);
          say(m, 'Fare on the map — pick them up for cash.');
        }
        break;
      }
      if (!m.fare.passenger) {
        if (inCar && near(m.fare.pickup.x, m.fare.pickup.y, 80)) {
          m.fare.passenger = true;
          say(m, 'Passenger aboard. Drive them to the marker.');
          state.events.push('pickup');
        }
      } else if (inCar && near(m.fare.dropoff.x, m.fare.dropoff.y, 90)) {
        p.cash += m.fare.pay;
        say(m, `Fare paid: $${m.fare.pay}. Another will come.`);
        state.events.push('cash');
        m.fare = null;
        m.fareTimer = 6;
      }
      break;
    default:
      break;
  }
}
