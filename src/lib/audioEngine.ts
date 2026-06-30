import { WaveformType, NoteInfo } from '../types';

const SCALES: Record<string, number[]> = {
  // Classical
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  melodic_minor: [0, 2, 3, 5, 7, 9, 11],
  
  // Church Modes
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  
  // Jazz
  lydian_dominant: [0, 2, 4, 6, 7, 9, 10],
  altered: [0, 1, 3, 4, 6, 8, 10],
  diminished: [0, 1, 3, 4, 6, 7, 9, 10],
  super_locrian: [0, 1, 3, 4, 6, 8, 10],
  
  // Eastern
  gong: [0, 2, 4, 7, 9],
  shang: [0, 2, 5, 7, 10],
  jue: [0, 3, 5, 8, 10],
  zhi: [0, 2, 5, 7, 9],
  yu: [0, 3, 5, 7, 10]
};

export class ThereminAudioEngine {
  private ctx: AudioContext | null = null;
  
  // Right-hand Lead Synth Path Nodes
  private osc: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private osc2Gain: GainNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private subOscGain: GainNode | null = null;
  private gainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  
  // Dedicated Left-Hand Bass Synth Path Nodes
  private bassOsc: OscillatorNode | null = null;
  private bassOsc2: OscillatorNode | null = null;
  private bassOscGain: GainNode | null = null;
  private bassFilterNode: BiquadFilterNode | null = null;
  private bassSidechainGain: GainNode | null = null;
  private bassHpfNode: BiquadFilterNode | null = null;
  private bassLfo: OscillatorNode | null = null;
  private bassLfoGain: GainNode | null = null;
  private bassDelayGain: GainNode | null = null;

  // Shared Master Effects
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private delayMixNode: GainNode | null = null;
  private vibratoLfo: OscillatorNode | null = null;
  private vibratoGain: GainNode | null = null;
  private pannerNode: StereoPannerNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private masterGainNode: GainNode | null = null;
  
  // Professional Equalization & Dynamic Compressor Nodes (Stereo Record Quality Glue)
  private leadHpfNode: BiquadFilterNode | null = null;
  private leadEqNode: BiquadFilterNode | null = null;
  private masterCompressorNode: DynamicsCompressorNode | null = null;

  private isPlaying: boolean = false;
  private currentFrequency: number = 440;
  private currentVolume: number = 0.5;
  private currentWaveform: WaveformType = 'sine';
  private currentPreset: string = 'classic';

  // Master BPM and Precise Look-Ahead Scheduler Clock
  private tempoBpm: number = 110;
  private schedulerInterval: any = null;
  private scheduleAheadTime: number = 0.15; // 150ms ahead look-ahead window
  private nextNoteTime: number = 0.0;       // exact performance time for next beat
  private beatCounter: number = 0;
  private activeBaseFreq: number = 440;
  private activeLeftBassFreq: number = 55;
  private stepCounter: number = 0;

  // Selected performance settings (synced dynamically from state/controls)
  private leftPlayMode: 'drone' | 'pulse' = 'drone';
  private rightPlayMode: 'arp' | 'stepwise' | 'thirdLeaps' | 'jazzLoop' | 'harmonicIntervals' | 'blockChords' | 'auto' = 'arp';
  private rhythmModel: 'triplets' | 'front16th' | 'back16th' | 'four16ths' | 'dotted' | 'syncopated' | 'random' = 'random';
  private leftHandActive: boolean = false;
  private rightHandActive: boolean = false;
  private leftHandVelocity: number = 0;
  private leftHandY: number = 0.5;

  // Real-time hand status and gesture details
  private leftHandZ: number = 0.5;
  private rightHandZ: number = 0.5;
  private leftHandPalmOpen: boolean = true;
  private rightHandPalmOpen: boolean = true;
  private randomMelodyMix: number = 0.35;

  // --- Harmonization and Scale System Properties ---
  private harmonicSystem: 'classical' | 'church' | 'jazz' | 'eastern' = 'classical';
  private scaleMode: string = 'minor';
  private scaleRoot: 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B' = 'C';
  private activeChordDegree: number = 1; // 1 to 7
  private autoChordProgression: boolean = true;
  private stepwiseDegree: number = 0;
  private thirdLeapsDegree: number = 0;

  private rawBaseFreq: number = 440;
  private rawLeftBassFreq: number = 55;

  // Drum Machine state
  private drumEnabled: boolean = true;
  private drumPattern: 'disco' | 'techno' | 'funk' | 'reggae' = 'disco';
  private drumVolume: number = 0.6;
  private drumGain: number = 0.7;
  private drumLowBoost: number = 0.5;
  private rhythmLayer: number = 0;
  private drumMasterGain: GainNode | null = null;
  private drumLowShelfFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  /**
   * Initializes the Web Audio API nodes and starts our 110 BPM master beat scheduler.
   */
  public init() {
    if (this.ctx) return;

    // Create audio context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('Web Audio API is not supported in this browser.');
    }
    
    this.ctx = new AudioContextClass();
    this.createNoiseBuffer();
    const now = this.ctx.currentTime;
    
    // --- Right-Hand Synthesizer Oscillators ---
    this.osc = this.ctx.createOscillator();
    this.osc2 = this.ctx.createOscillator();
    this.osc2Gain = this.ctx.createGain();
    this.subOsc = this.ctx.createOscillator();
    this.subOscGain = this.ctx.createGain();
    this.gainNode = this.ctx.createGain();
    this.filterNode = this.ctx.createBiquadFilter();

    // --- Dedicated Left-Hand Bass Synth Oscillators ---
    this.bassOsc = this.ctx.createOscillator();
    this.bassOsc2 = this.ctx.createOscillator();
    this.bassOscGain = this.ctx.createGain();
    this.bassFilterNode = this.ctx.createBiquadFilter();
    this.bassSidechainGain = this.ctx.createGain();
    this.bassHpfNode = this.ctx.createBiquadFilter();

    // --- Master FX Nodes ---
    this.delayNode = this.ctx.createDelay(2.0); // max delay 2s
    this.delayFeedback = this.ctx.createGain();
    this.delayMixNode = this.ctx.createGain();
    this.vibratoLfo = this.ctx.createOscillator();
    this.vibratoGain = this.ctx.createGain();
    
    if (this.ctx.createStereoPanner) {
      this.pannerNode = this.ctx.createStereoPanner();
    }
    
    this.analyserNode = this.ctx.createAnalyser();
    this.masterGainNode = this.ctx.createGain();

    // --- Create Dedicated Drum Bus Nodes ---
    this.drumMasterGain = this.ctx.createGain();
    this.drumLowShelfFilter = this.ctx.createBiquadFilter();

    // --- Configure Nodes ---
    this.analyserNode.fftSize = 1024;

    // Configure main lowpass filter
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(4500, now);
    this.filterNode.Q.setValueAtTime(1.2, now);

    // Configure dedicated bass lowpass filter for warm low-end Epic Clouds atmosphere
    this.bassFilterNode.type = 'lowpass';
    this.bassFilterNode.frequency.setValueAtTime(320, now);
    this.bassFilterNode.Q.setValueAtTime(2.2, now); // resonant filter for sweep texture

    // Initialize Left-Hand Bass Atmospheric LFO
    this.bassLfo = this.ctx.createOscillator();
    this.bassLfoGain = this.ctx.createGain();
    this.bassLfo.type = 'sine';
    this.bassLfo.frequency.setValueAtTime(0.15, now); // ultra slow LFO (0.15 Hz)
    this.bassLfoGain.gain.setValueAtTime(80, now); // sweep 80 Hz around the cutoff

    this.bassLfo.connect(this.bassLfoGain);
    this.bassLfoGain.connect(this.bassFilterNode.frequency);

    // Configure Delay effect
    this.delayNode.delayTime.setValueAtTime(0.35, now);
    this.delayFeedback.gain.setValueAtTime(0.45, now);
    this.delayMixNode.gain.setValueAtTime(0.3, now); // 30% wet mix default

    // Configure Vibrato LFO
    this.vibratoLfo.frequency.setValueAtTime(6.0, now);
    this.vibratoGain.gain.setValueAtTime(0, now); // off initially

    // Configure Drum Bus Nodes
    this.drumLowShelfFilter.type = 'lowshelf';
    this.drumLowShelfFilter.frequency.setValueAtTime(80, now);
    this.drumLowShelfFilter.gain.setValueAtTime(this.drumLowBoost * 15, now);
    this.drumMasterGain.gain.setValueAtTime(this.drumVolume * (this.drumGain * 1.5), now);

    // Configure Right-Hand Lead wave sources
    this.osc.type = this.currentWaveform;
    this.osc.frequency.setValueAtTime(this.currentFrequency, now);
    
    this.osc2.type = 'sawtooth';
    this.osc2.frequency.setValueAtTime(this.currentFrequency * 1.006, now); // Detuned chorus
    this.osc2Gain.gain.setValueAtTime(0.15, now); // Reduced from 0.3 to 0.15 for smooth clean chorus

    this.subOsc.type = 'triangle';
    this.subOsc.frequency.setValueAtTime(this.currentFrequency / 2.0, now);
    this.subOscGain.gain.setValueAtTime(0.12, now); // Reduced from 0.2 to 0.12 to prevent sub-lead clutter

    this.gainNode.gain.setValueAtTime(0.0, now); // start silent

    // Configure Left-Hand Bass wave sources (Triangle + Sawtooth chorus for Epic Clouds)
    this.bassOsc.type = 'triangle'; // warm core pad
    this.bassOsc.frequency.setValueAtTime(55, now); // A1 bass frequency

    this.bassOsc2.type = 'sawtooth'; // rich harmonics
    this.bassOsc2.frequency.setValueAtTime(55.25, now); // detuned chorus for cloud wideness

    this.bassOscGain.gain.setValueAtTime(0.0, now); // start silent

    // Configure Master Gain
    this.masterGainNode.gain.setValueAtTime(0.8, now);

    if (this.pannerNode) {
      this.pannerNode.pan.setValueAtTime(0.0, now);
    }

    // --- Configure Professional Equalizer & Dynamics Compressor ---
    // Right-Hand Lead HPF: Filter out muddy low frequencies below 160Hz to prevent low-end clash
    this.leadHpfNode = this.ctx.createBiquadFilter();
    this.leadHpfNode.type = 'highpass';
    this.leadHpfNode.frequency.setValueAtTime(160, now);
    this.leadHpfNode.Q.setValueAtTime(0.707, now);

