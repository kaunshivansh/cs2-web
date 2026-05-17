type AudioContextConstructor = new () => AudioContext;

interface AudioGraph {
  ctx: AudioContext;
  masterGain: GainNode;
  ambienceGain: GainNode;
  transientGain: GainNode;
}

export class AudioSystem {
  private graph: AudioGraph | null = null;
  private ambienceStarted = false;
  private ambienceStops: Array<() => void> = [];
  private lastFootstepT = 0;
  private bombBeepInterval: ReturnType<typeof setInterval> | null = null;
  private bombBeepRate = 0;
  private bombBeepTimer = 40;

  public isReady(): boolean {
    return this.graph !== null && this.graph.ctx.state !== 'closed';
  }

  public unlock() {
    const { ctx } = this.ensureGraph();
    if (ctx.state === 'suspended') void ctx.resume();
    if (!this.ambienceStarted) this.startAmbience();
  }

  public startAmbience() {
    const { ctx, ambienceGain } = this.ensureGraph();
    if (this.ambienceStarted) return;

    this.ambienceStarted = true;
    const now = ctx.currentTime;
    ambienceGain.gain.cancelScheduledValues(now);
    ambienceGain.gain.setValueAtTime(0.0001, now);
    ambienceGain.gain.exponentialRampToValueAtTime(0.055, now + 1.2);

    const windSize = ctx.sampleRate * 2;
    const windBuffer = ctx.createBuffer(1, windSize, ctx.sampleRate);
    const windData = windBuffer.getChannelData(0);
    for (let i = 0; i < windSize; i += 1) windData[i] = (Math.random() * 2 - 1) * 0.7;
    const wind = ctx.createBufferSource();
    wind.buffer = windBuffer;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 470;
    windFilter.Q.value = 0.34;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.09;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ambienceGain);
    wind.start(now);

    const room = ctx.createOscillator();
    room.type = 'sine';
    room.frequency.value = 58;
    const roomGain = ctx.createGain();
    roomGain.gain.value = 0.018;
    room.connect(roomGain);
    roomGain.connect(ambienceGain);
    room.start(now);

    const dust = ctx.createOscillator();
    dust.type = 'triangle';
    dust.frequency.value = 118;
    const dustFilter = ctx.createBiquadFilter();
    dustFilter.type = 'lowpass';
    dustFilter.frequency.value = 220;
    const dustGain = ctx.createGain();
    dustGain.gain.value = 0.012;
    dust.connect(dustFilter);
    dustFilter.connect(dustGain);
    dustGain.connect(ambienceGain);
    dust.start(now);

