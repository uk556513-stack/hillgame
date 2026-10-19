// Playful, cheerful, and pleasant Web Audio sound engine for Hill Climber.
// Features cartoon synth engine, springy jumps, wooden crate smashes,
// bubbly UI effects, comical cartoon crashes, triumphant fanfare, and a joyful background tune.

let ctx = null;
let masterGain = null;
let sfxGain = null;
let musicGain = null;
let compressor = null;
let noiseBuffer = null;

let soundEnabled = true;
let musicEnabled = true;

// Engine state
let engineOsc1 = null;
let engineOsc2 = null;
let engineFilter = null;
let engineGain = null;
let engineLfo = null;
let engineLfoGain = null;
let nitroGain = null;
let nitroFilter = null;
let nitroNoise = null;
let isEngineRunning = false;

// Background music state
let musicTimer = null;
let musicStep = 0;
let isMusicPlaying = false;

// Rate limiters
let lastBridgeSoundTime = 0;
let lastLandingSoundTime = 0;

/**
 * Initialize Web Audio Context and audio graph upon first user gesture.
 */
export function startAudio() {
  if (!ctx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    ctx = new AudioContextClass();

    // Studio compressor to prevent clipping and give warm, punchy dynamics
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-16, ctx.currentTime);
    compressor.knee.setValueAtTime(20, ctx.currentTime);
    compressor.ratio.setValueAtTime(4, ctx.currentTime);
    compressor.attack.setValueAtTime(0.005, ctx.currentTime);
    compressor.release.setValueAtTime(0.15, ctx.currentTime);

    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(soundEnabled ? 1 : 0, ctx.currentTime);

    sfxGain = ctx.createGain();
    sfxGain.gain.setValueAtTime(0.85, ctx.currentTime);

    musicGain = ctx.createGain();
    musicGain.gain.setValueAtTime(musicEnabled ? 0.32 : 0, ctx.currentTime);

    sfxGain.connect(compressor);
    musicGain.connect(compressor);
    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    // Pre-generate noise buffer for whooshes, crunches, and wood breaks
    buildNoiseBuffer();

    // Initialize pleasant cartoon engine
    initEngineSynth();

    // Start background music loop
    startMusicLoop();
  }

  if (ctx.state === 'suspended') {
    ctx.resume();
  }
}

/**
 * 2-second looped pink/white noise buffer
 */
function buildNoiseBuffer() {
  if (!ctx) return;
  const bufferSize = ctx.sampleRate * 2;
  noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    // Pink noise approximation for a warmer, pleasant character
    b0 = 0.99 * b0 + white * 0.05;
    b1 = 0.95 * b1 + white * 0.08;
    b2 = 0.85 * b2 + white * 0.15;
    data[i] = (b0 + b1 + b2 + white * 0.1) * 0.35;
  }
}

/**
 * Playful cartoon buggy engine:
 * Dual warm oscillators (triangle + sub-sine) with resonant low-pass filter
 * and speed-dependent cartoon 'chugga-chugga' amplitude modulation.
 */
function initEngineSynth() {
  if (!ctx || isEngineRunning) return;

  // Primary warm body oscillator
  engineOsc1 = ctx.createOscillator();
  engineOsc1.type = 'triangle';
  engineOsc1.frequency.setValueAtTime(65, ctx.currentTime);

  // Sub-bass rounded body
  engineOsc2 = ctx.createOscillator();
  engineOsc2.type = 'sine';
  engineOsc2.frequency.setValueAtTime(32.5, ctx.currentTime);

  // Warm resonant low-pass filter to eliminate harsh buzz
  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.setValueAtTime(320, ctx.currentTime);
  engineFilter.Q.setValueAtTime(2.2, ctx.currentTime);

  // Tremolo / rhythmic cartoon chug LFO
  engineLfo = ctx.createOscillator();
  engineLfo.type = 'sine';
  engineLfo.frequency.setValueAtTime(5, ctx.currentTime);

  engineLfoGain = ctx.createGain();
  engineLfoGain.gain.setValueAtTime(0.18, ctx.currentTime);

  engineGain = ctx.createGain();
  engineGain.gain.setValueAtTime(0.04, ctx.currentTime);

  // Connect engine graph
  engineOsc1.connect(engineFilter);
  engineOsc2.connect(engineFilter);
  engineFilter.connect(engineGain);

  // Modulate engine gain with LFO for cute cartoon "putt-putt" rhythm
  engineLfo.connect(engineLfoGain);
  engineLfoGain.connect(engineGain.gain);

  engineGain.connect(sfxGain);

  // Nitro whoosh synth (sparkly air boost)
  if (noiseBuffer) {
    nitroNoise = ctx.createBufferSource();
    nitroNoise.buffer = noiseBuffer;
    nitroNoise.loop = true;

    nitroFilter = ctx.createBiquadFilter();
    nitroFilter.type = 'bandpass';
    nitroFilter.frequency.setValueAtTime(1200, ctx.currentTime);
    nitroFilter.Q.setValueAtTime(3.0, ctx.currentTime);

    nitroGain = ctx.createGain();
    nitroGain.gain.setValueAtTime(0, ctx.currentTime);

    nitroNoise.connect(nitroFilter);
    nitroFilter.connect(nitroGain);
    nitroGain.connect(sfxGain);
    nitroNoise.start();
  }

  engineOsc1.start();
  engineOsc2.start();
  engineLfo.start();
  isEngineRunning = true;
}

