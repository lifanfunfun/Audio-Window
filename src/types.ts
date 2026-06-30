export type WaveformType = 'sine' | 'triangle' | 'sawtooth' | 'square';

export interface FreqRange {
  id: 'low' | 'mid' | 'high' | 'ultra';
  name: string;
  min: number;
  max: number;
  description: string;
}

export interface SynthParams {
  waveform: WaveformType;
  volume: number;        // 0 to 1
  frequency: number;     // calculated in Hz
  muted: boolean;
  freqRangeId: 'low' | 'mid' | 'high' | 'ultra';
  
  // Effects
  delayEnabled: boolean;
  delayTime: number;     // seconds, 0.1 to 1.0
  delayFeedback: number; // 0 to 0.95
  
  vibratoEnabled: boolean;
  vibratoSpeed: number;  // Hz, 2 to 15
  vibratoDepth: number;  // Frequency deviation, 0 to 100
  
  filterCutoff: number;  // Hz, 100 to 15000

  // Enhanced parameters for FX Panning and Diverse Timbre presets
  stereoPan: number;     // -1.0 (Left) to +1.0 (Right)
  leftHandFXMode: 'volume' | 'delay' | 'panning' | 'filter'; // Cycle with fist gesture
  activePreset: 'classic' | 'ambientPad' | 'cyberpunkLead' | 'oceanBass' | 'cosmicArp' | 'nebulaStrings' | 'arcade8Bit' | 'glassBell' | 'darkDrone' | 'radioStatic';
  arpEnabled: boolean;
  arpSpeed: number;      // Speed multiplier

  // New performance modes for precise rhythms and 110bpm controls
  leftPlayMode: 'drone' | 'pulse'; // drone (long sustained pad) or pulse (110bpm short staccato stabs)
  rightPlayMode: 'arp' | 'stepwise' | 'thirdLeaps' | 'jazzLoop' | 'harmonicIntervals' | 'blockChords' | 'auto';
  tempoBpm: number; // 110bpm by default
  rhythmModel: 'triplets' | 'front16th' | 'back16th' | 'four16ths' | 'dotted' | 'syncopated' | 'random';
  
  // Drum Machine Integration
  drumEnabled: boolean;
  drumPattern: 'disco' | 'techno' | 'funk' | 'reggae';
  drumVolume: number; // 0 to 1
  drumGain: number;    // 0 to 1
  drumLowBoost: number; // 0 to 1
  
  // Arpeggiator Random Melody Cross-Mix Variable
  randomMelodyMix: number; // 0 to 1 (0 is pure arpeggio, 1 is pure random scale tones)

  // --- Four Major Harmonic Systems and Scale Parameters ---
  harmonicSystem: 'classical' | 'church' | 'jazz' | 'eastern';
  scaleMode: 'major' | 'minor' | 'harmonic_minor' | 'melodic_minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian' | 'lydian_dominant' | 'altered' | 'diminished' | 'super_locrian' | 'gong' | 'shang' | 'jue' | 'zhi' | 'yu';
  scaleRoot: 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';
  activeChordDegree: number; // 1 to 7 (I, ii, iii, IV, V, vi, vii°)
  autoChordProgression: boolean; // if true, the chord progression cycles automatically!
}

export interface HandStatus {
  active: boolean;
  x: number;             // Normalized 0 to 1 (0 is left, 1 is right)
  y: number;             // Normalized 0 to 1 (0 is top, 1 is bottom)
  z: number;             // Normalized depth
  palmOpen: boolean;     // Whether hand gestures indicate active play
  fingersExtended?: {
    thumb: boolean;
    index: boolean;
    middle: boolean;
    ring: boolean;
    pinky: boolean;
  };
}

export interface HandsState {
  left: HandStatus;      // Usually controls Volume
  right: HandStatus;     // Usually controls Pitch
  singleHandMode: boolean; // True if only 1 hand is present (controls both)
}

export interface NoteInfo {
  note: string;          // E.g., "A4"
  deviation: number;     // Cents deviation from equal temperament
  hz: number;
}