    // Right-Hand Lead High Shelf EQ: Tame harsh, peaky frequencies above 4500Hz for a smooth premium silk texture
    this.leadEqNode = this.ctx.createBiquadFilter();
    this.leadEqNode.type = 'highshelf';
    this.leadEqNode.frequency.setValueAtTime(4500, now);
    this.leadEqNode.gain.setValueAtTime(-5.5, now); // Gentle 5.5dB attenuation of ear-piercing harmonics

    // Master Glue Compressor: Glues all channels together with dynamic punch and sidechain feel
    this.masterCompressorNode = this.ctx.createDynamicsCompressor();
    this.masterCompressorNode.threshold.setValueAtTime(-17, now); // slightly lower threshold for tighter glue
    this.masterCompressorNode.knee.setValueAtTime(12, now);       // smoother knee transition
    this.masterCompressorNode.ratio.setValueAtTime(4.0, now);     // 4:1 ratio for solid electronic record cohesion
    this.masterCompressorNode.attack.setValueAtTime(0.012, now);  // 12ms attack preserves punch transients perfectly
    this.masterCompressorNode.release.setValueAtTime(0.14, now);  // 140ms release is ideal for 110BPM groove pumping

    // --- Connect Audio Graph ---
    // 1. Vibrato LFO connects to Right-hand pitches
    this.vibratoLfo.connect(this.vibratoGain);
    this.vibratoGain.connect(this.osc.frequency);
    this.vibratoGain.connect(this.osc2.frequency);
    this.vibratoGain.connect(this.subOsc.frequency);

    // 2. Right-Hand routing: Oscs -> Filter -> Lead HPF -> Lead EQ -> GainNode
    this.osc.connect(this.filterNode);
    
    this.osc2.connect(this.osc2Gain);
    this.osc2Gain.connect(this.filterNode);

    this.subOsc.connect(this.subOscGain);
    this.subOscGain.connect(this.filterNode);

    // Connect right hand filter through Equalization strip to GainNode
    this.filterNode.connect(this.leadHpfNode);
    this.leadHpfNode.connect(this.leadEqNode);
    this.leadEqNode.connect(this.gainNode);

    // 3. Left-Hand routing: BassOsc -> BassFilter -> BassHPF -> BassGainNode -> BassSidechainGain
    this.bassHpfNode.type = 'highpass';
    this.bassHpfNode.frequency.setValueAtTime(38, now);
    this.bassSidechainGain.gain.setValueAtTime(1.0, now);

    this.bassOsc.connect(this.bassFilterNode);
    this.bassOsc2.connect(this.bassFilterNode);
    this.bassFilterNode.connect(this.bassHpfNode);
    this.bassHpfNode.connect(this.bassOscGain);
    this.bassOscGain.connect(this.bassSidechainGain);

    // 4. Mix both right-hand lead and left-hand bass into master Analyser
    this.gainNode.connect(this.analyserNode);
    this.bassSidechainGain.connect(this.analyserNode);

    // Mix drum bus into master Analyser so it gets visualized and panned
    if (this.drumLowShelfFilter && this.drumMasterGain) {
      this.drumLowShelfFilter.connect(this.drumMasterGain);
      this.drumMasterGain.connect(this.analyserNode);
    }