/**
 * Updates engine sound continuously based on vehicle speed and throttle.
 */
export function engineSound(speed, throttle, boosting = false) {
  if (!ctx || !isEngineRunning) return;

  const t = ctx.currentTime;
  const active = soundEnabled;

  // Pleasant cartoon pitch: from a cozy idle purr (62 Hz) to a friendly rev
  const clampedSpeed = Math.min(speed, 90);
  const baseFreq = 62 + clampedSpeed * 1.5 + (throttle ? 18 : 0) + (boosting ? 28 : 0);
  engineOsc1.frequency.setTargetAtTime(baseFreq, t, 0.06);
  engineOsc2.frequency.setTargetAtTime(baseFreq * 0.5, t, 0.06);

  // Lowpass filter cutoff opens pleasantly with acceleration, keeping it warm
  const filterFreq = 260 + clampedSpeed * 7 + (throttle ? 140 : 0) + (boosting ? 260 : 0);
  engineFilter.frequency.setTargetAtTime(filterFreq, t, 0.08);

  // Chugga-chugga tempo increases with speed
  const lfoSpeed = 4 + (clampedSpeed / 90) * 16 + (throttle ? 3 : 0);
  engineLfo.frequency.setTargetAtTime(lfoSpeed, t, 0.1);

  // Volume: gentle idle, cheerful cruise
  const targetGain = active ? (0.025 + (clampedSpeed / 90) * 0.045 + (throttle ? 0.02 : 0)) : 0;
  engineGain.gain.setTargetAtTime(targetGain, t, 0.08);

  // Nitro boost sound effect
  if (nitroGain) {
    const nitroTarget = active && boosting ? 0.18 : 0;
    nitroGain.gain.setTargetAtTime(nitroTarget, t, 0.08);
    if (boosting && nitroFilter) {
      nitroFilter.frequency.setTargetAtTime(1400 + (clampedSpeed * 10), t, 0.08);
    }
  }
}

/**
 * Playful cartoon spring boing! ("Bo-o-o-ing!")
 */
export function playJump() {
  if (!ctx || !soundEnabled) return;
  const t = ctx.currentTime;

  // Main spring oscillator (triangle wave)
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';

  // Cute upward pitch sweep with vibrato wobble
  osc.frequency.setValueAtTime(175, t);
  osc.frequency.exponentialRampToValueAtTime(540, t + 0.11);
  osc.frequency.exponentialRampToValueAtTime(320, t + 0.34);

  // Spring vibrato
  const vibrato = ctx.createOscillator();
  const vibGain = ctx.createGain();
  vibrato.frequency.setValueAtTime(26, t);
  vibGain.gain.setValueAtTime(35, t);
  vibGain.gain.exponentialRampToValueAtTime(0.1, t + 0.35);
  vibrato.connect(vibGain);
  vibGain.connect(osc.frequency);

  // Cheerful bright harmonic pip
  const pip = ctx.createOscillator();
  const pipGain = ctx.createGain();
  pip.type = 'sine';
  pip.frequency.setValueAtTime(350, t);
  pip.frequency.exponentialRampToValueAtTime(920, t + 0.08);

  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.35, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);

  pipGain.gain.setValueAtTime(0.18, t);
  pipGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

  osc.connect(gain);
  pip.connect(pipGain);
  gain.connect(sfxGain);
  pipGain.connect(sfxGain);

  vibrato.start(t);
  osc.start(t);
  pip.start(t);

  vibrato.stop(t + 0.38);
  osc.stop(t + 0.38);
  pip.stop(t + 0.38);
}

