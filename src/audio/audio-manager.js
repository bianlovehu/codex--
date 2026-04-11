const STORAGE_KEY = "gomoku_audio_settings_v1";

export class AudioManager {
  constructor(audioElement) {
    this.bgmElement = audioElement;
    this.ctx = null;
    this.masterMuted = false;
    this.sfxVolume = 0.7;
    this.bgmVolume = 0.55;
    this.initiated = false;
    this.bgmReady = true;
    this._loadSettings();
    this._applyVolumes();
    if (this.bgmElement) {
      this.bgmElement.addEventListener("error", () => {
        this.bgmReady = false;
      });
    } else {
      this.bgmReady = false;
    }
  }

  _loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed.masterMuted === "boolean") this.masterMuted = parsed.masterMuted;
      if (typeof parsed.sfxVolume === "number") this.sfxVolume = Math.min(1, Math.max(0, parsed.sfxVolume));
      if (typeof parsed.bgmVolume === "number") this.bgmVolume = Math.min(1, Math.max(0, parsed.bgmVolume));
    } catch (_e) {
      // ignore parsing errors
    }
  }

  _saveSettings() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          masterMuted: this.masterMuted,
          sfxVolume: this.sfxVolume,
          bgmVolume: this.bgmVolume
        })
      );
    } catch (_e) {
      // ignore storage errors
    }
  }

  _applyVolumes() {
    if (this.bgmElement) {
      this.bgmElement.volume = this.masterMuted ? 0 : this.bgmVolume;
    }
  }

  initAfterGesture() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    if (!this.initiated) {
      this.initiated = true;
      this.startBgm();
    }
  }

  startBgm() {
    if (!this.bgmElement || !this.bgmReady || this.masterMuted) return;
    this.bgmElement.volume = this.bgmVolume;
    this.bgmElement.play().catch(() => {});
  }

  stopBgm() {
    if (!this.bgmElement) return;
    this.bgmElement.pause();
  }

  setMasterMute(flag) {
    this.masterMuted = Boolean(flag);
    this._applyVolumes();
    if (this.masterMuted) {
      this.stopBgm();
    } else {
      this.startBgm();
    }
    this._saveSettings();
  }

  setSfxVolume(v) {
    this.sfxVolume = Math.min(1, Math.max(0, v));
    this._saveSettings();
  }

  setBgmVolume(v) {
    this.bgmVolume = Math.min(1, Math.max(0, v));
    this._applyVolumes();
    this._saveSettings();
  }

  getSettings() {
    return {
      masterMuted: this.masterMuted,
      sfxVolume: this.sfxVolume,
      bgmVolume: this.bgmVolume,
      bgmReady: this.bgmReady
    };
  }

  playSfx(type) {
    if (this.masterMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (type === "place") {
      this._tone(now, 470, 0.04, "triangle", 0.12);
      this._tone(now + 0.035, 385, 0.06, "sine", 0.08);
      return;
    }

    if (type === "undo") {
      this._tone(now, 320, 0.05, "square", 0.08);
      this._tone(now + 0.04, 240, 0.09, "triangle", 0.06);
      return;
    }

    if (type === "button") {
      this._tone(now, 620, 0.025, "triangle", 0.05);
      return;
    }

    if (type === "mode") {
      this._tone(now, 390, 0.03, "triangle", 0.07);
      this._tone(now + 0.03, 520, 0.04, "triangle", 0.06);
      return;
    }

    if (type === "win") {
      this._tone(now, 523, 0.08, "triangle", 0.1);
      this._tone(now + 0.07, 659, 0.1, "triangle", 0.1);
      this._tone(now + 0.16, 784, 0.15, "triangle", 0.1);
      return;
    }

    if (type === "lose") {
      this._tone(now, 360, 0.09, "sawtooth", 0.08);
      this._tone(now + 0.08, 290, 0.11, "sawtooth", 0.08);
      return;
    }
  }

  _tone(start, frequency, duration, type, gainValue) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = 0.0001;
    const volume = this.sfxVolume * gainValue;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
}
