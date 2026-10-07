class SoundManager {
    constructor() {
        this.initialized = false;

        this.masterVolume = this.parseVolume('volMaster', 0.8);
        this.musicVolume = this.parseVolume('volMusic', 0.5);
        this.sfxVolume = this.parseVolume('volSfx', 0.8);

        this.ambianceAudio = new Audio('/static/sounds/ambiance.wav');
        this.ambianceAudio.loop = true;
        this.updateMusicVolume();

        this.underwater = false;
    }

    parseVolume(key, defaultValue) {
        const item = localStorage.getItem(key);
        if (item === null) return defaultValue;
        const parsed = parseFloat(item);
        return isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : defaultValue;
    }

    async init() {
        if (this.initialized) return;

        if (typeof Tone !== 'undefined') {
            await Tone.start();
            this.setupSynths();
        }

        this.playMusic();
        this.initialized = true;
    }

    setupSynths() {
        
        Tone.getDestination().volume.value = Tone.gainToDb(this.masterVolume);

        
        this.reverb = new Tone.Reverb({ decay: 1.2, wet: 0.12 }).toDestination();

        
        this.underwaterFilter = new Tone.Filter(20000, "lowpass").connect(this.reverb);

        
        this.thudSynth = new Tone.MembraneSynth({
            pitchDecay: 0.04,
            octaves: 3,
            oscillator: { type: 'sine' },
            envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.08 }
        }).connect(this.underwaterFilter);

        
        this.noiseFilter = new Tone.Filter(1400, "lowpass").connect(this.underwaterFilter);
        this.noiseSynth = new Tone.NoiseSynth({
            noise: { type: 'pink' },
            envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.04 }
        }).connect(this.noiseFilter);

        
        this.metalSynth = new Tone.MetalSynth({
            frequency: 180,
            envelope: { attack: 0.001, decay: 0.08, release: 0.01 },
            harmonicity: 3.1,
            modulationIndex: 12,
            resonance: 1500,
            octaves: 1.2
        }).connect(this.underwaterFilter);

        
        this.uiSynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.05 }
        }).toDestination();

        
        this.bounceSynth = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 }
        }).connect(this.underwaterFilter);
    }

    setMasterVolume(val) {
        this.masterVolume = isFinite(val) ? Math.max(0, Math.min(1, val)) : 0.8;
        localStorage.setItem('volMaster', this.masterVolume);
        if (typeof Tone !== 'undefined' && Tone.getDestination()) {
            Tone.getDestination().volume.value = Tone.gainToDb(this.masterVolume);
        }
        this.updateMusicVolume();
    }

    setMusicVolume(val) {
        this.musicVolume = isFinite(val) ? Math.max(0, Math.min(1, val)) : 0.5;
        localStorage.setItem('volMusic', this.musicVolume);
        this.updateMusicVolume();
    }

    setSfxVolume(val) {
        this.sfxVolume = isFinite(val) ? Math.max(0, Math.min(1, val)) : 0.8;
        localStorage.setItem('volSfx', this.sfxVolume);
    }

    updateMusicVolume() {
        if (this.ambianceAudio) {
            const calculatedVol = this.masterVolume * this.musicVolume;
            this.ambianceAudio.volume = isFinite(calculatedVol) ? Math.max(0, Math.min(1, calculatedVol)) : 0.4;
        }
    }

    playMusic() {
        if (!this.ambianceAudio) return;
        this.ambianceAudio.play().catch(() => {});
    }

    
    
    setUnderwater(isUnder) {
        if (this.underwater === isUnder) return;
        this.underwater = isUnder;
        if (!this.underwaterFilter) return;

        const targetFreq = isUnder ? 700 : 20000;
        this.underwaterFilter.frequency.rampTo(targetFreq, 0.3);

        if (isUnder) {
            this.ambianceAudio.playbackRate = 0.85;
        } else {
            this.ambianceAudio.playbackRate = 1.0;
        }
    }

    
    
    randomSemitoneOffset(range = 2) {
        return (Math.random() * 2 - 1) * range;
    }

    
    playStep(blockId = 1) {
        if (!this.initialized || this.sfxVolume <= 0 || typeof Tone === 'undefined') return;

        const vol = Tone.gainToDb(this.sfxVolume * 0.35);
        const detune = this.randomSemitoneOffset(3);

        switch (blockId) {
            case 1: 
                this.metalSynth.volume.value = vol - 14;
                this.metalSynth.detune.value = detune * 10;
                this.metalSynth.triggerAttackRelease("C4", "32n");
                this.thudSynth.volume.value = vol - 4;
                this.thudSynth.triggerAttackRelease("G1", "32n");
                break;
            case 4: 
                this.thudSynth.volume.value = vol;
                this.thudSynth.triggerAttackRelease("E2", "16n");
                break;
            case 9: 
                this.noiseFilter.frequency.value = 700 + Math.random() * 200;
                this.noiseSynth.volume.value = vol - 2;
                this.noiseSynth.triggerAttackRelease("16n");
                break;
            case 3: 
            case 2: 
            default:
                this.thudSynth.volume.value = vol - 3;
                this.thudSynth.triggerAttackRelease("C2", "16n");
                this.noiseFilter.frequency.value = 1600 + Math.random() * 300;
                this.noiseSynth.volume.value = vol - 6;
                this.noiseSynth.triggerAttackRelease("32n");
                break;
        }
    }

    
    playJump() {
        if (!this.initialized || this.sfxVolume <= 0 || typeof Tone === 'undefined' || !this.bounceSynth) return;
        const vol = Tone.gainToDb(this.sfxVolume * 0.3);
        this.bounceSynth.volume.value = vol;
        this.bounceSynth.triggerAttackRelease("G3", "32n");
    }

    
    playLand(fallIntensity = 1) {
        if (!this.initialized || this.sfxVolume <= 0 || typeof Tone === 'undefined') return;
        const clamped = Math.max(0.3, Math.min(1.5, fallIntensity));
        const vol = Tone.gainToDb(this.sfxVolume * 0.4 * clamped);

        this.thudSynth.volume.value = vol;
        this.thudSynth.triggerAttackRelease("A1", "8n");

        if (this.bounceSynth) {
            this.bounceSynth.volume.value = vol - 6;
            this.bounceSynth.triggerAttackRelease("D3", "16n");
        }
    }

    
    playBlockBreak(blockId = 1) {
        if (!this.initialized || this.sfxVolume <= 0 || typeof Tone === 'undefined') return;

        const vol = Tone.gainToDb(this.sfxVolume * 0.65);

        this.thudSynth.volume.value = vol;
        this.thudSynth.triggerAttackRelease("A1", "8n");

        this.noiseFilter.frequency.value = 2200 + Math.random() * 800;
        this.noiseSynth.volume.value = vol;
        this.noiseSynth.triggerAttackRelease("8n");

        if (blockId === 1) { 
            this.metalSynth.volume.value = vol - 8;
            this.metalSynth.triggerAttackRelease("E3", "16n");
        }
    }

    
    playBlockPlace(blockId = 1) {
        if (!this.initialized || this.sfxVolume <= 0 || typeof Tone === 'undefined') return;

        const vol = Tone.gainToDb(this.sfxVolume * 0.55);

        this.thudSynth.volume.value = vol;
        this.thudSynth.triggerAttackRelease("F2", "16n");

        this.noiseFilter.frequency.value = 1100;
        this.noiseSynth.volume.value = vol - 5;
        this.noiseSynth.triggerAttackRelease("32n");
    }

    
    playSelectSlot() {
        if (!this.initialized || this.sfxVolume <= 0 || typeof Tone === 'undefined') return;

        const vol = Tone.gainToDb(this.sfxVolume * 0.22);
        this.uiSynth.volume.value = vol;

        const notes = ["C5", "E5", "G5", "B5"];
        const randomNote = notes[Math.floor(Math.random() * notes.length)];
        this.uiSynth.triggerAttackRelease(randomNote, "32n");
    }

    
    playInventoryToggle(opening = true) {
        if (!this.initialized || this.sfxVolume <= 0 || typeof Tone === 'undefined') return;

        const vol = Tone.gainToDb(this.sfxVolume * 0.25);
        this.uiSynth.volume.value = vol;
        this.uiSynth.triggerAttackRelease(opening ? "E4" : "C4", "16n");
    }
}

const soundManager = new SoundManager();

window.soundManager = soundManager;