/**
 * Satisfying wooden crate pop & clatter ("pop-crunch!")
 * Plays like a playful wooden marimba burst.
 */
export function playCrateBreak() {
  if (!ctx || !soundEnabled) return;
  const t = ctx.currentTime;

  // Pitch variation makes multiple crate smashes sound like a wooden chime arpeggio
  const pitchMod = 0.88 + Math.random() * 0.28;

  // 1. Hollow wooden block "tok"
  const woodOsc = ctx.createOscillator();
  const woodGain = ctx.createGain();
  woodOsc.type = 'triangle';
  woodOsc.frequency.setValueAtTime(460 * pitchMod, t);
  woodOsc.frequency.exponentialRampToValueAtTime(110 * pitchMod, t + 0.08);

  woodGain.gain.setValueAtTime(0.42, t);
  woodGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

  woodOsc.connect(woodGain);
  woodGain.connect(sfxGain);
  woodOsc.start(t);
  woodOsc.stop(t + 0.14);

  // 2. Playful sub-pop
  const subOsc = ctx.createOscillator();
  const subGain = ctx.createGain();
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(240 * pitchMod, t + 0.02);
  subOsc.frequency.exponentialRampToValueAtTime(70 * pitchMod, t + 0.1);

  subGain.gain.setValueAtTime(0, t);
  subGain.gain.setValueAtTime(0.28, t + 0.02);
  subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

  subOsc.connect(subGain);
  subGain.connect(sfxGain);
  subOsc.start(t + 0.02);
  subOsc.stop(t + 0.16);

  // 3. Gentle wooden crunch (filtered noise)
  if (noiseBuffer) {
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100 * pitchMod, t);
    filter.Q.setValueAtTime(1.8, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.22, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(sfxGain);
    noise.start(t);
    noise.stop(t + 0.09);
  }
}

/**
 * Triumphant major-pentatonic victory fanfare!
 * Sparkling marimba / celesta chime sequence when clearing a stage.
 */
