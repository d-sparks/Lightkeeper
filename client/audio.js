// AudioManager - modular sound system using Web Audio API
// Supports procedural synthesis now, designed for easy upgrade to sample-based audio later.
// Sound definitions are data-driven (loaded from content/audio/sounds.json).

class AudioManager {
  constructor() {
    this.ctx = null;           // AudioContext (created on first user gesture)
    this.masterGain = null;    // Master volume node
    this.sfxGain = null;       // SFX volume node
    this.musicGain = null;     // Music volume node

    this.sounds = {};          // Sound definitions from JSON
    this.musicDefs = {};       // Music definitions from JSON
    this.biomeMap = {};        // Tileset -> ambient track mapping from music.json
    this.nameOverrides = {};   // Room name substring -> track overrides from music.json
    this.samples = {};         // Loaded AudioBuffer cache (for future sample-based audio)

    this.musicSource = null;   // Currently playing music oscillators/nodes
    this.musicId = null;       // Current music track id
    this.musicLoop = null;     // Music loop interval

    this.muted = false;
    this.sfxVolume = 0.5;
    this.musicVolume = 0.3;

    // Restore saved preferences
    try {
      const prefs = JSON.parse(localStorage.getItem('lk_audio_prefs'));
      if (prefs) {
        if (prefs.muted !== undefined) this.muted = prefs.muted;
        if (prefs.sfxVolume !== undefined) this.sfxVolume = prefs.sfxVolume;
        if (prefs.musicVolume !== undefined) this.musicVolume = prefs.musicVolume;
      }
    } catch (e) { /* ignore */ }
  }