    // 5. Connect Delay loop on Right-Hand signal
    this.gainNode.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.delayMixNode);
    this.delayMixNode.connect(this.analyserNode);

    // Connect Left-Hand Bass into the delay Mix for spacious, airy stereo pad reflection
    this.bassDelayGain = this.ctx.createGain();
    this.bassDelayGain.gain.setValueAtTime(0.25, now); // 25% dry/wet send to delay lines
    this.bassSidechainGain.connect(this.bassDelayGain);
    this.bassDelayGain.connect(this.delayNode);

    // 6. Connect Analyser -> Panner -> MasterGain -> Master Compressor -> Destination
    if (this.pannerNode) {
      this.analyserNode.connect(this.pannerNode);
      this.pannerNode.connect(this.masterGainNode);
    } else {
      this.analyserNode.connect(this.masterGainNode);
    }
    
    if (this.masterCompressorNode) {
      this.masterGainNode.connect(this.masterCompressorNode);
      this.masterCompressorNode.connect(this.ctx.destination);
    } else {
      this.masterGainNode.connect(this.ctx.destination);
    }

    // Start all sound generator clock sources
    this.vibratoLfo.start(now);
    this.osc.start(now);
    this.osc2.start(now);
    this.subOsc.start(now);
    this.bassOsc.start(now);
    this.bassOsc2.start(now);
    this.bassLfo.start(now);
    
    this.isPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.05;

    // Start master beat clock scheduler (25ms interval check)
    this.startMasterScheduler();
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  public isInitialized(): boolean {
    return this.ctx !== null;
  }

  /**
   * Resumes the AudioContext if suspended
   */
  public async resume() {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /**
   * Sets the synthesizer's primary waveform
   */
  public setWaveform(waveform: WaveformType) {
    this.currentWaveform = waveform;
    if (this.osc) {
      this.osc.type = waveform;
    }
  }

  /**
   * Sets right play mode parameters
   */
  public setPerformanceModes(
    leftMode: 'drone' | 'pulse',
    rightMode: 'arp' | 'stepwise' | 'thirdLeaps' | 'jazzLoop' | 'harmonicIntervals' | 'blockChords' | 'auto',
    rhythm: 'triplets' | 'front16th' | 'back16th' | 'four16ths' | 'dotted' | 'syncopated' | 'random'
  ) {
    this.leftPlayMode = leftMode;
    this.rightPlayMode = rightMode;
    this.rhythmModel = rhythm;
  }

  /**
   * Sets the scale & harmonization params dynamically
   */
  public setScaleParams(
    system: 'classical' | 'church' | 'jazz' | 'eastern',
    mode: 'major' | 'minor' | 'harmonic_minor' | 'melodic_minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian' | 'lydian_dominant' | 'altered' | 'diminished' | 'super_locrian' | 'gong' | 'shang' | 'jue' | 'zhi' | 'yu',
    root: 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B',
    degree: number,
    autoProg: boolean
  ) {
    this.harmonicSystem = system;
    this.scaleMode = mode;
    this.scaleRoot = root;
    this.activeChordDegree = degree;
    this.autoChordProgression = autoProg;
  }

  /**
   * Syncs whether hands are currently tracked on screen
   */
  public setHandsPresence(leftActive: boolean, rightActive: boolean) {
    this.leftHandActive = leftActive;
    this.rightHandActive = rightActive;
  }

  /**
   * Sets the target frequency (Hz) of the right-hand tonic note with scale quantization.
   */
  public setFrequency(freq: number, immediate = false) {
    const raw = Math.max(130, Math.min(2200, freq));
    this.rawBaseFreq = raw;
    this.currentFrequency = raw;
  }

  /**
   * Sets the target frequency of the left-hand bass drone with scale quantization.
   */
  public setLeftBassFrequency(freq: number) {
    // Keep in deep bass registers (35Hz to 280Hz, exactly 3 octaves)
    const raw = Math.max(35, Math.min(280, freq));
    this.rawLeftBassFreq = raw;
  }

  /**
   * Returns a quantized deep bass frequency based on the left hand's Y height
   * and the current scale degrees across two octaves.
   */
  public getLeftHandQuantizedBassFreq(yHeight: number): number {
    const ROOT_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const rootIdx = ROOT_KEYS.indexOf(this.scaleRoot);
    const scale = SCALES[this.scaleMode] || SCALES['minor'];
    const N = scale.length;
    
    // Cover 2 octaves of deep resonant bass (starting at Octave 2)
    const totalSteps = N * 2;
    const step = Math.max(0, Math.min(totalSteps - 1, Math.floor(yHeight * totalSteps)));
    
    const octaveOffset = Math.floor(step / N);
    const deg = step % N;
    const semitone = scale[deg];
    
    const octave = 2 + octaveOffset;
    const bassMidi = 12 * octave + rootIdx + semitone;
    return 440 * Math.pow(2, (bassMidi - 69) / 12);
  }

  /**
   * Sets the real-time vertical Y height and velocity of the left hand,
   * immediately modulating the bass oscillator pitch if sliding!
   */
  public updateLeftHandLiveParams(yHeight: number, velocity: number) {
    this.leftHandY = Math.max(0, Math.min(1, yHeight));
    this.leftHandVelocity = Math.max(0, velocity);

    if (this.leftHandActive) {
      const scale = SCALES[this.scaleMode] || SCALES['minor'];
      const N = scale.length;
      const totalSteps = N * 2;
      const step = Math.max(0, Math.min(totalSteps - 1, Math.floor(this.leftHandY * totalSteps)));
      const deg = step % N;
      this.activeChordDegree = deg + 1;
    }

    if (this.leftHandActive && this.ctx && this.bassOsc && this.bassOsc2) {
      const now = this.ctx.currentTime;
      if (this.leftHandVelocity > 0.08) {
        const targetFreq = this.getLeftHandQuantizedBassFreq(this.leftHandY);
        // Gently/instantly slide to the new quantized frequency for extremely sensitive response
        this.bassOsc.frequency.setTargetAtTime(targetFreq, now, 0.02);
        this.bassOsc2.frequency.setTargetAtTime(targetFreq * 1.004, now, 0.02);
      }
    }
  }

  /**
   * Updates the tempo of the engine dynamically (60 to 160 BPM)
   */
  public setBpm(bpm: number) {
    this.tempoBpm = Math.max(60, Math.min(160, bpm));
  }

  /**
   * Starts the look-ahead beat scheduler.
   */
  private startMasterScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }

    this.schedulerInterval = setInterval(() => {
      if (!this.ctx) return;

      // Look ahead and schedule notes for the next beat
      while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
        this.scheduleNextBeat(this.beatCounter, this.nextNoteTime);
        
        const beatDuration = 60.0 / this.tempoBpm;
        this.nextNoteTime += beatDuration;
        this.beatCounter++;
      }
    }, 25);
  }

  /**
   * Dynamic quantization to the active scale or chord tones based on Root and Mode.
   */
  public getQuantizedFreq(rawFreq: number, useChordOnly: boolean): number {
    const ROOT_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const rootIdx = ROOT_KEYS.indexOf(this.scaleRoot);
    const scale = SCALES[this.scaleMode] || SCALES['minor'];
    const N = scale.length;
    
    // Convert rawFreq to MIDI note number
    const midiVal = 12 * Math.log2(rawFreq / 440) + 69;
    
    // Find candidate MIDI notes in standard octaves (2 to 8, covering lead and bass ranges)
    let bestMidi = Math.round(midiVal);
    let minDiff = 999;
    
    // If useChordOnly is true, we restrict notes strictly to diatonic 1st, 3rd, 5th, or 7th of the active degree!
    const allowedDegrees = useChordOnly 
      ? [
          (this.activeChordDegree - 1) % N,
          (this.activeChordDegree - 1 + 2) % N,
          (this.activeChordDegree - 1 + 4) % N,
          (this.activeChordDegree - 1 + 6) % N
        ]
      : Array.from({ length: N }, (_, i) => i);
      
    for (let o = 2; o <= 8; o++) {
      for (const deg of allowedDegrees) {
        const semitone = scale[deg];
        const noteMidi = 12 * o + rootIdx + semitone;
        
        const diff = Math.abs(midiVal - noteMidi);
        if (diff < minDiff) {
          minDiff = diff;
          bestMidi = noteMidi;
        }
      }
    }
    
    // Convert midi note back to frequency
    return 440 * Math.pow(2, (bestMidi - 69) / 12);
  }

  /**
   * Returns the exact fundamental bass frequency for the active chord degree.
   */
  public getActiveChordBassFreq(octaveOffset: number = 0): number {
    const ROOT_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const rootIdx = ROOT_KEYS.indexOf(this.scaleRoot);
    const scale = SCALES[this.scaleMode] || SCALES['minor'];
    const N = scale.length;
    
    const deg = (this.activeChordDegree - 1) % N;
    const semitone = scale[deg];
    
    // Standard deep bass octave is Octave 2
    const octave = 2 + octaveOffset;
    const bassMidi = 12 * octave + rootIdx + semitone;
    return 440 * Math.pow(2, (bassMidi - 69) / 12);
  }

  /**
   * Returns a standard diatonic chord progression loop based on selected system
   */
  private getChordProgressionForSystem(): number[] {
    switch (this.harmonicSystem) {
      case 'classical':
        // Classic emotional progression: i - VI - iv - V (or I - vi - IV - V)
        return [1, 6, 4, 5];
      case 'church':
        // Modal Dorian vibe: i - IV - bVII - i (1, 4, 7, 1) or i - ii - v - IV
        return [1, 4, 7, 1];
      case 'jazz':
        // Jazz ii-V-I-VI: 2 - 5 - 1 - 6
        return [2, 5, 1, 6];
      case 'eastern':
        // Eastern pentatonic Gong-Zhi-Yu-Shang: 1 - 4 - 5 - 2
        return [1, 4, 5, 2];
      default:
        return [1, 6, 4, 5];
    }
  }

  /**
   * Precise scheduling of notes within a single beat using Web Audio timelines
   */
  private scheduleNextBeat(beatIndex: number, beatStartTime: number) {
    if (!this.ctx) return;

    const beatDuration = 60.0 / this.tempoBpm;
    
    // --- AUTO CHORD PROGRESSION CYCLE ---
    // If the left hand is active, we dynamically unify the chord progression to match the left hand's scale degree in real-time.
    if (this.leftHandActive) {
      const scale = SCALES[this.scaleMode] || SCALES['minor'];
      const N = scale.length;
      const totalSteps = N * 2;
      const step = Math.max(0, Math.min(totalSteps - 1, Math.floor(this.leftHandY * totalSteps)));
      const deg = step % N;
      this.activeChordDegree = deg + 1;
    } else if (this.autoChordProgression) {
      const progression = this.getChordProgressionForSystem();
      const progressionStep = Math.floor(beatIndex / 4) % progression.length;
      this.activeChordDegree = progression[progressionStep];
    }
    
    // 1. Capture right hand tonic pitch only at the start of the beat
    this.activeBaseFreq = this.rawBaseFreq;
    
    // 2. Capture left hand bass pitch using the root note of the active chord!
    this.activeLeftBassFreq = this.getActiveChordBassFreq();

    // Determine the active rhythm model for this beat
    let currentModel = this.rhythmModel;
    if (this.leftHandActive && this.leftHandVelocity > 0.8) {
      currentModel = 'four16ths'; // Instantly trigger wild 16th-note arpeggiator fill!
    } else if (currentModel === 'random') {
      if (this.drumEnabled) {
        // High rhythmic alignment (80%+) coupling with the selected drum groove
        switch (this.drumPattern) {
          case 'disco':
            currentModel = Math.random() < 0.5 ? 'four16ths' : 'syncopated';
            break;
          case 'techno':
            currentModel = 'four16ths'; // Driving techno 16th beats
            break;
          case 'funk':
            currentModel = Math.random() < 0.5 ? 'syncopated' : 'back16th';
            break;
          case 'reggae':
            currentModel = 'dotted';
            break;
          default:
            currentModel = 'syncopated';
        }
      } else {
        const models: ('triplets' | 'front16th' | 'back16th' | 'four16ths' | 'dotted' | 'syncopated')[] = [
          'triplets', 'front16th', 'back16th', 'four16ths', 'dotted', 'syncopated'
        ];
        currentModel = models[Math.floor(beatIndex / 2) % models.length];
      }
    }

    // Determine Right Hand Playback Mode early so we can adjust arpeggiator density
    let activeMode = this.rightPlayMode;
    if (activeMode === 'auto') {
      switch (this.drumPattern) {
        case 'disco':
          activeMode = 'arp';
          break;
        case 'techno':
          activeMode = 'stepwise';
          break;
        case 'funk':
          activeMode = 'thirdLeaps';
          break;
        case 'reggae':
          activeMode = 'blockChords';
          break;
        default:
          activeMode = 'arp';
      }
    }

    // Get time-offsets (relative to beat start) and sound durations for each step of the pattern
    let offsets: number[] = [0];
    let stepDurations: number[] = [0.8]; // fractions of beat duration

    // Sparsify right-hand accompaniment patterns so they are not too dense
    const isBlockChord = (activeMode === 'blockChords');
    // Only sparsify weak beats if rhythmModel is set to 'random'.
    // If a specific rhythm model is selected/gestured, play it continuously on every beat for precise physical feedback!
    const isWeakBeat = (beatIndex % 2 === 1) && (this.rhythmModel === 'random');

    if (isBlockChord) {
      // Block Chords: Only trigger once on the downbeat of each beat, letting the notes sustain beautifully rather than chopping them up.
      offsets = [0];
      stepDurations = [0.85];
    } else if (isWeakBeat) {
      // For arpeggios, stepwise, leaps etc., on alternating weak beats only play the first note, creating a gorgeous spacious call-and-response feel.
      offsets = [0];
      stepDurations = [0.85];
    } else {
      // Full rhythmic subdivision only on strong beats
      switch (currentModel) {
        case 'triplets':
          offsets = [0, 1/3, 2/3];
          stepDurations = [0.22, 0.22, 0.22];
          break;
        case 'front16th':
          offsets = [0, 0.25, 0.5];
          stepDurations = [0.18, 0.18, 0.35];
          break;
        case 'back16th':
          offsets = [0, 0.5, 0.75];
          stepDurations = [0.35, 0.18, 0.18];
          break;
        case 'four16ths':
          offsets = [0, 0.25, 0.5, 0.75];
          stepDurations = [0.18, 0.18, 0.18, 0.18];
          break;
        case 'dotted':
          offsets = [0, 0.75];
          stepDurations = [0.6, 0.18];
          break;
        case 'syncopated':
          offsets = [0, 0.25, 0.75];
          stepDurations = [0.18, 0.38, 0.18];
          break;
      }
    }

    const scale = SCALES[this.scaleMode] || SCALES['minor'];
    const N = scale.length;
    const ROOT_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const rootIdx = ROOT_KEYS.indexOf(this.scaleRoot);

    // --- SCHEDULE RIGHT HAND MELODIC NOTES ---
    if (this.rightHandActive && this.osc && this.osc2 && this.subOsc && this.gainNode) {
      // Build dynamic arpeggiator/melody stretch scales based on rightHandZ (hand opening/stretch)
      let dynamicAttackMultiplier = 1.0;
      let handOpeningRangeOctaves = 1; // expand arpeggios based on hand opening

      if (this.rightHandZ < 0.35) {
        dynamicAttackMultiplier = 0.7; // Fist clench: softer volume
        handOpeningRangeOctaves = 1;
      } else if (this.rightHandZ >= 0.75) {
        dynamicAttackMultiplier = 1.3; // Hand wide open: loud and bright
        handOpeningRangeOctaves = 3;   // Sweeps across 3 octaves!
      } else {
        handOpeningRangeOctaves = 2;   // Normal play
      }

      offsets.forEach((offset, idx) => {
        const noteTime = beatStartTime + (offset * beatDuration);
        const noteLength = stepDurations[idx] * beatDuration;

        if (noteTime < this.ctx!.currentTime) return;

        // Reggae Skank Block Chords trigger strictly on offbeats (beats 2 and 4, i.e., beatIndex % 2 === 1)
        if (activeMode === 'blockChords' && this.drumPattern === 'reggae' && this.drumEnabled && beatIndex % 2 === 0) {
          return; // Skip on-beats for reggae skanks!
        }

        // Calculate pitch frequency based on the selected mode
        let freq1 = 220;
        let freq2 = 220;
        let freq3 = 110;

        // Get the octave height relative to the hand position
        const targetMidiCenter = Math.round(12 * Math.log2(this.activeBaseFreq / 440) + 69);
        const centerOctave = Math.max(3, Math.min(6, Math.floor(targetMidiCenter / 12)));

        const allowedDegrees = [
          (this.activeChordDegree - 1) % N,
          (this.activeChordDegree - 1 + 2) % N,
          (this.activeChordDegree - 1 + 4) % N,
          (this.activeChordDegree - 1 + 6) % N
        ];

        switch (activeMode) {
          case 'arp': {
            // Arpeggiator: cycles sequentially or randomly through active chord notes
            let deg = allowedDegrees[0];
            const useRandom = Math.random() < this.randomMelodyMix;
            
            if (useRandom) {
              // 80% chord tones, 20% general scale tones for high alignment + pleasant jazz improvisation!
              if (Math.random() < 0.8) {
                deg = allowedDegrees[Math.floor(Math.random() * allowedDegrees.length)];
              } else {
                deg = Math.floor(Math.random() * N);
              }
            } else {
              deg = allowedDegrees[this.stepCounter % allowedDegrees.length];
            }

            // Stagger octaves based on stepCounter and handOpeningRangeOctaves
            const octaveShift = (this.stepCounter % handOpeningRangeOctaves);
            const finalOctave = centerOctave + octaveShift;
            
            const semitone = scale[deg];
            const noteMidi = 12 * finalOctave + rootIdx + semitone;
            
            freq1 = 440 * Math.pow(2, (noteMidi - 69) / 12);
            freq2 = freq1 * 1.006; // detune wideness
            freq3 = freq1 * 0.5;   // sub octave
            this.stepCounter++;
            break;
          }

          case 'stepwise': {
            // Stepwise motion (级进): walks stepwise up/down the active scale
            if (this.stepwiseDegree === undefined) {
              this.stepwiseDegree = (this.activeChordDegree - 1) % N;
            }
            const rand = Math.random();
            if (rand < 0.45) {
              this.stepwiseDegree = (this.stepwiseDegree + 1) % N;
            } else if (rand < 0.9) {
              this.stepwiseDegree = (this.stepwiseDegree - 1 + N) % N;
            } // 10% chance to stay
            
            const semitone = scale[this.stepwiseDegree];
            const noteMidi = 12 * centerOctave + rootIdx + semitone;
            
            freq1 = 440 * Math.pow(2, (noteMidi - 69) / 12);
            freq2 = freq1 * 1.006;
            freq3 = freq1 * 0.5;
            break;
          }

          case 'thirdLeaps': {
            // Third leaps (三度跳进): alternated melodic leaps of thirds and seconds
            if (this.thirdLeapsDegree === undefined) {
              this.thirdLeapsDegree = (this.activeChordDegree - 1) % N;
            }
            const isLeap = (this.stepCounter % 2 === 0);
            if (isLeap) {
              this.thirdLeapsDegree = (this.thirdLeapsDegree + 2) % N; // Leap up a third!
            } else {
              this.thirdLeapsDegree = (this.thirdLeapsDegree - 1 + N) % N; // Step down a second!
            }

            const semitone = scale[this.thirdLeapsDegree];
            const noteMidi = 12 * centerOctave + rootIdx + semitone;
            
            freq1 = 440 * Math.pow(2, (noteMidi - 69) / 12);
            freq2 = freq1 * 1.006;
            freq3 = freq1 * 0.5;
            this.stepCounter++;
            break;
          }

          case 'jazzLoop': {
            // Jazz Interval Progression Loop (爵士模进)
            const jazzOffsets = [0, 2, 4, 6, 7, 6, 4, 2]; // 1-3-5-7 chord tone motif
            const chordRootIdx = (this.activeChordDegree - 1) % N;
            const offsetStep = this.stepCounter % jazzOffsets.length;
            const targetScaleDeg = (chordRootIdx + jazzOffsets[offsetStep]) % N;
            
            const semitone = scale[targetScaleDeg];
            const noteMidi = 12 * centerOctave + rootIdx + semitone;
            
            freq1 = 440 * Math.pow(2, (noteMidi - 69) / 12);
            freq2 = freq1 * 1.005;
            freq3 = freq1 * 0.5;
            this.stepCounter++;
            break;
          }

          case 'harmonicIntervals': {
            // Harmonic Intervals / Dyads (和声音程): plays delicious diatonic dyads
            const deg1 = allowedDegrees[this.stepCounter % allowedDegrees.length];
            const deg2 = (deg1 + 2) % N; // diatonic third above
            
            const noteMidi1 = 12 * centerOctave + rootIdx + scale[deg1];
            const noteMidi2 = 12 * centerOctave + rootIdx + scale[deg2] + (deg2 < deg1 ? 12 : 0);
            
            freq1 = 440 * Math.pow(2, (noteMidi1 - 69) / 12);
            freq2 = 440 * Math.pow(2, (noteMidi2 - 69) / 12); // Osc2 plays the second dyad note!
            freq3 = freq1 * 0.5;
            this.stepCounter++;
            break;
          }

          case 'blockChords': {
            // Block Chords (柱式和弦): plays rich solid three-voice block triads
            const deg1 = (this.activeChordDegree - 1) % N;
            const deg2 = (deg1 + 2) % N;
            const deg3 = (deg1 + 4) % N;
            
            const midi1 = 12 * centerOctave + rootIdx + scale[deg1];
            const midi2 = 12 * centerOctave + rootIdx + scale[deg2] + (deg2 < deg1 ? 12 : 0);
            const midi3 = 12 * centerOctave + rootIdx + scale[deg3] + (deg3 < deg1 ? 12 : 0);
            
            freq1 = 440 * Math.pow(2, (midi1 - 69) / 12);
            freq2 = 440 * Math.pow(2, (midi2 - 69) / 12); // Third
            freq3 = 440 * Math.pow(2, (midi3 - 69) / 12); // Fifth
            break;
          }
        }

        // Apply calculated frequencies to synthesizer oscillators
        this.osc!.frequency.setValueAtTime(freq1, noteTime);
        this.osc2!.frequency.setValueAtTime(freq2, noteTime);
        this.subOsc!.frequency.setValueAtTime(freq3, noteTime);

        // Snappy Vaporwave ADSR volume envelope with hand opening dynamic multiplier
        // Scale down slightly (0.45 multiplier) to keep the arpeggiated synth lead sitting comfortably in the mix without clipping
        const activeVol = Math.max(0, Math.min(1.0, this.currentVolume * dynamicAttackMultiplier * 0.45));
        this.gainNode!.gain.setValueAtTime(0.01, noteTime);
        this.gainNode!.gain.linearRampToValueAtTime(activeVol, noteTime + 0.015); // sharp attack
        this.gainNode!.gain.setValueAtTime(activeVol, noteTime + noteLength - 0.02);
        this.gainNode!.gain.linearRampToValueAtTime(0.0, noteTime + noteLength); // clean release
      });
    }

    // --- SCHEDULE LEFT HAND BASS SYNTH ---
    // If the drum machine is NOT enabled, fall back to the old continuous drone or pulse.
    // If the drum machine is enabled, bass is scheduled in perfect sync at the 16th-note step level below!
    if (!this.drumEnabled && this.leftHandActive && this.bassOsc && this.bassOsc2 && this.bassOscGain) {
      if (this.leftHandVelocity > 0.8) {
        // Wild 16-note arpeggio Bass Fill!
        const fillOffsets = [0, 0.25, 0.5, 0.75];
        const fillDurations = [0.18, 0.18, 0.18, 0.18];
        const bassBaseFreq = this.leftHandVelocity > 0.08
          ? this.getLeftHandQuantizedBassFreq(this.leftHandY)
          : this.activeLeftBassFreq;

        fillOffsets.forEach((offset, idx) => {
          const stepTime = beatStartTime + (offset * beatDuration);
          const noteDuration = fillDurations[idx] * beatDuration;

          if (stepTime >= this.ctx!.currentTime) {
            // Arpeggiate the bass notes musically!
            const pitchMultipliers = [1.0, 1.5, 2.0, 1.33];
            const stepFreq = bassBaseFreq * pitchMultipliers[(idx + beatIndex) % 4];

            this.bassOsc!.frequency.setValueAtTime(stepFreq, stepTime);
            this.bassOsc2!.frequency.setValueAtTime(stepFreq * 1.004, stepTime);

            // Staccato envelope for wild fill
            this.bassOscGain!.gain.setValueAtTime(0.01, stepTime);
            this.bassOscGain!.gain.linearRampToValueAtTime(0.75, stepTime + 0.01);
            this.bassOscGain!.gain.setValueAtTime(0.75, stepTime + noteDuration - 0.015);
            this.bassOscGain!.gain.linearRampToValueAtTime(0.0, stepTime + noteDuration);
          }
        });
      } else if (this.leftPlayMode === 'pulse') {
        // Pulse Mode: Play short staccato 110 BPM bass stabs right on the beat
        const pulseTime = beatStartTime;
        const pulseDuration = 0.22 * beatDuration; // short duration (staccato)

        if (pulseTime >= this.ctx.currentTime) {
          const bassFreq = this.leftHandVelocity > 0.08
            ? this.getLeftHandQuantizedBassFreq(this.leftHandY)
            : this.activeLeftBassFreq;
          this.bassOsc.frequency.setValueAtTime(bassFreq, pulseTime);
          this.bassOsc2.frequency.setValueAtTime(bassFreq * 1.004, pulseTime);

          // Staccato bass envelope
          this.bassOscGain.gain.setValueAtTime(0.01, pulseTime);
          this.bassOscGain.gain.linearRampToValueAtTime(0.6, pulseTime + 0.01); // sharp attack
          this.bassOscGain.gain.setValueAtTime(0.6, pulseTime + pulseDuration - 0.015);
          this.bassOscGain.gain.linearRampToValueAtTime(0.0, pulseTime + pulseDuration); // short decay
        }
      } else {
        // Drone Mode: Sustained bass is continuous! Hand coordinates set continuous gain & pitch
        this.updateDroneBass(beatStartTime);
      }
    } else if (!this.leftHandActive && this.bassOscGain) {
      // Smoothly silence left bass if left hand leaves screen
      this.bassOscGain.gain.setTargetAtTime(0.0, beatStartTime, 0.05);
    }

    // --- SCHEDULE DRUM MACHINE BEATS & SYNCHRONIZED RHYTHMIC BASS ---
    if (this.drumEnabled) {
      for (let stepOfBeat = 0; stepOfBeat < 4; stepOfBeat++) {
        const stepTime = beatStartTime + (stepOfBeat * 0.25 * beatDuration);
        if (stepTime >= this.ctx!.currentTime) {
          const stepIndex = ((beatIndex % 4) * 4 + stepOfBeat) % 16;
          
          // 1. Play drum step (Includes Kicks, Snares, Hats based on active Style and Rhythm Layer)
          this.playDrumStep(stepIndex, stepTime, beatIndex);

          // 2. Play synchronized rhythmic bass step!
          // Bass notes trigger in perfect lockstep with the kick and style syncopations!
          this.playBassStep(stepIndex, stepTime, beatIndex, beatDuration * 0.25);
        }
      }
    }
  }

  /**
   * Triggers a staccato, punchy bass note synchronized with the drum machine sixteenth-note steps
   */
  private playBassStep(stepIndex: number, stepTime: number, beatIndex: number, stepDuration: number) {
    if (!this.ctx || !this.bassOsc || !this.bassOsc2 || !this.bassOscGain) return;

    // Check if bass should play on this step for the current style and rhythmLayer
    const shouldPlay = this.shouldBassPlayOnStep(this.drumPattern, this.rhythmLayer, stepIndex);
    if (!shouldPlay) {
      // Fade out gain quickly to prevent hanging notes
      this.bassOscGain.gain.setValueAtTime(this.bassOscGain.gain.value, stepTime);
      this.bassOscGain.gain.linearRampToValueAtTime(0.0, stepTime + 0.01);
      return;
    }

    // Retrieve active bass frequency. Left hand Y coordinate modulates pitch smoothly!
    let bassFreq = this.activeLeftBassFreq || this.rawLeftBassFreq;
    if (this.leftHandActive) {
      bassFreq = this.getLeftHandQuantizedBassFreq(this.leftHandY);
    }

    // Classic disco bass octave jump logic:
    // On eighth offbeats (steps 2, 6, 10, 14), let the bass bounce one octave higher!
    if (this.drumPattern === 'disco' && (stepIndex === 2 || stepIndex === 6 || stepIndex === 10 || stepIndex === 14)) {
      bassFreq = bassFreq * 2.0;
    }

    // Apply pitch frequency immediately
    this.bassOsc.frequency.setValueAtTime(bassFreq, stepTime);
    this.bassOsc2.frequency.setValueAtTime(bassFreq * 1.004, stepTime);

    // Punchy staccato bass volume envelope (起)
    // Very fast attack to slam with the kick transient!
    this.bassOscGain.gain.cancelScheduledValues(stepTime);
    this.bassOscGain.gain.setValueAtTime(0.001, stepTime);
    
    // Gain is loud and direct!
    const maxGain = 0.55;
    this.bassOscGain.gain.linearRampToValueAtTime(maxGain, stepTime + 0.006); // 6ms lightning-fast attack!
    
    // Decay down to a soft sustain level or complete silence for extreme staccato punch
    const noteLength = stepDuration * 0.75; // 75% of step duration
    this.bassOscGain.gain.setValueAtTime(maxGain, stepTime + noteLength * 0.45);
    this.bassOscGain.gain.exponentialRampToValueAtTime(0.001, stepTime + noteLength);
  }

  /**
   * Helper to check if Kick plays on a given sixteenth step for active pattern & layer
   */
  private shouldKickPlayOnStep(pattern: string, layer: number, stepIndex: number): boolean {
    switch (pattern) {
      case 'disco':
        // Disco layers:
        // Layer 0 to 4: Steady 4-on-the-floor
        // Layer 5: Heavy double-kick climax
        if (layer === 5) {
          return stepIndex === 0 || stepIndex === 2 || stepIndex === 4 || stepIndex === 8 || stepIndex === 10 || stepIndex === 12;
        }
        return stepIndex % 4 === 0;

      case 'techno':
        // Techno layers:
        // Solid driving 4-on-the-floor kick across all progression stages
        return stepIndex % 4 === 0;

      case 'funk':
        // Funk layers (syncopated breakbeat):
        // Layer 0..2: Simple syncopated kicks
        // Layer 3: Extra offbeat kick
        // Layer 4: Full syncopated breakbeat kicks
        // Layer 5: High-intensity double breakbeat kicks
        if (layer <= 2) {
          return stepIndex === 0 || stepIndex === 8 || stepIndex === 10;
        }
        if (layer === 3) {
          return stepIndex === 0 || stepIndex === 2 || stepIndex === 8 || stepIndex === 10;
        }
        if (layer === 4) {
          return stepIndex === 0 || stepIndex === 2 || stepIndex === 9 || stepIndex === 10;
        }
        return stepIndex === 0 || stepIndex === 2 || stepIndex === 6 || stepIndex === 8 || stepIndex === 10 || stepIndex === 14;

      case 'reggae':
        // Reggae layers:
        // Layer 0..2: Classic One-Drop on Beat 3 (step 8)
        // Layer 3: Double Drop
        // Layer 4..5: Heavy Reggae Steppers
        if (layer <= 2) {
          return stepIndex === 8;
        }
        if (layer === 3) {
          return stepIndex === 8 || stepIndex === 14;
        }
        if (layer === 4) {
          return stepIndex === 0 || stepIndex === 8 || stepIndex === 14;
        }
        return stepIndex === 0 || stepIndex === 8 || stepIndex === 10 || stepIndex === 14;
        
      default:
        return stepIndex % 4 === 0;
    }
  }

  /**
   * Helper to check if Bass plays on a given sixteenth step for active pattern & layer
   */
  private shouldBassPlayOnStep(pattern: string, layer: number, stepIndex: number): boolean {
    if (!this.leftHandActive) return false;

    switch (pattern) {
      case 'disco':
        // Disco bass:
        // Layer 0..2: Locked exactly on Kick steps (0, 4, 8, 12)
        // Layer 3..4: Eighth notes (0, 2, 4, 6, 8, 10, 12, 14) for octave bouncing
        // Layer 5: Heavy sixteenth-note rolling bass line!
        if (layer <= 2) {
          return stepIndex % 4 === 0;
        }
        if (layer === 3 || layer === 4) {
          return stepIndex % 2 === 0;
        }
        return true;

      case 'techno':
        // Techno bass:
        // Layer 0: Locked exactly with Kick (0, 4, 8, 12)
        // Layer 1: Rolling sixteenths (0, 1, 4, 5, 8, 9, 12, 13)
        // Layer 2..3: Rolling triplets (0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14)
        // Layer 4..5: Continuous driving sixteenths on all steps 0..15!
        if (layer === 0) {
          return stepIndex % 4 === 0;
        }
        if (layer === 1) {
          return stepIndex % 4 === 0 || stepIndex % 4 === 1;
        }
        if (layer === 2 || layer === 3) {
          return stepIndex % 4 === 0 || stepIndex % 4 === 1 || stepIndex % 4 === 2;
        }
        return true;

      case 'funk':
        // Funk bass (highly syncopated slap bass):
        // Layer 0: Locked with Kick (0, 8, 10)
        // Layer 1: Syncopated (0, 2, 8, 10, 12)
        // Layer 2: Syncopated backbeat (0, 2, 4, 8, 10, 12)
        // Layer 3: Double slap (0, 2, 4, 8, 9, 10, 12, 15)
        // Layer 4..5: Climax funk groove (0, 2, 4, 6, 8, 9, 10, 12, 14, 15)
        if (layer === 0) {
          return stepIndex === 0 || stepIndex === 8 || stepIndex === 10;
        }
        if (layer === 1) {
          return stepIndex === 0 || stepIndex === 2 || stepIndex === 8 || stepIndex === 10 || stepIndex === 12;
        }
        if (layer === 2) {
          return stepIndex === 0 || stepIndex === 2 || stepIndex === 4 || stepIndex === 8 || stepIndex === 10 || stepIndex === 12;
        }
        if (layer === 3) {
          return stepIndex === 0 || stepIndex === 2 || stepIndex === 4 || stepIndex === 8 || stepIndex === 9 || stepIndex === 10 || stepIndex === 12 || stepIndex === 15;
        }
        return stepIndex === 0 || stepIndex === 2 || stepIndex === 4 || stepIndex === 6 || stepIndex === 8 || stepIndex === 9 || stepIndex === 10 || stepIndex === 12 || stepIndex === 14 || stepIndex === 15;

      case 'reggae':
        // Reggae sub bass (low-frequency reggae walking bassline):
        // Layer 0..1: Simple sub walking (0, 4, 8, 12)
        // Layer 2: Syncopated sub walking (0, 3, 4, 7, 8, 11, 12)
        // Layer 3: Syncopated sub walking with delay (0, 3, 4, 7, 8, 11, 12, 14)
        // Layer 4: Full Dub-bass groove (0, 2, 3, 4, 6, 8, 10, 11, 12, 14)
        // Layer 5: Full Dub-bass groove with siren (0, 2, 3, 4, 6, 8, 10, 11, 12, 14, 15)
        if (layer <= 1) {
          return stepIndex % 4 === 0;
        }
        if (layer === 2) {
          return stepIndex === 0 || stepIndex === 3 || stepIndex === 4 || stepIndex === 7 || stepIndex === 8 || stepIndex === 11 || stepIndex === 12;
        }
        if (layer === 3) {
          return stepIndex === 0 || stepIndex === 3 || stepIndex === 4 || stepIndex === 7 || stepIndex === 8 || stepIndex === 11 || stepIndex === 12 || stepIndex === 14;
        }
        if (layer === 4) {
          return stepIndex === 0 || stepIndex === 2 || stepIndex === 3 || stepIndex === 4 || stepIndex === 6 || stepIndex === 8 || stepIndex === 10 || stepIndex === 11 || stepIndex === 12 || stepIndex === 14;
        }
        return stepIndex === 0 || stepIndex === 2 || stepIndex === 3 || stepIndex === 4 || stepIndex === 6 || stepIndex === 8 || stepIndex === 10 || stepIndex === 11 || stepIndex === 12 || stepIndex === 14 || stepIndex === 15;

      default:
        return stepIndex % 4 === 0;
    }
  }

  /**
   * Handles real-time continuous modulation of Left Hand Drone Bass (Play Mode: Drone)
   */
  private updateDroneBass(time: number) {
    if (!this.ctx || !this.bassOsc || !this.bassOsc2 || !this.bassOscGain || !this.bassFilterNode) return;

    if (this.leftHandActive && this.leftPlayMode === 'drone') {
      // Continuously set pitch based on dynamic chord bass frequency or hand Y height
      const targetFreq = this.leftHandVelocity > 0.08
        ? this.getLeftHandQuantizedBassFreq(this.leftHandY)
        : (this.activeLeftBassFreq || this.rawLeftBassFreq);
      this.bassOsc.frequency.setTargetAtTime(targetFreq, time, 0.05);
      this.bassOsc2.frequency.setTargetAtTime(targetFreq * 1.004, time, 0.05);

      // Drone volume: full continuous sustained low bass pad
      this.bassOscGain.gain.setTargetAtTime(0.5, time, 0.06);
    }
  }

  /**
   * Controls live parameters such as volume, panning, or filter sweep.
   */
  public updateLiveControls(volume: number, panning: number, cutoff: number) {
    this.currentVolume = Math.max(0, Math.min(1.0, volume));

    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Stereo Panner
    if (this.pannerNode) {
      this.pannerNode.pan.setTargetAtTime(panning, now, 0.05);
    }

    // Cutoff Filter Sweep
    if (this.filterNode) {
      const cleanCutoff = Math.max(80, Math.min(20000, cutoff));
      this.filterNode.frequency.setTargetAtTime(cleanCutoff, now, 0.05);
    }
  }

  /**
   * Applies highly distinctive retro synthesizer presets.
   */
  public applyPreset(preset: 'classic' | 'ambientPad' | 'cyberpunkLead' | 'oceanBass' | 'cosmicArp' | 'nebulaStrings' | 'arcade8Bit' | 'glassBell' | 'darkDrone' | 'radioStatic') {
    this.currentPreset = preset;
    if (!this.ctx || !this.osc || !this.osc2Gain || !this.subOscGain || !this.bassOsc) return;

    const targetTime = this.ctx.currentTime;
    
    // Reset defaults
    this.osc.type = 'sine';
    this.osc2!.type = 'sine';
    this.subOsc!.type = 'sine';
    this.bassOsc.type = 'square';

    switch (preset) {
      case 'classic':
        this.osc.type = 'sine';
        this.osc2Gain.gain.setTargetAtTime(0.0, targetTime, 0.05);
        this.subOscGain.gain.setTargetAtTime(0.0, targetTime, 0.05);
        this.updateDelay(false, 0.3, 0.0);
        this.updateVibrato(false, 6, 0);
        break;

      case 'ambientPad':
        this.osc.type = 'triangle';
        this.osc2!.type = 'sine';
        this.osc2Gain.gain.setTargetAtTime(0.4, targetTime, 0.05);
        this.subOsc!.type = 'sine';
        this.subOscGain.gain.setTargetAtTime(0.3, targetTime, 0.05);
        this.updateDelay(true, 0.55, 0.65);
        this.updateVibrato(true, 4.0, 15);
        break;

      case 'cyberpunkLead':
        this.osc.type = 'sawtooth';
        this.osc2!.type = 'sawtooth';
        this.osc2Gain.gain.setTargetAtTime(0.55, targetTime, 0.05);
        this.subOsc!.type = 'square';
        this.subOscGain.gain.setTargetAtTime(0.35, targetTime, 0.05);
        this.updateDelay(true, 0.3, 0.45);
        this.updateVibrato(true, 7.5, 25);
        break;

      case 'oceanBass':
        this.osc.type = 'sine';
        this.osc2Gain.gain.setTargetAtTime(0.0, targetTime, 0.05);
        this.subOsc!.type = 'triangle';
        this.subOscGain.gain.setTargetAtTime(0.8, targetTime, 0.05);
        this.setFilterCutoff(350);
        this.updateVibrato(false, 3, 0);
        break;

      case 'cosmicArp':
        this.osc.type = 'triangle';
        this.osc2!.type = 'sine';
        this.osc2Gain.gain.setTargetAtTime(0.3, targetTime, 0.05);
        this.subOsc!.type = 'sine';
        this.subOscGain.gain.setTargetAtTime(0.18, targetTime, 0.05);
        this.updateDelay(true, 0.4, 0.62);
        this.updateVibrato(true, 5.0, 15);
        break;

      case 'nebulaStrings':
        this.osc.type = 'sawtooth';
        this.osc2!.type = 'sawtooth';
        this.osc2Gain.gain.setTargetAtTime(0.5, targetTime, 0.05);
        this.subOsc!.type = 'sawtooth';
        this.subOscGain.gain.setTargetAtTime(0.3, targetTime, 0.05);
        this.updateDelay(true, 0.6, 0.55);
        this.updateVibrato(true, 3.8, 20);
        break;

      case 'arcade8Bit':
        this.osc.type = 'square';
        this.osc2Gain.gain.setTargetAtTime(0.0, targetTime, 0.05);
        this.subOscGain.gain.setTargetAtTime(0.0, targetTime, 0.05);
        this.updateDelay(true, 0.18, 0.3);
        this.updateVibrato(true, 8.5, 25);
        break;

      case 'glassBell':
        this.osc.type = 'sine';
        this.osc2!.type = 'sine';
        this.osc2Gain.gain.setTargetAtTime(0.45, targetTime, 0.05);
        this.subOsc!.type = 'triangle';
        this.subOscGain.gain.setTargetAtTime(0.15, targetTime, 0.05);
        this.updateDelay(true, 0.45, 0.55);
        this.updateVibrato(true, 5.8, 12);
        break;

      case 'darkDrone':
        this.osc.type = 'square';
        this.osc2!.type = 'sawtooth';
        this.osc2Gain.gain.setTargetAtTime(0.42, targetTime, 0.05);
        this.subOsc!.type = 'triangle';
        this.subOscGain.gain.setTargetAtTime(0.65, targetTime, 0.05);
        this.updateDelay(true, 0.55, 0.55);
        this.updateVibrato(true, 2.2, 8);
        break;

      case 'radioStatic':
        this.osc.type = 'square';
        this.osc2!.type = 'sawtooth';
        this.osc2Gain.gain.setTargetAtTime(0.5, targetTime, 0.05);
        this.subOsc!.type = 'square';
        this.subOscGain.gain.setTargetAtTime(0.4, targetTime, 0.05);
        this.updateDelay(true, 0.25, 0.75);
        this.updateVibrato(true, 13.0, 95);
        break;
    }
  }

  /**
   * Sets right-hand volume.
   */
  public setVolume(vol: number) {
    this.currentVolume = Math.max(0, Math.min(1.0, vol));
  }

  /**
   * Updates general filter cutoff
   */
  public setFilterCutoff(cutoff: number) {
    if (!this.ctx || !this.filterNode) return;
    const cleanCutoff = Math.max(80, Math.min(20000, cutoff));
    this.filterNode.frequency.setTargetAtTime(cleanCutoff, this.ctx.currentTime, 0.05);
  }

  /**
   * Updates delay params
   */
  public updateDelay(enabled: boolean, time: number, feedback: number) {
    if (!this.ctx || !this.delayMixNode || !this.delayNode || !this.delayFeedback) return;

    const timeConstant = 0.1;
    const targetMix = enabled ? 0.35 : 0.0;
    this.delayMixNode.gain.setTargetAtTime(targetMix, this.ctx.currentTime, timeConstant);

    if (enabled) {
      const cleanTime = Math.max(0.05, Math.min(1.5, time));
      const cleanFeedback = Math.max(0, Math.min(0.95, feedback));
      
      this.delayNode.delayTime.setTargetAtTime(cleanTime, this.ctx.currentTime, 0.2);
      this.delayFeedback.gain.setTargetAtTime(cleanFeedback, this.ctx.currentTime, timeConstant);
    }
  }

  /**
   * Updates vibrato params
   */
  public updateVibrato(enabled: boolean, speed: number, depth: number) {
    if (!this.ctx || !this.vibratoLfo || !this.vibratoGain) return;

    const targetDepth = enabled ? Math.max(0, Math.min(150, depth)) : 0;
    const targetSpeed = Math.max(0.5, Math.min(20, speed));

    this.vibratoGain.gain.setTargetAtTime(targetDepth, this.ctx.currentTime, 0.08);
    this.vibratoLfo.frequency.setTargetAtTime(targetSpeed, this.ctx.currentTime, 0.1);
  }

  /**
   * Mute / Unmute
   */
  public setMute(muted: boolean) {
    if (!this.ctx || !this.masterGainNode) return;
    const targetGain = muted ? 0.0 : 0.8;
    this.masterGainNode.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
  }

  /**
   * Sets drum machine active status, pattern, and volume
   */
  public setDrumParams(enabled: boolean, pattern: 'disco' | 'techno' | 'funk' | 'reggae', volume: number, gain: number = 0.7, lowBoost: number = 0.5) {
    this.drumEnabled = enabled;
    this.drumPattern = pattern;
    this.drumVolume = volume;
    this.drumGain = gain;
    this.drumLowBoost = lowBoost;
    this.updateDrumNodes();
  }

  /**
   * Directly sets the current rhythm progression layer
   */
  public setRhythmLayer(layer: number) {
    this.rhythmLayer = Math.max(0, Math.min(5, layer));
  }

  /**
   * Advances the rhythm layer by 1, wrapping back to 0 at 6
   */
  public advanceRhythmLayer(): { layer: number; name: string; desc: string } {
    this.rhythmLayer = (this.rhythmLayer + 1) % 6;
    return {
      layer: this.rhythmLayer,
      name: this.getActiveLayerName(this.drumPattern, this.rhythmLayer),
      desc: this.getActiveLayerDesc(this.drumPattern, this.rhythmLayer)
    };
  }

  private getActiveLayerName(pattern: string, layer: number): string {
    const names: Record<string, string[]> = {
      disco: [
        '起 • 极简底鼓 (Kick Start)',
        '承 • 脉冲闭帽 (Pulse Hi-Hat)',
        '转 • 复古拍击 (Disco Clap)',
        '合 • 八度跳跃贝斯 (Octave Bouncing Bass)',
        '潮 • 动次打次反拍开帽 (Offbeat Open-Hat Climax)',
        '爆 • 狂野大合奏 (Hyper Disco Overdrive)'
      ],
      techno: [
        '起 • 极简深渊底鼓 (Minimal Core Kick)',
        '承 • 齿轮闭帽 (Ticking Industrial Hats)',
        '转 • 工业背拍 (Techno Backbeat Clap)',
        '合 • 铁轨滚奏贝斯 (Triplet rolling Bass)',
        '潮 • 柏林电网反拍开帽 (Berlin Climax Open-Hats)',
        '爆 • 涡轮风暴大合奏 (Turbo Overdrive Snare Roll)'
      ],
      funk: [
        '起 • 碎步底鼓 (Syncopated Funk Kick)',
        '承 • 切分碎帽 (Swing Shuffle Hats)',
        '转 • 灵魂背拍 (Funk Backbeat Snare)',
        '合 • 贝斯手指弹双击 (Double Slap-Bass Ghost)',
        '潮 • 碎拍反拍开帽高潮 (Full Breakbeat Climax)',
        '爆 • 狂热独奏大合奏 (Breakbeat Overdrive Solo)'
      ],
      reggae: [
        '起 • 单滴底鼓 (One-Drop Kick)',
        '承 • 反拍吉他闭帽 (Offbeat Skank Hats)',
        '转 • 军鼓落地合击 (Skank Snare Backbeat)',
        '合 • 迷幻延迟 Rimshot (Delay Echo Rimshot)',
        '潮 • 瓦斯反拍开帽高潮 (Dub Open-Hat Climax)',
        '爆 • 汽笛狂欢大合奏 (Dub Siren Overdrive)'
      ]
    };
    return names[pattern]?.[layer] || `Level ${layer + 1}`;
  }

  private getActiveLayerDesc(pattern: string, layer: number): string {
    const descs: Record<string, string[]> = {
      disco: [
        '极简四分音符强击底鼓，展现纯粹的低音脉动。',
        '加入连续八分闭合 Hi-Hat 敲击，建立精密的速度齿轮。',
        '在第 4/12 拍叠加密集的复古 Clap，注入经典的迪斯科身体律动。',
        '左手贝斯启动八度音高交替跳跃，呈现传奇般的迪斯科贝斯动感！',
        '完全释放反拍 Open Hi-Hat！呈现经典的 Don\'t-Tse 迪斯科金曲高潮！',
        '全乐器狂野合鸣！底鼓双倍打击、16分闭帽扫频，释放无限能量！'
      ],
      techno: [
        '工业重低音底鼓轰鸣，重现柏林地下俱乐部的铁血 foundation。',
        '加入连续 16 分音符紧缩 closed hat，建立机械精密的运动感。',
        '在第 12 步叠加干冷 Techno 军鼓重击，定下铁轨般刚硬的骨架。',
        '贝斯转入三连音滚奏，与底鼓形成经典的 techno rolling 狂热。',
        '反拍 Open Hi-Hat 猛烈切入！工业电网拉开，全场热度登顶！',
        '大合奏爆发！16分音符军鼓滚奏与高速滤波扫频，引爆黑暗能量！'
      ],
      funk: [
        '切分不规则 808 碎拍底鼓，踩出摇摆不羁的慵懒步伐。',
        '加入带有 Swing 摇摆微偏差的闭合 Hi-Hat，注入灵魂碎拍微风。',
        '第 4/12 步清脆 Snare 切入，形成经典的放克切分重音背拍。',
        '贝斯启动双拇指 slap 双击，切分幽灵音与滑音全面拉满！',
        '第 6/14 步反拍 open hat 加入，乐器完美撕扯，摇摆力度拉满！',
        '大花爆发！不规则军鼓狂飙填充、贝斯 16 分全开，炫技索罗开启！'
      ],
      reggae: [
        '经典雷鬼 One-Drop 底鼓，仅在第三拍击下，留下神圣的空气感。',
        '第 2/6/10/14 反拍处加入轻盈 the closed hat，模拟雷鬼吉他切音。',
        '军鼓在第三拍与底鼓完美合击，落地重音，产生沉重的反作用力。',
        '反拍延迟 rimshot 音效切入，在混响空间中泛起阵阵迷离涟漪。',
        '完全释放反拍 Open Hi-Hat 与多重过门，步入 Dub 幻境核心。',
        '大混响 Dub 汽笛轰鸣！底鼓重整为 4/4 四分音，开启巨浪狂欢！'
      ]
    };
    return descs[pattern]?.[layer] || '';
  }

  /**
   * Sets the random melody cross-mix ratio (0 to 1)
   */
  public setRandomMelodyMix(mix: number) {
    this.randomMelodyMix = Math.max(0, Math.min(1, mix));
  }

  /**
   * Updates real-time hands presence, positions, stretch/opening, and fist status
   */
  public setHandsStatus(
    leftActive: boolean,
    rightActive: boolean,
    leftZ: number,
    rightZ: number,
    leftPalmOpen: boolean,
    rightPalmOpen: boolean
  ) {
    this.leftHandActive = leftActive;
    this.rightHandActive = rightActive;
    this.leftHandZ = Math.max(0, Math.min(1, leftZ));
    this.rightHandZ = Math.max(0, Math.min(1, rightZ));
    this.leftHandPalmOpen = leftPalmOpen;
    this.rightHandPalmOpen = rightPalmOpen;
  }

  /**
   * Updates real-time left hand velocity
   */
  public setLeftHandVelocity(velocity: number) {
    this.leftHandVelocity = Math.max(0, velocity);
  }

  /**
   * Updates real-time drum node parameters (gain/drive and low boost)
   */
  private updateDrumNodes() {
    if (!this.ctx || !this.drumMasterGain || !this.drumLowShelfFilter) return;
    const now = this.ctx.currentTime;
    const boostDb = this.drumLowBoost * 18.0;
    this.drumLowShelfFilter.gain.setTargetAtTime(boostDb, now, 0.05);
    const targetGain = this.drumVolume * (this.drumGain * 1.6);
    this.drumMasterGain.gain.setTargetAtTime(targetGain, now, 0.05);
  }

  /**
   * Populates the noise buffer for snare and hi-hats synthesis
   */
  private createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  /**
   * Synthesizes and triggers a retro electronic bass kick
   */
  private triggerKick(time: number, volume: number = 1.0) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const drumDest = this.drumLowShelfFilter || this.analyserNode || this.ctx.destination;
      osc.connect(gain);
      gain.connect(drumDest);

      // Pitch Sweep (808 style: start at 160Hz, sweep down rapidly to 45Hz, then slide slowly to 32Hz)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, time);
      osc.frequency.exponentialRampToValueAtTime(52, time + 0.04);
      osc.frequency.exponentialRampToValueAtTime(32, time + 0.35); // long 808 decay!

      // Click transient (adds punch so it doesn't sound thin)
      const clickOsc = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(1200, time);
      clickOsc.frequency.exponentialRampToValueAtTime(100, time + 0.012);

      clickOsc.connect(clickGain);
      clickGain.connect(drumDest);

      clickGain.gain.setValueAtTime(0.0, time);
      clickGain.gain.linearRampToValueAtTime(volume * 0.45, time + 0.002);
      clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.015);

      // Volume envelope for the heavy 808 boom
      gain.gain.setValueAtTime(0.0, time);
      gain.gain.linearRampToValueAtTime(volume * 1.1, time + 0.005);
      // Slowly decay over 0.38s
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.38);

      // Dynamic Sidechain ducking of left-hand bass to prevent mud and add groove pump
      if (this.bassSidechainGain) {
        const gainParam = this.bassSidechainGain.gain;
        gainParam.cancelScheduledValues(time);
        gainParam.setValueAtTime(1.0, time);
        // Duck hard down to 0.12 (88% gain reduction) in 15ms for maximum kick punch transient clearance
        gainParam.linearRampToValueAtTime(0.12, time + 0.015);
        // Smoothly swell back to 1.0 in 160ms for that driving retro pump rhythm
        gainParam.exponentialRampToValueAtTime(1.0, time + 0.16);
      }

      clickOsc.start(time);
      clickOsc.stop(time + 0.02);

      osc.start(time);
      osc.stop(time + 0.4);
    } catch (e) {
      console.error('Error triggering Kick:', e);
    }
  }

  /**
   * Synthesizes and triggers a crisp retro snare / clap
   */
  private triggerSnare(time: number, volume: number = 1.0) {
    if (!this.ctx || !this.noiseBuffer) return;
    try {
      const drumDest = this.drumLowShelfFilter || this.analyserNode || this.ctx.destination;

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1400, time);
      noiseFilter.Q.setValueAtTime(2.5, time);

      const noiseGain = this.ctx.createGain();

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(drumDest);

      noiseGain.gain.setValueAtTime(0.0, time);
      noiseGain.gain.linearRampToValueAtTime(volume * 0.55, time + 0.002);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

      const bodyOsc = this.ctx.createOscillator();
      const bodyGain = this.ctx.createGain();
      bodyOsc.type = 'triangle';

      bodyOsc.frequency.setValueAtTime(185, time);
      bodyOsc.frequency.exponentialRampToValueAtTime(120, time + 0.06);

      bodyGain.gain.setValueAtTime(0.0, time);
      bodyGain.gain.linearRampToValueAtTime(volume * 0.45, time + 0.002);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

      bodyOsc.connect(bodyGain);
      bodyGain.connect(drumDest);

      noiseSource.start(time);
      noiseSource.stop(time + 0.16);

      bodyOsc.start(time);
      bodyOsc.stop(time + 0.09);
    } catch (e) {
      console.error('Error triggering Snare:', e);
    }
  }

  /**
   * Synthesizes and triggers a crisp high-frequency hi-hat
   */
  private triggerHiHat(time: number, volume: number = 1.0, open: boolean = false) {
    if (!this.ctx || !this.noiseBuffer) return;
    try {
      const drumDest = this.drumLowShelfFilter || this.analyserNode || this.ctx.destination;

      const source = this.ctx.createBufferSource();
      source.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(8500, time);

      const gain = this.ctx.createGain();

      source.connect(filter);
      filter.connect(gain);
      gain.connect(drumDest);

      const duration = open ? 0.28 : 0.045;

      gain.gain.setValueAtTime(0.0, time);
      gain.gain.linearRampToValueAtTime(volume * 0.35, time + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      source.start(time);
      source.stop(time + duration + 0.01);
    } catch (e) {
      console.error('Error triggering Hi-Hat:', e);
    }
  }

  /**
   * Decides which drum sound to trigger on a 16-step grid, supporting automatic fills on 8+8 measures
   */
  private playDrumStep(stepIndex: number, stepTime: number, beatIndex: number) {
    if (!this.drumEnabled) return;

    // By default, the drum machine runs when the left hand is active (connected to bass)
    if (!this.leftHandActive) return;

    const vol = this.drumVolume;
    const layer = this.rhythmLayer;

    // --- DYNAMICS & SWING/GROOVE SHAPING ---
    // Calculate dynamic step accent multipliers (velocity) for highly expressive humanized rhythms
    let stepAccent = 1.0;
    if (stepIndex === 0) {
      stepAccent = 1.25; // Downbeat heavy kick/hat accent
    } else if (stepIndex === 8) {
      stepAccent = 1.15; // Midbeat heavy accent
    } else if (stepIndex === 4 || stepIndex === 12) {
      stepAccent = 1.1;  // Snare backbeat accents
    } else if (stepIndex % 4 === 2) {
      stepAccent = 0.85; // Eighth-note syncopations are slightly softer
    } else if (stepIndex % 2 === 1) {
      stepAccent = 0.65; // Sixteenth-note subdivisions (ghost notes) are quiet, creating deep pocket groove!
    }

    // Dynamic micro-timing offset (Swing/Shuffle): delays sixteenth-note offbeats slightly for humanized swing.
    // Techno mode stays completely straight for machine precision.
    let timingOffset = 0.0;
    if (this.drumPattern !== 'techno' && stepIndex % 2 === 1) {
      timingOffset = 0.015 * (60.0 / this.tempoBpm); // 15ms swing delay proportional to tempo
    }
    const finalStepTime = stepTime + timingOffset;

    // --- TRIGGER DRUMS BY PATTERN & PROGRESSIVE LAYER ---
    const shouldKick = this.shouldKickPlayOnStep(this.drumPattern, layer, stepIndex);
    if (shouldKick) {
      this.triggerKick(finalStepTime, vol * 1.25 * stepAccent);
    }

    switch (this.drumPattern) {
      case 'disco':
        // Layer 0: Only Kick
        // Layer 1: Kick + Eighth Closed Hats
        // Layer 2..3: Kick + Eighth Closed Hats + Snare/Clap on 4, 12
        // Layer 4: Kick + Snare + Offbeat Open Hats ("Don't-Tse")
        // Layer 5: Kick + Snare/Claps on 4, 12, 14, 15 + Open Hats + 16th rolling closed hats
        if (layer >= 1) {
          const isOffbeat = (stepIndex === 2 || stepIndex === 6 || stepIndex === 10 || stepIndex === 14);
          if (layer === 4 || layer === 5) {
            if (isOffbeat) {
              this.triggerHiHat(finalStepTime, vol * 1.1 * stepAccent, true); // Open Hi-Hat "Tse!"
            } else if (layer === 5) {
              // 16th roll closed hats
              this.triggerHiHat(finalStepTime, vol * 0.5 * stepAccent, false);
            } else if (stepIndex % 2 === 0) {
              this.triggerHiHat(finalStepTime, vol * 0.6 * stepAccent, false);
            }
          } else {
            // Steady eighth closed hats
            if (stepIndex % 2 === 0) {
              this.triggerHiHat(finalStepTime, vol * 0.6 * stepAccent, false);
            }
          }
        }

        if (layer >= 2) {
          if (stepIndex === 4 || stepIndex === 12) {
            this.triggerSnare(finalStepTime, vol * 1.1 * stepAccent);
          }
          if (layer === 5 && (stepIndex === 14 || stepIndex === 15)) {
            this.triggerSnare(finalStepTime, vol * 0.8 * stepAccent); // Extra energetic claps!
          }
        }
        break;

      case 'techno':
        // Layer 0: Only Kick
        // Layer 1: Kick + 16th closed hats
        // Layer 2: Kick + 16th closed hats + snare clap on 12
        // Layer 3: Kick + open hats on 2, 6, 10, 14 + closed hats on other steps + snare on 4, 12
        // Layer 4: Kick + driving open hats + driving 16th closed hats + snare on 4, 12
        // Layer 5: Kick + open hats + 16th hats + snare on 4, 12 + heavy snare roll on 14, 15
        if (layer >= 1) {
          const isOffbeat = (stepIndex === 2 || stepIndex === 6 || stepIndex === 10 || stepIndex === 14);
          if (layer >= 3 && isOffbeat) {
            this.triggerHiHat(finalStepTime, vol * 0.85 * stepAccent, true); // Open Hat
          } else {
            // Closed hats
            this.triggerHiHat(finalStepTime, vol * 0.5 * stepAccent, false);
          }
        }

        if (layer === 2) {
          if (stepIndex === 12) {
            this.triggerSnare(finalStepTime, vol * 0.75 * stepAccent);
          }
        } else if (layer >= 3) {
          if (stepIndex === 4 || stepIndex === 12) {
            this.triggerSnare(finalStepTime, vol * 0.8 * stepAccent);
          }
          if (layer === 5 && (stepIndex === 14 || stepIndex === 15)) {
            // Snare roll build-up!
            this.triggerSnare(finalStepTime, vol * 0.75 * stepAccent);
          }
        }
        break;

      case 'funk':
        // Layer 0: Only Kick (Syncopated: 0, 8, 10)
        // Layer 1: Kick + Eighth Closed Hats (0, 2, 4, 6, 8, 10, 12, 14)
        // Layer 2: Kick + Eighth Closed Hats + Snare on 4, 12
        // Layer 3: Kick + Eighth Closed Hats + Snare on 4, 12, 15 (Ghost note!)
        // Layer 4: Kick + Snare + Open Hats on 6, 14, Closed Hats on other eighths
        // Layer 5: Kick + Open Hats + 16th hats + Snare on 4, 10, 12, 14, 15 (Wild roll!)
        if (layer >= 1) {
          const isOffbeatOpen = (stepIndex === 6 || stepIndex === 14);
          if (layer >= 4 && isOffbeatOpen) {
            this.triggerHiHat(finalStepTime, vol * 0.85 * stepAccent, true); // Open Hat
          } else if (layer === 5) {
            // 16th rolling hats
            this.triggerHiHat(finalStepTime, vol * 0.55 * stepAccent, false);
          } else if (stepIndex % 2 === 0) {
            // Eighth closed hats
            this.triggerHiHat(finalStepTime, vol * 0.6 * stepAccent, false);
          }
        }

        if (layer >= 2) {
          if (stepIndex === 4 || stepIndex === 12) {
            this.triggerSnare(finalStepTime, vol * 1.1 * stepAccent);
          }
          if (layer === 3 && stepIndex === 15) {
            this.triggerSnare(finalStepTime, vol * 0.65 * stepAccent); // Ghost Snare!
          } else if (layer === 4 && stepIndex === 15) {
            this.triggerSnare(finalStepTime, vol * 0.8 * stepAccent);
          } else if (layer === 5) {
            if (stepIndex === 10 || stepIndex === 14 || stepIndex === 15) {
              this.triggerSnare(finalStepTime, vol * 0.9 * stepAccent); // Wild roll filling!
            }
          }
        }
        break;

      case 'reggae':
        // Layer 0: Only Kick (One Drop on beat 3 - step 8)
        // Layer 1: Kick + Reggae Skank Hats on offbeats 2, 6, 10, 14
        // Layer 2: Kick + Skank Hats + Snare on step 8
        // Layer 3: Kick + Skank Hats + Snare + Snare/Kick on step 14
        // Layer 4: Kick + Open Skank Hats + Snare + Snare/Kick on 14 + Rimshots
        // Layer 5: Kick (Heavy Dub steps 0, 8, 10, 14) + Open Skank Hats + 16th closed hats + Snare on 4, 8, 12, 14
        if (layer >= 1) {
          const isSkank = (stepIndex === 2 || stepIndex === 6 || stepIndex === 10 || stepIndex === 14);
          if (isSkank) {
            this.triggerHiHat(finalStepTime, vol * 0.9 * stepAccent, layer >= 4); // Open hat if layer >= 4
          } else if (layer === 5) {
            // 16th closed hats
            this.triggerHiHat(finalStepTime, vol * 0.4 * stepAccent, false);
          } else if (stepIndex % 4 === 0) {
            this.triggerHiHat(finalStepTime, vol * 0.5 * stepAccent, false);
          }
        }

        if (layer >= 2) {
          if (stepIndex === 8) {
            this.triggerSnare(finalStepTime, vol * 1.2 * stepAccent);
          }
          if (layer >= 3 && stepIndex === 14) {
            this.triggerSnare(finalStepTime, vol * 0.9 * stepAccent);
          }
          if (layer >= 4 && stepIndex === 4) {
            // Rimshot / Dub delay snare!
            this.triggerSnare(finalStepTime, vol * 0.7 * stepAccent);
          }
          if (layer === 5 && stepIndex === 12) {
            this.triggerSnare(finalStepTime, vol * 1.0 * stepAccent);
          }
        }
        break;
    }
  }

  /**
   * Releases resources and stops all schedulers/oscillators
   */
  public destroy() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
    if (this.ctx) {
      try {
        if (this.osc) { this.osc.stop(); this.osc.disconnect(); }
        if (this.osc2) { this.osc2.stop(); this.osc2.disconnect(); }
        if (this.subOsc) { this.subOsc.stop(); this.subOsc.disconnect(); }
        if (this.bassOsc) { this.bassOsc.stop(); this.bassOsc.disconnect(); }
        if (this.bassOsc2) { this.bassOsc2.stop(); this.bassOsc2.disconnect(); }
        if (this.vibratoLfo) { this.vibratoLfo.stop(); this.vibratoLfo.disconnect(); }
        this.ctx.close();
      } catch (e) {
        console.error('Error destroying audio engine:', e);
      }
      this.ctx = null;
      this.osc = null;
      this.osc2 = null;
      this.osc2Gain = null;
      this.subOsc = null;
      this.subOscGain = null;
      this.bassOsc = null;
      this.bassOsc2 = null;
      this.bassOscGain = null;
      this.bassFilterNode = null;
      this.bassSidechainGain = null;
      this.bassHpfNode = null;
      this.gainNode = null;
      this.filterNode = null;
      this.delayNode = null;
      this.delayFeedback = null;
      this.delayMixNode = null;
      this.vibratoLfo = null;
      this.vibratoGain = null;
      this.pannerNode = null;
      this.analyserNode = null;
      this.masterGainNode = null;
      this.leadHpfNode = null;
      this.leadEqNode = null;
      this.masterCompressorNode = null;
      this.isPlaying = false;
    }
  }

  /**
   * Translates a frequency (Hz) into the nearest equal-temperament note.
   */
  public static hzToNote(freq: number): NoteInfo {
    if (freq <= 0) return { note: '-', deviation: 0, hz: 0 };
    
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteVal = 12 * Math.log2(freq / 440) + 69;
    const midiNote = Math.round(noteVal);
    const deviationCents = Math.round((noteVal - midiNote) * 100);
    const noteIndex = ((midiNote % 12) + 12) % 12;
    const octave = Math.floor(midiNote / 12) - 1;
    const noteName = notes[noteIndex] + octave;
    const targetHz = 440 * Math.pow(2, (midiNote - 69) / 12);

    return {
      note: noteName,
      deviation: deviationCents,
      hz: Number(targetHz.toFixed(1))
    };
  }

  /**
   * Quantizes a raw frequency to the nearest 12-TET MIDI note,
   * and restricts it to scale degrees 1, 2, 3, 4, 5, 6 of the C Major scale: [0, 2, 4, 5, 7, 9].
   */
  public static quantizeToHarmonicScale(freq: number, isBass: boolean): number {
    if (freq <= 0) return freq;

    // Convert frequency to MIDI note number (440Hz is MIDI 69)
    const midiVal = 12 * Math.log2(freq / 440) + 69;
    let midiNote = Math.round(midiVal);

    let octave = Math.floor(midiNote / 12);
    let semitone = ((midiNote % 12) + 12) % 12;

    // Diatonic C Major scale degrees 1, 2, 3, 4, 5, 6: C, D, E, F, G, A
    // Allowed semitones relative to C: [0, 2, 4, 5, 7, 9]
    const allowed = [0, 2, 4, 5, 7, 9];

    // Find the nearest allowed semitone
    let bestSemitone = allowed[0];
    let minDiff = 12;

    const candidates = [...allowed, 12];
    for (const cand of candidates) {
      const diff = Math.abs(semitone - cand);
      if (diff < minDiff) {
        minDiff = diff;
        bestSemitone = cand;
      }
    }

    if (bestSemitone === 12) {
      bestSemitone = 0;
      octave += 1;
    }

    const quantizedMidi = octave * 12 + bestSemitone;

    // Convert back to frequency
    const quantizedFreq = 440 * Math.pow(2, (quantizedMidi - 69) / 12);
    return quantizedFreq;
  }
}