export function playWin() {
  if (!ctx || !soundEnabled) return;
  const t = ctx.currentTime;

  // Cheerful ascending arpeggio: G4 -> C5 -> E5 -> G5 -> C6 (Joyful resolution chord)
  const notes = [
    { freq: 392.00, delay: 0.00, dur: 0.22 }, // G4
    { freq: 523.25, delay: 0.11, dur: 0.22 }, // C5
    { freq: 659.25, delay: 0.22, dur: 0.24 }, // E5
    { freq: 783.99, delay: 0.33, dur: 0.28 }, // G5
    { freq: 1046.50, delay: 0.46, dur: 0.80 }, // C6 (lead chime)
    { freq: 1318.51, delay: 0.48, dur: 0.75 }, // E6 (harmony)
    { freq: 1567.98, delay: 0.50, dur: 0.70 }, // G6 (sparkle)
  ];

  notes.forEach(({ freq, delay, dur }) => {
    const start = t + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Warm bell tone: sine + soft triangle
    osc.type = delay >= 0.46 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(delay >= 0.46 ? 0.28 : 0.22, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  });
}

/**
 * Humorous cartoon crash / accident ("slip-whistle down + cute rubbery bonk")
 * Lighthearted and funny so failing is delightful!
 */
export function playCrash() {
  if (!ctx || !soundEnabled) return;
  const t = ctx.currentTime;

  // 1. Cartoon slide whistle downward
  const whistle = ctx.createOscillator();
  const whistleGain = ctx.createGain();
  whistle.type = 'sine';
  whistle.frequency.setValueAtTime(580, t);
  whistle.frequency.exponentialRampToValueAtTime(140, t + 0.26);

  whistleGain.gain.setValueAtTime(0.24, t);
  whistleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

  whistle.connect(whistleGain);
  whistleGain.connect(sfxGain);
  whistle.start(t);
  whistle.stop(t + 0.3);

  // 2. Cute rubbery "bonk"
  const bonkTime = t + 0.22;
  const bonk = ctx.createOscillator();
  const bonkGain = ctx.createGain();
  bonk.type = 'triangle';
  bonk.frequency.setValueAtTime(230, bonkTime);
  bonk.frequency.exponentialRampToValueAtTime(55, bonkTime + 0.14);

  bonkGain.gain.setValueAtTime(0.35, bonkTime);
  bonkGain.gain.exponentialRampToValueAtTime(0.001, bonkTime + 0.16);

  bonk.connect(bonkGain);
  bonkGain.connect(sfxGain);
  bonk.start(bonkTime);
  bonk.stop(bonkTime + 0.18);

  // 3. Playful little "womp-womp"
  const womp1Time = t + 0.38;
  const womp1 = ctx.createOscillator();
  const w1Gain = ctx.createGain();
  womp1.type = 'triangle';
  womp1.frequency.setValueAtTime(185, womp1Time);
  womp1.frequency.exponentialRampToValueAtTime(160, womp1Time + 0.16);

  w1Gain.gain.setValueAtTime(0.2, womp1Time);
  w1Gain.gain.exponentialRampToValueAtTime(0.001, womp1Time + 0.18);

  womp1.connect(w1Gain);
  w1Gain.connect(sfxGain);
  womp1.start(womp1Time);
  womp1.stop(womp1Time + 0.2);

  const womp2Time = t + 0.56;
  const womp2 = ctx.createOscillator();
  const w2Gain = ctx.createGain();
  womp2.type = 'triangle';
  womp2.frequency.setValueAtTime(146, womp2Time);
  womp2.frequency.exponentialRampToValueAtTime(120, womp2Time + 0.26);

  w2Gain.gain.setValueAtTime(0.22, womp2Time);
  w2Gain.gain.exponentialRampToValueAtTime(0.001, womp2Time + 0.28);

  womp2.connect(w2Gain);
  w2Gain.connect(sfxGain);
  womp2.start(womp2Time);
  womp2.stop(womp2Time + 0.3);
}

/**
 * Soft cartoon suspension landing thump ("plop-thwump")
 */
export function playLanding(intensity = 3) {
  if (!ctx || !soundEnabled) return;
  const now = performance.now();
  if (now - lastLandingSoundTime < 180) return; // rate limit
  lastLandingSoundTime = now;

  const t = ctx.currentTime;
  const power = Math.min(1, Math.max(0.2, (intensity - 2) / 8));

  // Soft low bounce
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.11);

  gain.gain.setValueAtTime(0.25 * power, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.15);

  // Subtle spring ping
  const ping = ctx.createOscillator();
  const pingGain = ctx.createGain();
  ping.type = 'triangle';
  ping.frequency.setValueAtTime(260, t);
  ping.frequency.exponentialRampToValueAtTime(170, t + 0.08);

  pingGain.gain.setValueAtTime(0.12 * power, t);
  pingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

  ping.connect(pingGain);
  pingGain.connect(sfxGain);
  ping.start(t);
  ping.stop(t + 0.1);
}

/**
 * Gentle wooden plank bridge clicks when rolling over bridge slats.
 */
export function playBridgeRattle() {
  if (!ctx || !soundEnabled) return;
  const now = performance.now();
  if (now - lastBridgeSoundTime < 85) return;
  lastBridgeSoundTime = now;

  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';

  const freq = 650 + Math.random() * 250;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.03);

  gain.gain.setValueAtTime(0.08, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.04);
}

/**
 * Sweet water droplet / bubble tap for UI buttons ("bloop")
 */
export function playClick(freqShift = 1) {
  if (!ctx || !soundEnabled) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';

  osc.frequency.setValueAtTime(440 * freqShift, t);
  osc.frequency.exponentialRampToValueAtTime(880 * freqShift, t + 0.035);

  gain.gain.setValueAtTime(0.2, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.09);
}

/**
 * Cheerful, jaunty, loopable background music tune!
 * Warm kalimba / marimba lead + acoustic walking bassline in C major.
 * Soft, pleasant, and makes the game feel lively and charming.
 */