    this.ambienceStops.push(() => {
      try { wind.stop(); } catch {}
      wind.disconnect();
      windFilter.disconnect();
      windGain.disconnect();
    });
    this.ambienceStops.push(() => {
      try { room.stop(); } catch {}
      room.disconnect();
      roomGain.disconnect();
    });
    this.ambienceStops.push(() => {
      try { dust.stop(); } catch {}
      dust.disconnect();
      dustFilter.disconnect();
      dustGain.disconnect();
    });
  }

  public stopAmbience() {
    for (const stop of this.ambienceStops) stop();
    this.ambienceStops = [];
    this.ambienceStarted = false;
  }

  public playNoise(duration: number, freq: number, gain: number, type: OscillatorType = 'sawtooth', filterFreq = 4000, filterQ = 1) {
    const { ctx, transientGain } = this.ensureGraph();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = filterFreq;
    flt.Q.value = filterQ;
    osc.connect(flt);
    flt.connect(g);
    g.connect(transientGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  public playBurst(duration: number, gain: number, filterFreq: number, filterType: BiquadFilterType = 'bandpass', q = 1.2) {
    const { ctx, transientGain } = this.ensureGraph();
    const now = ctx.currentTime;
    const bufSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 2.8);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    const flt = ctx.createBiquadFilter();
    flt.type = filterType;
    flt.frequency.value = filterFreq;
    flt.Q.value = q;
    src.connect(flt);
    flt.connect(g);
    g.connect(transientGain);
    src.start(now);
  }

  public playGunshot(weaponId: string) {
    this.unlock();
    const { ctx, transientGain } = this.ensureGraph();
    const now = ctx.currentTime;
    const bufSize = ctx.sampleRate * 0.08;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 3);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const nGain = ctx.createGain();
    const nFlt = ctx.createBiquadFilter();
    nFlt.type = 'bandpass';

    const params: Record<string, [number, number, number, number]> = {
      usp: [0.22, 2200, 3, 1800],
      deagle: [0.45, 1400, 2, 800],
      glock: [0.18, 2800, 3, 2200],
      mp9: [0.15, 3200, 2, 2600],
      mac10: [0.14, 3400, 2, 2800],
      m4a1: [0.28, 1800, 2.5, 1200],
      ak47: [0.38, 1200, 2, 900],
      awp: [0.55, 600, 1.5, 400],
    };
    const [vol, nFreq, nQ, oscFreq] = params[weaponId] || [0.3, 2000, 2, 1500];

    nGain.gain.setValueAtTime(vol, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    nFlt.frequency.value = nFreq;
    nFlt.Q.value = nQ;
    noise.connect(nFlt);
    nFlt.connect(nGain);
    nGain.connect(transientGain);
    noise.start(now);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(oscFreq, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
    const oGain = ctx.createGain();
    oGain.gain.setValueAtTime(vol * 0.6, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(oGain);
    oGain.connect(transientGain);
    osc.start(now);
    osc.stop(now + 0.12);

    if (weaponId === 'awp') this.playBurst(0.18, 0.18, 180, 'lowpass', 0.8);
  }

  public playHitSound(headshot = false) {
    this.unlock();
    if (headshot) {
      this.playNoise(0.12, 3800, 0.35, 'sine', 4200, 8);
      this.playNoise(0.06, 5200, 0.2, 'sine', 5800, 6);
    } else {
      this.playNoise(0.06, 2200, 0.2, 'triangle', 3000, 4);
    }
  }

  public playFootstep(speedRatio = 1, walking = false) {
    this.unlock();
    const now = performance.now();
    const cadence = walking ? 470 : clamp(390 - speedRatio * 135, 235, 420);
    if (now - this.lastFootstepT < cadence) return;
    this.lastFootstepT = now;
    const { ctx, transientGain } = this.ensureGraph();
    const t = ctx.currentTime;
    const gain = (walking ? 0.035 : 0.065) + Math.random() * 0.025;
    this.playBurst(0.055, gain, 620 + Math.random() * 520, 'lowpass', 0.9);
    if (!walking) {
      const heel = ctx.createOscillator();
      heel.type = 'triangle';
      heel.frequency.setValueAtTime(135 + Math.random() * 35, t);
      const heelGain = ctx.createGain();
      heelGain.gain.setValueAtTime(0.02, t);
      heelGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      heel.connect(heelGain);
      heelGain.connect(transientGain);
      heel.start(t);
      heel.stop(t + 0.05);
    }
  }

  public playLandSound(intensity = 1) {
    this.unlock();
    this.playBurst(0.075, 0.05 * clamp(intensity, 0.6, 1.4), 360, 'lowpass', 0.7);
  }

  public playScopeToggle(scoped: boolean) {
    this.unlock();
    this.playNoise(0.055, scoped ? 920 : 620, 0.055, 'triangle', 1500, 2.2);
  }

  public playBombPlant() {
    this.unlock();
    this.playNoise(0.1, 880, 0.13, 'square', 1200, 5);
    setTimeout(() => this.playNoise(0.12, 660, 0.11, 'square', 1000, 4), 110);
  }

  public playBombBeep(timer: number) {
    this.unlock();
    const panic = clamp(1 - timer / 40, 0, 1);
    this.playNoise(0.055, 1120 + panic * 620, 0.18 + panic * 0.12, 'sine', 2400, 8);
  }

  public updateBombBeep(timer: number) {
    this.bombBeepTimer = timer;
    const rate = Math.round(clamp(120 + timer * 14, 110, 680));
    if (this.bombBeepInterval && Math.abs(rate - this.bombBeepRate) < 45) return;
    this.stopBombBeep();
    this.bombBeepRate = rate;
    this.playBombBeep(timer);
    this.bombBeepInterval = setInterval(() => this.playBombBeep(this.bombBeepTimer), rate);
  }

  public stopBombBeep() {
    if (this.bombBeepInterval) {
      clearInterval(this.bombBeepInterval);
      this.bombBeepInterval = null;
    }
    this.bombBeepRate = 0;
  }

  public playBombExplode() {
    this.unlock();
    const { ctx, transientGain } = this.ensureGraph();
    const now = ctx.currentTime;
    const bufSize = ctx.sampleRate * 0.8;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.5);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 400;
    src.connect(flt);
    flt.connect(g);
    g.connect(transientGain);
    src.start(now);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(50, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 1.2);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.5, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc.connect(og);
    og.connect(transientGain);
    osc.start(now);
    osc.stop(now + 1.3);
  }

  public playRoundStart() {
    this.unlock();
    this.playNoise(0.3, 880, 0.15, 'sine', 1200, 4);
    setTimeout(() => this.playNoise(0.2, 1100, 0.12, 'sine', 1400, 4), 200);
  }

  public playDefuseSuccess() {
    this.unlock();
    this.playNoise(0.15, 1400, 0.18, 'sine', 2000, 6);
    setTimeout(() => this.playNoise(0.2, 1800, 0.15, 'sine', 2400, 6), 120);
  }

  public dispose() {
    this.stopAmbience();
    this.stopBombBeep();

    const ctx = this.graph?.ctx;
    this.graph = null;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
  }

  private ensureGraph(): AudioGraph {
    if (this.graph && this.graph.ctx.state !== 'closed') return this.graph;

    const audioGlobal = globalThis as typeof globalThis & {
      webkitAudioContext?: AudioContextConstructor;
    };
    const AudioContextClass = audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error('WebAudio is not supported in this environment.');
    }

    const ctx = new AudioContextClass();
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.34;
    masterGain.connect(ctx.destination);

    const ambienceGain = ctx.createGain();
    ambienceGain.gain.value = 0.0001;
    ambienceGain.connect(masterGain);

    const transientGain = ctx.createGain();
    transientGain.gain.value = 1;
    transientGain.connect(masterGain);

    this.graph = { ctx, masterGain, ambienceGain, transientGain };
    return this.graph;
  }
}

function clamp(v: number, mn: number, mx: number): number {
  return Math.min(mx, Math.max(mn, v));
}

export const audioSystem = new AudioSystem();