  // Initialize AudioContext (must be called from a user gesture)
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = this.muted ? 0 : 1;

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);
    this.sfxGain.gain.value = this.sfxVolume;

    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.masterGain);
    this.musicGain.gain.value = this.musicVolume;
  }

  // Load sound definitions from JSON
  loadSounds(defs) {
    if (!defs) return;
    for (const [id, def] of Object.entries(defs)) {
      if (id.startsWith('_')) continue; // skip comments
      this.sounds[id] = def;
    }
  }

  // Load music definitions from JSON
  loadMusic(defs) {
    if (!defs) return;
    if (defs.biome_map) {
      for (const [k, v] of Object.entries(defs.biome_map)) {
        if (!k.startsWith('_')) this.biomeMap[k] = v;
      }
    }
    if (defs.name_overrides) {
      for (const [k, v] of Object.entries(defs.name_overrides)) {
        if (!k.startsWith('_')) this.nameOverrides[k] = v;
      }
    }
    for (const [id, def] of Object.entries(defs)) {
      if (id.startsWith('_') || id === 'biome_map' || id === 'name_overrides') continue;
      this.musicDefs[id] = def;
    }
  }

  // Check if a music track is defined
  hasMusic(id) {
    return !!this.musicDefs[id];
  }

  // Resolve the ambient track for a room based on name and tileset
  resolveAmbientTrack(roomName, tileset) {
    const name = (roomName || '').toLowerCase();
    // Check name overrides first (room name substring matches)
    for (const [substr, trackId] of Object.entries(this.nameOverrides)) {
      if (name.includes(substr) && this.hasMusic(trackId)) return trackId;
    }
    // Then check biome_map by tileset
    const biomeTrack = this.biomeMap[tileset];
    if (biomeTrack && this.hasMusic(biomeTrack)) return biomeTrack;
    // Fallback to generic dungeon
    return 'dungeon';
  }

  // Play a sound effect by id
  play(id, opts) {
    if (!this.ctx || this.muted) return;
    const def = this.sounds[id];
    if (!def) return;

    // If def has a sample path, try to play that (future upgrade path)
    if (def.sample && this.samples[def.sample]) {
      this._playSample(def, opts);
      return;
    }

    // Procedural synthesis
    this._playSynth(def, opts);
  }

  // Procedural sound synthesis from definition parameters
  _playSynth(def, opts) {
    const now = this.ctx.currentTime;
    const vol = (def.volume || 0.5) * (opts && opts.volume || 1);
    const duration = def.duration || 0.15;

    // Support multi-layer sounds
    const layers = def.layers || [def];

    for (const layer of layers) {
      const type = layer.wave || 'square';

      if (type === 'noise') {
        this._playNoise(layer, vol, now, duration);
        continue;
      }

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      const freq = layer.freq || 440;
      osc.frequency.setValueAtTime(freq, now);

      // Frequency sweep
      if (layer.freqEnd !== undefined) {
        const sweepTime = layer.sweepTime || duration;
        osc.frequency.linearRampToValueAtTime(layer.freqEnd, now + sweepTime);
      }

      // Vibrato
      if (layer.vibrato) {
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.value = layer.vibrato.rate || 6;
        lfoGain.gain.value = layer.vibrato.depth || 10;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start(now);
        lfo.stop(now + duration);
      }

      // ADSR envelope
      const attack = layer.attack || 0.005;
      const decay = layer.decay || 0.05;
      const sustain = layer.sustain !== undefined ? layer.sustain : 0.3;
      const release = layer.release || 0.05;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + attack);
      gain.gain.linearRampToValueAtTime(vol * sustain, now + attack + decay);
      gain.gain.setValueAtTime(vol * sustain, now + duration - release);
      gain.gain.linearRampToValueAtTime(0, now + duration);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now + (layer.delay || 0));
      osc.stop(now + duration + (layer.delay || 0));
    }
  }

  // White/pink noise burst (for hits, explosions, etc.)
  _playNoise(layer, vol, now, duration) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    const color = layer.color || 'white';
    if (color === 'white') {
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } else if (color === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.0990460;
        b1 = 0.96300 * b1 + white * 0.2965164;
        b2 = 0.57000 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2) * 0.11;
      }
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    const attack = layer.attack || 0.002;
    const release = layer.release || duration * 0.5;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol * (layer.volume || 0.5), now + attack);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    // Optional bandpass filter
    if (layer.filterFreq) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = layer.filterFreq;
      filter.Q.value = layer.filterQ || 1;
      source.connect(filter);
      filter.connect(gain);
    } else {
      source.connect(gain);
    }

    gain.connect(this.sfxGain);
    source.start(now + (layer.delay || 0));
  }

  // Play a loaded audio sample (future upgrade path)
  _playSample(def, opts) {
    const source = this.ctx.createBufferSource();
    source.buffer = this.samples[def.sample];
    const gain = this.ctx.createGain();
    gain.gain.value = (def.volume || 0.5) * (opts && opts.volume || 1);
    source.connect(gain);
    gain.connect(this.sfxGain);
    source.start();
  }

  // --- Music ---

  // Start playing a music track by id
  playMusic(id) {
    if (!this.ctx) return;
    if (this.musicId === id) return; // Already playing this track

    this.stopMusic();
    this.musicId = id;

    const def = this.musicDefs[id];
    if (!def) return;

    this._startMusicLoop(def);
  }

  _startMusicLoop(def) {
    const bpm = def.bpm || 120;
    const beatDuration = 60 / bpm;
    const pattern = def.pattern || [];
    if (pattern.length === 0) return;

    let step = 0;
    const totalSteps = pattern.length;

    const scheduleStep = () => {
      if (this.musicId === null) return;
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const note = pattern[step % totalSteps];

      if (note) {
        this._playMusicNote(note, now, beatDuration, def);
      }

      step++;
      // Loop back
      if (step >= totalSteps) step = 0;
    };

    // Schedule first note immediately
    scheduleStep();

    // Schedule subsequent notes
    this.musicLoop = setInterval(scheduleStep, beatDuration * 1000);
  }

  _playMusicNote(note, now, beatDuration, def) {
    if (this.muted) return;

    // note can be a single freq or an array of freqs (chord)
    const freqs = Array.isArray(note.freq) ? note.freq : [note.freq];
    const wave = note.wave || def.wave || 'triangle';
    const noteLen = (note.len || 1) * beatDuration;
    const vol = (note.vol || 1) * (def.volume || 0.2);

    for (const freq of freqs) {
      if (!freq) continue; // null = rest

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = wave;
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.01);
      gain.gain.setValueAtTime(vol, now + noteLen * 0.7);
      gain.gain.linearRampToValueAtTime(0, now + noteLen);

      osc.connect(gain);
      gain.connect(this.musicGain);

      osc.start(now);
      osc.stop(now + noteLen);
    }

    // Optional bass layer
    if (note.bass) {
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bassOsc.type = 'sine';
      bassOsc.frequency.value = note.bass;
      bassGain.gain.setValueAtTime(0, now);
      bassGain.gain.linearRampToValueAtTime(vol * 0.6, now + 0.01);
      bassGain.gain.linearRampToValueAtTime(0, now + noteLen);
      bassOsc.connect(bassGain);
      bassGain.connect(this.musicGain);
      bassOsc.start(now);
      bassOsc.stop(now + noteLen);
    }
  }

  stopMusic() {
    if (this.musicLoop) {
      clearInterval(this.musicLoop);
      this.musicLoop = null;
    }
    this.musicId = null;
    this.musicSource = null;
  }

  // --- Volume controls ---

  setMuted(muted) {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 1;
    }
    this._savePrefs();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setSfxVolume(v) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
    this._savePrefs();
  }

  setMusicVolume(v) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain) this.musicGain.gain.value = this.musicVolume;
    this._savePrefs();
  }

  _savePrefs() {
    try {
      localStorage.setItem('lk_audio_prefs', JSON.stringify({
        muted: this.muted,
        sfxVolume: this.sfxVolume,
        musicVolume: this.musicVolume,
      }));
    } catch (e) { /* ignore */ }
  }

  // Resume AudioContext if it was suspended (browser autoplay policy)
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
}