const BGM_MELODY = [
  // Measure 1: C major
  { note: 'C4', dur: 0.16 }, { note: 'E4', dur: 0.16 }, { note: 'G4', dur: 0.16 }, { note: 'C5', dur: 0.22 },
  { note: 'B4', dur: 0.16 }, { note: 'G4', dur: 0.16 }, { note: 'E4', dur: 0.20 }, { note: null, dur: 0.10 },
  // Measure 2: F major
  { note: 'F4', dur: 0.16 }, { note: 'A4', dur: 0.16 }, { note: 'C5', dur: 0.16 }, { note: 'D5', dur: 0.22 },
  { note: 'C5', dur: 0.16 }, { note: 'A4', dur: 0.16 }, { note: 'F4', dur: 0.20 }, { note: null, dur: 0.10 },
  // Measure 3: G major
  { note: 'G4', dur: 0.16 }, { note: 'B4', dur: 0.16 }, { note: 'D5', dur: 0.16 }, { note: 'F5', dur: 0.22 },
  { note: 'E5', dur: 0.16 }, { note: 'D5', dur: 0.16 }, { note: 'B4', dur: 0.20 }, { note: null, dur: 0.10 },
  // Measure 4: C turnaround
  { note: 'C5', dur: 0.18 }, { note: 'G4', dur: 0.18 }, { note: 'E4', dur: 0.18 }, { note: 'G4', dur: 0.18 },
  { note: 'C5', dur: 0.26 }, { note: null, dur: 0.12 }, { note: 'D5', dur: 0.14 }, { note: 'E5', dur: 0.22 },
];

const BGM_BASS = [
  // Measure 1: C walking bass
  { note: 'C3', dur: 0.22 }, { note: 'G2', dur: 0.22 }, { note: 'C3', dur: 0.22 }, { note: 'E3', dur: 0.22 },
  // Measure 2: F walking bass
  { note: 'F2', dur: 0.22 }, { note: 'C3', dur: 0.22 }, { note: 'F2', dur: 0.22 }, { note: 'A2', dur: 0.22 },
  // Measure 3: G walking bass
  { note: 'G2', dur: 0.22 }, { note: 'D3', dur: 0.22 }, { note: 'G2', dur: 0.22 }, { note: 'B2', dur: 0.22 },
  // Measure 4: C walking bass
  { note: 'C3', dur: 0.22 }, { note: 'G2', dur: 0.22 }, { note: 'C3', dur: 0.22 }, { note: 'G2', dur: 0.22 },
];

const NOTE_FREQS = {
  'G2': 98.00, 'A2': 110.00, 'B2': 123.47,
  'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00,
  'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
  'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99,
  'C4': 261.63, 'D4': 293.66,
};

function playMusicNote(freq, dur, isBass = false) {
  if (!ctx || !musicEnabled || !soundEnabled) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Bass is warm sine/soft triangle; lead is cheerful bright plink (kalimba/music box)
  osc.type = isBass ? 'triangle' : 'sine';
  osc.frequency.setValueAtTime(freq, t);

  const vol = isBass ? 0.16 : 0.12;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

  osc.connect(gain);
  gain.connect(musicGain);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function startMusicLoop() {
  if (isMusicPlaying) return;
  isMusicPlaying = true;
  musicStep = 0;

  const stepDurationMs = 210; // ~142 BPM cheerful groove

  musicTimer = setInterval(() => {
    if (!ctx || !musicEnabled || !soundEnabled) return;

    // Lead melody note (every step)
    const melodyItem = BGM_MELODY[musicStep % BGM_MELODY.length];
    if (melodyItem && melodyItem.note && NOTE_FREQS[melodyItem.note]) {
      playMusicNote(NOTE_FREQS[melodyItem.note], melodyItem.dur, false);
    }

    // Bass note (every 2 steps)
    if (musicStep % 2 === 0) {
      const bassIndex = Math.floor((musicStep % (BGM_BASS.length * 2)) / 2);
      const bassItem = BGM_BASS[bassIndex % BGM_BASS.length];
      if (bassItem && bassItem.note && NOTE_FREQS[bassItem.note]) {
        playMusicNote(NOTE_FREQS[bassItem.note], bassItem.dur, true);
      }
    }

    musicStep++;
  }, stepDurationMs);
}

/**
 * Toggle sound effects and overall audio on/off.
 */
export function toggleSound() {
  soundEnabled = !soundEnabled;
  if (masterGain && ctx) {
    masterGain.gain.setTargetAtTime(soundEnabled ? 1 : 0, ctx.currentTime, 0.05);
  }
  return soundEnabled;
}

/**
 * Toggle background music independently on/off.
 */
export function toggleMusic() {
  musicEnabled = !musicEnabled;
  if (musicGain && ctx) {
    musicGain.gain.setTargetAtTime(musicEnabled ? 0.32 : 0, ctx.currentTime, 0.05);
  }
  return musicEnabled;
}

export function isSoundOn() {
  return soundEnabled;
}

export function isMusicOn() {
  return musicEnabled;
}
