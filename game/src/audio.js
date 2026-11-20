// Synthesised sound: every effect is an oscillator or a burst of filtered noise made by
// the Web Audio API, so the game ships no audio files at all. Nothing here runs until the
// player presses a key or clicks (the browser's autoplay rule), and every call is guarded,
// so a browser without audio simply plays silent.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** Call from a user gesture (start button, first keypress). */
  function unlock() {
    if (!ensure()) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 40;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        engineOsc.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      if (!sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'sine';
        sirenOsc.frequency.value = 700;
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
      }
    } catch {
      // Audio stays off; the game plays on silently.
    }
  }

  function noiseBurst(duration, filterFreq, volume) {
    if (!ensure() || muted) return;
    try {
      const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch {
      // Ignore.
    }
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!ensure() || muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Ignore.
    }
  }

  return {
    unlock,
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    /** Continuous engine hum: speed01 is 0 (idle) to 1 (top speed). */
    engine(speed01, driving) {
      if (!ctx || muted) return;
      try {
        const target = driving ? 0.05 + speed01 * 0.08 : 0;
        engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(45 + speed01 * 110, ctx.currentTime, 0.1);
      } catch {
        // Ignore.
      }
    },
    /** Two-tone police siren; call every frame with on = wanted > 0. */
    siren(on, now) {
      if (!ctx || muted) return;
      try {
        sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.2);
        if (on && now - sirenTimer > 0.45) {
          sirenTimer = now;
          sirenOsc.frequency.value = sirenOsc.frequency.value > 800 ? 660 : 920;
        }
      } catch {
        // Ignore.
      }
    },
    shot() { noiseBurst(0.12, 1800, 0.5); tone(180, 0.1, 'square', 0.25, 60); },
    punch() { noiseBurst(0.08, 500, 0.4); },
    pickup() { tone(660, 0.09, 'sine', 0.3); tone(990, 0.14, 'sine', 0.3); },
    crash() { noiseBurst(0.25, 300, 0.6); },
    busted() { tone(440, 0.3, 'sawtooth', 0.25, 220); tone(330, 0.5, 'sawtooth', 0.25, 165); },
    jingle() {
      tone(523, 0.12, 'sine', 0.3);
      setTimeout(() => tone(659, 0.12, 'sine', 0.3), 120);
      setTimeout(() => tone(784, 0.25, 'sine', 0.3), 240);
    },
  };
}
