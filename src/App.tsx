/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { ThereminAudioEngine } from './lib/audioEngine';
import { SynthParams, HandsState, FreqRange, NoteInfo, HandStatus } from './types';
import CameraTracker from './components/CameraTracker';
import Visualizer from './components/Visualizer';
import ThereminAntennas from './components/ThereminAntennas';
import ThereminControls from './components/ThereminControls';
import RainbowSpectrum from './components/RainbowSpectrum';
import { Radio, Sparkles, HelpCircle, Flame, Music, RefreshCw, Volume2, Zap, Sliders, Play, Camera, Monitor, ArrowRight, Eye, Folder, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULT_PARAMS: SynthParams = {
  waveform: 'sawtooth',
  volume: 0.0,            // Starts silent
  frequency: 440,
  muted: true,            // Starts muted by default for safety
  freqRangeId: 'mid',
  delayEnabled: true,
  delayTime: 0.35,
  delayFeedback: 0.45,
  vibratoEnabled: true,
  vibratoSpeed: 6.0,
  vibratoDepth: 35,
  filterCutoff: 3500,

  stereoPan: 0.0,
  leftHandFXMode: 'volume',
  activePreset: 'ambientPad',
  arpEnabled: true,
  arpSpeed: 1,

  leftPlayMode: 'drone',
  rightPlayMode: 'arp',
  tempoBpm: 110,
  rhythmModel: 'random',
  drumEnabled: true,
  drumPattern: 'disco',
  drumVolume: 0.6,
  drumGain: 0.7,
  drumLowBoost: 0.5,
  randomMelodyMix: 0.35,

  // Four Major Harmonic Systems default values
  harmonicSystem: 'classical',
  scaleMode: 'minor',
  scaleRoot: 'C',
  activeChordDegree: 1,
  autoChordProgression: true
};

const FREQ_RANGES: FreqRange[] = [
  { id: 'low', name: '男低沉吟 (Bass)', min: 65, max: 520, description: '浑厚庄严，正好三个八度的超低电影音效' },
  { id: 'mid', name: '歌唱女伶 (Classic)', min: 220, max: 1760, description: '最经典的人声歌唱旋律，完美的三个八度' },
  { id: 'high', name: '幽灵低语 (Eerie)', min: 440, max: 3520, description: '复古恐怖片中的幽灵盘旋感，精调三个八度' },
  { id: 'ultra', name: '宇宙电磁 (Cosmic)', min: 880, max: 7040, description: '超高频电磁波与外星信号，覆盖三个八度' }
];

function checkIfFist(hand: HandStatus): boolean {
  if (!hand.active) return false;
  if (hand.fingersExtended) {
    // A fist is defined precisely as index, middle, ring, and pinky all being folded/closed.
    // This strictly prevents gestures like index-only (triplets) from being detected as a fist.
    return !hand.fingersExtended.index && !hand.fingersExtended.middle && !hand.fingersExtended.ring && !hand.fingersExtended.pinky;
  }
  return !hand.palmOpen;
}

export default function App() {
  const [params, setParams] = useState<SynthParams>(DEFAULT_PARAMS);
  const paramsRef = useRef<SynthParams>(params);
  
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const [hands, setHands] = useState<HandsState>({
    left: { active: false, x: 0, y: 0, z: 0, palmOpen: true },
    right: { active: false, x: 0, y: 0, z: 0, palmOpen: true },
    singleHandMode: true
  });
  
  // Layer state: 'performance' (Layer 1: 16:9 widescreen stage) or 'console' (Layer 2: Settings Console)
  const [activeTab, setActiveTab] = useState<'performance' | 'console'>('performance');

  const [cameraActive, setCameraActive] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [noteInfo, setNoteInfo] = useState<NoteInfo>({ note: '-', deviation: 0, hz: 0 });

  // Floating notifications overlay state
  const [notification, setNotification] = useState<{
    id: string;
    text: string;
    subText?: string;
    type: 'preset' | 'fx';
  } | null>(null);

  const prevLeftPalmOpenRef = useRef<boolean>(true);
  const prevRightPalmOpenRef = useRef<boolean>(true);
  const lastLeftFistTriggerRef = useRef<number>(0);
  const lastRightFistTriggerRef = useRef<number>(0);
  const audioEngineRef = useRef<ThereminAudioEngine | null>(null);

  const [rhythmLayer, setRhythmLayer] = useState<number>(0);

  const prevLeftYRef = useRef<number | null>(null);
  const lastLeftTimeRef = useRef<number>(0);
  const leftVelocityRef = useRef<number>(0);

  // 1. Lazy initialize the audio engine
  useEffect(() => {
    const engine = new ThereminAudioEngine();
    audioEngineRef.current = engine;

    return () => {
      engine.destroy();
    };
  }, []);

  // 2. Synchronize SynthParams to the AudioEngine whenever they change
  useEffect(() => {
    const engine = audioEngineRef.current;
    if (!engine || !audioInitialized) return;

    engine.setWaveform(params.waveform);
    engine.setMute(params.muted);
    engine.setBpm(params.tempoBpm);
    engine.setFilterCutoff(params.filterCutoff);
    engine.updateDelay(params.delayEnabled, params.delayTime, params.delayFeedback);
    engine.updateVibrato(params.vibratoEnabled, params.vibratoSpeed, params.vibratoDepth);
    engine.setPerformanceModes(params.leftPlayMode, params.rightPlayMode, params.rhythmModel);
    engine.setDrumParams(params.drumEnabled, params.drumPattern, params.drumVolume, params.drumGain, params.drumLowBoost);
    engine.setRhythmLayer(rhythmLayer);
    engine.setRandomMelodyMix(params.randomMelodyMix);
    engine.setScaleParams(params.harmonicSystem, params.scaleMode, params.scaleRoot, params.activeChordDegree, params.autoChordProgression);
    engine.applyPreset(params.activePreset);
  }, [
    params.waveform,
    params.muted,
    params.tempoBpm,
    params.filterCutoff,
    params.delayEnabled,
    params.delayTime,
    params.delayFeedback,
    params.vibratoEnabled,
    params.vibratoSpeed,
    params.vibratoDepth,
    params.leftPlayMode,
    params.rightPlayMode,
    params.rhythmModel,
    params.drumEnabled,
    params.drumPattern,
    params.drumVolume,
    params.drumGain,
    params.drumLowBoost,
    params.randomMelodyMix,
    params.harmonicSystem,
    params.scaleMode,
    params.scaleRoot,
    params.activeChordDegree,
    params.autoChordProgression,
    params.activePreset,
    rhythmLayer,
    audioInitialized
  ]);

  // Clean up notifications automatically
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const triggerNotification = (text: string, subText: string, type: 'preset' | 'fx') => {
    setNotification({
      id: Math.random().toString(),
      text,
      subText,
      type
    });
  };

  // 3. User Gesture: activate Web Audio API Context
  const ensureAudioInit = async () => {
    if (audioInitialized) return;
    try {
      const engine = audioEngineRef.current;
      if (engine) {
        engine.init();
        await engine.resume();
        setAudioInitialized(true);
        
        // Force initial sync of params
        engine.setWaveform(params.waveform);
        engine.setMute(params.muted);
        engine.setBpm(params.tempoBpm);
        engine.setFilterCutoff(params.filterCutoff);
        engine.updateDelay(params.delayEnabled, params.delayTime, params.delayFeedback);
        engine.updateVibrato(params.vibratoEnabled, params.vibratoSpeed, params.vibratoDepth);
        engine.setPerformanceModes(params.leftPlayMode, params.rightPlayMode, params.rhythmModel);
        engine.setDrumParams(params.drumEnabled, params.drumPattern, params.drumVolume, params.drumGain, params.drumLowBoost);
        engine.setRandomMelodyMix(params.randomMelodyMix);
        engine.setScaleParams(params.harmonicSystem, params.scaleMode, params.scaleRoot, params.activeChordDegree, params.autoChordProgression);
        engine.applyPreset(params.activePreset);
      }
    } catch (e) {
      console.error('Failed to initialize audio engine on gesture:', e);
    }
  };

  // 4. Handle parameter sliders and selectors update
  const handleParamsChange = (newParams: Partial<SynthParams>) => {
    ensureAudioInit(); // Try initializing on any parameter change gesture
    setParams(prev => {
      const updated = { ...prev, ...newParams };
      // If user toggles unmuted, unmute in engine
      if (newParams.muted === false && audioInitialized) {
        audioEngineRef.current?.setMute(false);
      }
      return updated;
    });
  };

  // Reset to default values
  const handleResetToDefaults = () => {
    setParams({
      ...DEFAULT_PARAMS,
      muted: params.muted // Preserve mute status to avoid unexpected sudden sound
    });
    audioEngineRef.current?.applyPreset('ambientPad');
  };

  // 5. Compute Pitch & Volume dynamically from hand positions
  const handleHandsUpdate = (handsState: HandsState) => {
    setHands(handsState);

    const engine = audioEngineRef.current;
    if (!engine || !audioInitialized) return;

    const currentParams = paramsRef.current;

    // Get current range limits
    const currentRange = FREQ_RANGES.find(r => r.id === currentParams.freqRangeId) || FREQ_RANGES[1];

    let targetFreq = currentParams.frequency;
    let targetVol = currentParams.volume;
    let activePreset = currentParams.activePreset;

    const now = Date.now();

    // Track Left Hand Velocity for triggering 16th note Fills
    if (handsState.left.active) {
      const currentY = handsState.left.y;
      const prevY = prevLeftYRef.current;
      const lastTime = lastLeftTimeRef.current;
      const timeDiff = now - lastTime;

      if (prevY !== null && timeDiff > 0 && timeDiff < 500) {
        const dy = Math.abs(currentY - prevY);
        const velocity = dy / (timeDiff / 1000); // Y span per second
        leftVelocityRef.current = leftVelocityRef.current * 0.75 + velocity * 0.25;
      }
      prevLeftYRef.current = currentY;
      lastLeftTimeRef.current = now;
      engine.setLeftHandVelocity(leftVelocityRef.current);
      engine.updateLeftHandLiveParams(1 - currentY, leftVelocityRef.current);
    } else {
      prevLeftYRef.current = null;
      leftVelocityRef.current = 0;
      engine.setLeftHandVelocity(0);
      engine.updateLeftHandLiveParams(0.5, 0);
    }

    // --- AIR GESTURES DETECTION (Closed fist / Clenched palm check) ---
    // 1. Left hand closed fist: Cycle rhythm models! (Only in dual-hand mode)
    if (handsState.left.active && !handsState.singleHandMode) {
      const isLeftFist = checkIfFist(handsState.left);
      const leftFistTransition = prevLeftPalmOpenRef.current && isLeftFist;
      
      if (leftFistTransition && (now - lastLeftFistTriggerRef.current > 800)) {
        lastLeftFistTriggerRef.current = now;
        
        // Progressively advance the drum/bass rhythm layers! (起-承-转-合-潮-爆)
        const res = engine.advanceRhythmLayer();
        setRhythmLayer(res.layer);
        
        triggerNotification(
          `💥 递进节奏层: ${res.name}`,
          res.desc,
          'fx'
        );
      }
      prevLeftPalmOpenRef.current = !checkIfFist(handsState.left);
    }

    // 2. Right hand closed fist: Switch random preset
    const rightHandRef = handsState.right.active 
      ? handsState.right 
      : (handsState.singleHandMode && handsState.left.active ? handsState.left : null);

    if (rightHandRef) {
      const isRightOrSingle = handsState.right.active || handsState.singleHandMode;
      const prevPalmOpen = isRightOrSingle ? prevRightPalmOpenRef.current : prevLeftPalmOpenRef.current;
      const isFist = checkIfFist(rightHandRef);
      const rightFistTransition = prevPalmOpen && isFist;

      if (rightFistTransition && (now - lastRightFistTriggerRef.current > 800)) {
        lastRightFistTriggerRef.current = now;

        const presetsList: ('classic' | 'ambientPad' | 'cyberpunkLead' | 'oceanBass' | 'cosmicArp' | 'nebulaStrings' | 'arcade8Bit' | 'glassBell' | 'darkDrone' | 'radioStatic')[] = [
          'classic', 'ambientPad', 'cyberpunkLead', 'oceanBass', 'cosmicArp', 'nebulaStrings', 'arcade8Bit', 'glassBell', 'darkDrone', 'radioStatic'
        ];
        const otherPresets = presetsList.filter(p => p !== currentParams.activePreset);
        const nextPreset = otherPresets[Math.floor(Math.random() * otherPresets.length)];
        activePreset = nextPreset;

        const presetLabels: Record<string, { name: string; icon: string }> = {
          classic: { name: '经典正弦波特雷门 (Classic Sine)', icon: '🍃' },
          ambientPad: { name: '温润宽广电影感垫音 (Ethereal Pad)', icon: '🌌' },
          cyberpunkLead: { name: '双锯齿波合奏电音 (Cyberpunk Lead)', icon: '⚡' },
          oceanBass: { name: '饱满深沉模拟低音 (Sub-Bass)', icon: '🌋' },
          cosmicArp: { name: '星轨自动五声琶音 (Orbit Arp)', icon: '🌟' },
          nebulaStrings: { name: '慢起合唱群奏弦乐 (Nebula Strings)', icon: '🎻' },
          arcade8Bit: { name: 'FC红白机方波像素音 (Retro 8-Bit)', icon: '👾' },
          glassBell: { name: '全息高频水晶钟琴 (Crystal Bell)', icon: '🔮' },
          darkDrone: { name: '工業暗流厚重低频 (Dark Drone)', icon: '⛓️' },
          radioStatic: { name: '扫频电波天线电磁信号 (Space Radio)', icon: '🛰️' }
        };

        triggerNotification(
          `右手音色变换！ ${presetLabels[nextPreset].icon}`,
          presetLabels[nextPreset].name,
          'preset'
        );

        engine.applyPreset(nextPreset);
        setParams(prev => ({ ...prev, activePreset: nextPreset }));
      }

      if (handsState.right.active) {
        prevRightPalmOpenRef.current = !checkIfFist(handsState.right);
      } else if (handsState.singleHandMode && handsState.left.active) {
        prevRightPalmOpenRef.current = !checkIfFist(handsState.left);
      }
    }

    // --- REALTIME FREQUENCY & EFFECT VALUE MODULATION ---
    if (handsState.singleHandMode) {
      // --- SINGLE HAND MODE ---
      const hand = handsState.right.active ? handsState.right : handsState.left;

      if (hand.active) {
        const x = hand.x; 
        const baseFreqX = currentRange.min * Math.pow(currentRange.max / currentRange.min, x);
        const yHeight = 1 - hand.y;
        
        // Let vertical sliding (Y-axis) modulate the pitch smoothly! (-1.0 to +1.0 octave shift)
        // "比如手掌或拳头上下滑动，音高也要上下变化"
        const yPitchMultiplier = Math.pow(2, (yHeight - 0.5) * 2.0);
        targetFreq = baseFreqX * yPitchMultiplier;
        
        engine.setFrequency(targetFreq);
        setNoteInfo(ThereminAudioEngine.hzToNote(targetFreq));

        // Volume logic: lock volume at 0.65 when hand is closed so sliding down doesn't mute, otherwise track height
        if (hand.palmOpen) {
          targetVol = yHeight * 0.75;
        } else {
          targetVol = 0.65;
        }
        engine.setVolume(targetVol);

        // Send hand status details to the engine
        engine.setHandsStatus(false, true, 0.5, hand.z, true, hand.palmOpen);
      } else {
        engine.setVolume(0);
        targetVol = 0;
        engine.setHandsStatus(false, false, 0.5, 0.5, true, true);
      }
    } else {
      // --- DUAL HAND MODE ---
      const lHand = handsState.left;
      const rHand = handsState.right;

      // Send real-time hand states (positions, stretch/clench, and open/closed details) to the audio engine
      engine.setHandsStatus(
        lHand.active,
        rHand.active,
        lHand.z,
        rHand.z,
        lHand.palmOpen,
        rHand.palmOpen
      );

      // 1. Process Right Hand (Melody / Arpeggiator / Chord Root)
      if (rHand.active) {
        const x = rHand.x; 
        const baseFreqX = currentRange.min * Math.pow(currentRange.max / currentRange.min, x);
        const yHeight = 1 - rHand.y;
        
        // Let vertical sliding (Y-axis) modulate the pitch smoothly! (-1.0 to +1.0 octave shift)
        // "比如手掌或拳头上下滑动，音高也要上下变化"
        const yPitchMultiplier = Math.pow(2, (yHeight - 0.5) * 2.0);
        targetFreq = baseFreqX * yPitchMultiplier;
        
        engine.setFrequency(targetFreq);
        setNoteInfo(ThereminAudioEngine.hzToNote(targetFreq));

        // Volume logic: lock volume at 0.65 when hand is clenched/closed so sliding up/down doesn't mute, otherwise track height
        if (rHand.palmOpen) {
          targetVol = yHeight * 0.75;
        } else {
          targetVol = 0.65;
        }
        engine.setVolume(targetVol);
      } else {
        engine.setVolume(0);
        targetVol = 0;
      }

      // 2. Process Left Hand (Bass Drone or Pulse)
      if (lHand.active) {
        const yHeight = 1 - lHand.y;
        
        // If left hand is sliding (moving), its Y-height represents specific quantized scale tones.
        // Otherwise, it falls back to the default bassline.
        if (leftVelocityRef.current > 0.08) {
          const leftBassFreq = engine.getLeftHandQuantizedBassFreq(yHeight);
          engine.setLeftBassFrequency(leftBassFreq);
        } else {
          engine.setLeftBassFrequency(engine.getActiveChordBassFreq());
        }

        // Modulation of the lowpass cutoff of the bass filter (brightness)
        const cutoff = 120 + yHeight * 6880; // 120Hz to 7000Hz sweep
        engine.setFilterCutoff(cutoff);
      }
    }

    // Detect active rhythm model based on right hand fingers (or single hand if active)
    let activeRhythmModel = currentParams.rhythmModel;
    const rHandForRhythm = handsState.right.active 
      ? handsState.right 
      : (handsState.singleHandMode && handsState.left.active ? handsState.left : null);
 
    if (rHandForRhythm && rHandForRhythm.fingersExtended) {
      const { thumb, index, middle, ring, pinky } = rHandForRhythm.fingersExtended;
      
      // Hand Gesture 1: Index finger only -> triplets (三连音)
      if (index && !middle && !ring && !pinky && !thumb) {
        activeRhythmModel = 'triplets';
      } 
      // Hand Gesture 2: Index + Middle -> four16ths (四个十六 / 连续16分音符)
      else if (index && middle && !ring && !pinky && !thumb) {
        activeRhythmModel = 'four16ths';
      } 
      // Hand Gesture 3: Middle + Ring + Pinky (👌) OR Index + Middle + Ring -> front16th (前十六)
      else if ((!index && middle && ring && pinky && !thumb) || (index && middle && ring && !pinky && !thumb)) {
        activeRhythmModel = 'front16th';
      } 
      // Hand Gesture 4: Index + Middle + Ring + Pinky -> back16th (后十六)
      else if (index && middle && ring && pinky && !thumb) {
        activeRhythmModel = 'back16th';
      } 
      // Hand Gesture 5: All 5 fingers extended (🖐️) OR Hand Gesture 6: Thumb + Pinky (🤙) -> syncopated (小切分)
      else if ((index && middle && ring && pinky && thumb) || (thumb && pinky && !index && !middle && !ring)) {
        activeRhythmModel = 'syncopated';
      }
    }
 
    // Update settings modes
    engine.setPerformanceModes(currentParams.leftPlayMode, currentParams.rightPlayMode, activeRhythmModel);
 
    // Keep state in sync
    setParams(prev => ({
      ...prev,
      frequency: targetFreq,
      volume: targetVol,
      activePreset: activePreset,
      rhythmModel: activeRhythmModel
    }));
  };

  const handleCameraActiveChange = (active: boolean) => {
    setCameraActive(active);
    if (active) {
      ensureAudioInit();
    }
  };

  const handleToggleFeed = async () => {
    const isBothOn = cameraActive && !params.muted;
    if (!isBothOn) {
      setCameraActive(true);
      await ensureAudioInit();
      handleParamsChange({ muted: false });
      triggerNotification('驱动已启动', '一键启动视频与音频', 'fx');
    } else {
      setCameraActive(false);
      handleParamsChange({ muted: true });
      triggerNotification('驱动已关闭', '摄像头与音频已关闭', 'fx');
    }
  };

  const handleToggleTab = () => {
    setActiveTab(prev => prev === 'performance' ? 'console' : 'performance');
  };

  return (
    <div 
      className="min-h-[100dvh] h-[100dvh] bg-[#C2B89D] sm:p-4 text-black flex flex-col font-mono p-0 select-none relative animate-fade-in overflow-hidden md:p-6" 
      id="gesture-theremin-app"
    >
      {/* Dynamic Air Gesture Notification Toast */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none" id="gesture-notifications">
        <AnimatePresence mode="popLayout">
          {notification && (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="p-4 rounded-none border-[3px] border-black text-left max-w-sm flex gap-3 bg-[#E8DFC0]"
            >
              <div className="flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-black/60 mb-1">
                  {notification.type === 'preset' ? 'RIGHT GESTURE TRIGGER ✊' : 'LEFT GESTURE TRIGGER ✊'}
                </div>
                <div className="text-xs font-bold tracking-tight text-black leading-tight uppercase">
                  {notification.text}
                </div>
                {notification.subText && (
                  <div className="text-[10px] opacity-80 mt-1 leading-snug text-black font-bold uppercase">
                    {notification.subText}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* The Retro DOS Window Frame */}
      <div className="w-full max-w-7xl mx-auto border-0 sm:border-[4px] border-black bg-[#E8DFC0] flex flex-col rounded-none my-0 sm:my-2 overflow-hidden shadow-none sm:shadow-[12px_12px_0px_#4A3E31] flex-1 min-h-0" id="camera-exe-window">
        {/* Window Title Bar */}
        <div className="bg-black text-[#D0D8B0] h-10 landscape:h-8 px-2 sm:px-4 flex items-center justify-between font-mono font-bold select-none border-b-[3px] sm:border-b-4 border-black shrink-0" id="window-titlebar">
          <div className="flex items-center gap-2 text-[11px] sm:text-sm landscape:text-[11px] uppercase overflow-hidden whitespace-nowrap text-ellipsis">
            <span>■</span>
            <span className="hidden sm:inline">CAMERA.EXE - HAND-GESTURE DEBUGGER & SYNTH CONSOLE [V1.10]</span>
            <span className="inline sm:hidden">CAMERA.EXE [V1.10]</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="px-1.5 py-0.5 border border-[#D0D8B0] bg-black hover:bg-[#D0D8B0]/20 text-[#D0D8B0] cursor-pointer">?</span>
            <span className="px-1.5 py-0.5 border border-[#D0D8B0] bg-black hover:bg-[#D0D8B0]/20 text-[#D0D8B0] cursor-pointer">_</span>
            <span className="px-1.5 py-0.5 border border-[#D0D8B0] bg-black hover:bg-[#D0D8B0]/20 text-[#D0D8B0] cursor-pointer font-bold">X</span>
          </div>
        </div>

        {/* Menu Action Bar - Responsive & Unified for Portrait & Landscape */}
        <div className="flex items-center justify-start gap-2 sm:gap-6 px-2 sm:px-6 py-1.5 sm:py-2.5 border-b-[3px] sm:border-b-[4px] border-black bg-[#E8DFC0] shrink-0 w-full overflow-x-auto overflow-y-hidden" id="window-menubar">
          {/* Left Button (Keycap F1): 开始/停止 (Start/Toggle Feed) */}
          <button
            id="btn-play-retro"
            onClick={handleToggleFeed}
            className={`relative px-2 sm:px-4 py-1 sm:py-1.5 border-[2px] sm:border-[3px] border-black text-xs font-bold transition-all cursor-pointer rounded-none uppercase select-none flex items-center gap-1.5 sm:gap-3 shadow-[2px_2px_0px_0px_#4A3E31] sm:shadow-[4px_4px_0px_0px_#4A3E31] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_#4A3E31] ${
              cameraActive && !params.muted
                ? 'bg-black text-[#D0D8B0]'
                : 'bg-[#C2B89D] text-black hover:bg-black/10'
            }`}
          >
            <div className="w-4 h-4 sm:w-5 sm:h-5 border border-current flex items-center justify-center rounded-none shrink-0 bg-transparent">
              <svg className="w-2.5 h-2.5 sm:w-3 h-3 fill-current" viewBox="0 0 24 24" id="play-triangle-svg">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <div className="flex flex-col items-start font-mono text-left leading-none">
              <span className="text-[7px] sm:text-[8px] opacity-70 tracking-tighter">F1 KEY</span>
              <span className="text-[10px] sm:text-[12px] font-black mt-0.5 tracking-wide">开始 / START</span>
            </div>
          </button>

          {/* Right Button (Keycap F2): 调试 (Debug/Toggle Console) */}
          <button
            id="btn-debug-retro"
            onClick={handleToggleTab}
            className={`relative px-2 sm:px-4 py-1 sm:py-1.5 border-[2px] sm:border-[3px] border-black text-xs font-bold transition-all cursor-pointer rounded-none uppercase select-none flex items-center gap-1.5 sm:gap-3 shadow-[2px_2px_0px_0px_#4A3E31] sm:shadow-[4px_4px_0px_0px_#4A3E31] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_#4A3E31] ${
              activeTab === 'console'
                ? 'bg-black text-[#D0D8B0]'
                : 'bg-[#C2B89D] text-black hover:bg-black/10'
            }`}
          >
            <div className="w-4 h-4 sm:w-5 sm:h-5 border border-current flex items-center justify-center rounded-none shrink-0 bg-transparent">
              <svg className="w-2.5 h-2.5 sm:w-3 h-3 stroke-current" viewBox="0 0 24 24" strokeWidth="2.5" fill="none" id="debug-faders-svg">
                <line x1="6" y1="4" x2="6" y2="20" />
                <circle cx="6" cy="14" r="1.5" className="fill-current" />
                <line x1="12" y1="4" x2="12" y2="20" />
                <circle cx="12" cy="8" r="1.5" className="fill-current" />
                <line x1="18" y1="4" x2="18" y2="20" />
                <circle cx="18" cy="16" r="1.5" className="fill-current" />
              </svg>
            </div>
            <div className="flex flex-col items-start font-mono text-left leading-none">
              <span className="text-[7px] sm:text-[8px] opacity-70 tracking-tighter">F2 KEY</span>
              <span className="text-[10px] sm:text-[12px] font-black mt-0.5 tracking-wide">调试 / CONSOLE</span>
            </div>
          </button>

          {/* Quick Mute button as a third horizontal button in menubar */}
          <button
            id="btn-mute-retro"
            onClick={() => handleParamsChange({ muted: !params.muted })}
            className={`relative px-2 sm:px-4 py-1 sm:py-1.5 border-[2px] sm:border-[3px] border-black text-xs font-bold transition-all cursor-pointer rounded-none uppercase select-none flex items-center gap-1.5 sm:gap-3 shadow-[2px_2px_0px_0px_#4A3E31] sm:shadow-[4px_4px_0px_0px_#4A3E31] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_#4A3E31] ${
              params.muted
                ? 'bg-[#C2B89D] text-black/50'
                : 'bg-black text-[#D0D8B0]'
            }`}
          >
            <div className="w-4 h-4 sm:w-5 sm:h-5 border border-current flex items-center justify-center rounded-none shrink-0 bg-transparent text-[8px] font-mono">
              🔊
            </div>
            <div className="flex flex-col items-start font-mono text-left leading-none">
              <span className="text-[7px] sm:text-[8px] opacity-70 tracking-tighter">F3 KEY</span>
              <span className="text-[10px] sm:text-[12px] font-black mt-0.5 tracking-wide">
                {params.muted ? '静音' : `音量:${Math.round(params.volume * 100)}%`}
              </span>
            </div>
          </button>

          {/* Status Indicator Lamps on the right */}
          <div className="ml-auto flex items-center gap-2 sm:gap-4 text-[9px] sm:text-xs font-mono font-black uppercase">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className={`inline-block w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-none border border-black ${cameraActive ? 'bg-[#38A888] animate-pulse' : 'bg-red-700'}`}></span>
              <span className="hidden xs:inline">READY</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className={`inline-block w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-none border border-black ${(hands.left.active || hands.right.active) ? 'bg-[#38A888]' : 'bg-black/30'}`}></span>
              <span className="hidden xs:inline">TRACKING</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className={`inline-block w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-none border border-black ${(!params.muted && audioInitialized) ? 'bg-[#38A888]' : 'bg-black/30'}`}></span>
              <span className="hidden xs:inline">AUDIO ON</span>
            </div>
          </div>
        </div>

        {/* The DOS Client Window Content Panel with zero padding for full bleed viewfinder */}
        <div className="flex-1 p-0 bg-[#E8DFC0] overflow-hidden flex flex-col min-h-0" id="window-body">
          <AnimatePresence mode="wait">
            {activeTab === 'performance' ? (
              /* LAYER 1: 100% Full Bleed Camera Performance View */
              <motion.div
                key="stage-layer"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="flex-1 w-full h-full min-h-0 relative bg-[#D0D8B0] retro-scanlines"
                id="stage-layer-view"
              >
                <CameraTracker
                  onHandsUpdate={handleHandsUpdate}
                  onCameraActiveChange={handleCameraActiveChange}
                  cameraActive={cameraActive}
                  analyser={audioInitialized ? audioEngineRef.current?.getAnalyser() || null : null}
                  muted={params.muted}
                  activeVolume={params.volume}
                />
              </motion.div>
            ) : (
              /* LAYER 2: Settings Console Grid with comfortable padding */
              <motion.div
                key="console-layer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="flex-1 p-3 sm:p-5 grid grid-cols-1 landscape:grid-cols-12 gap-2 sm:gap-5 min-h-0 h-full overflow-y-auto landscape:overflow-hidden"
                id="console-layer-view"
              >
                {/* LEFT COLUMN: Synthesizer Controls (Width 5 span) */}
                <div className="landscape:col-span-5 h-full overflow-hidden landscape:min-h-0 min-h-[400px] flex flex-col" id="left-column-workspace">
                  <ThereminControls
                     params={params}
                     onParamsChange={handleParamsChange}
                     onResetToDefaults={handleResetToDefaults}
                     frequencyRanges={FREQ_RANGES}
                     rhythmLayer={rhythmLayer}
                     onRhythmLayerChange={setRhythmLayer}
                  />
                </div>

                {/* RIGHT COLUMN: Interactive Antennas & Oscilloscope Visualizer (Width 7 span) */}
                <div className="landscape:col-span-7 flex flex-col gap-3 sm:gap-4 h-full overflow-y-auto pr-0.5" id="right-column-workspace">
                  
                  {/* Top Row: Antenna Space Field */}
                  <div className="min-h-[230px] sm:min-h-[280px] flex-1" id="row-antennas">
                    <ThereminAntennas
                      leftHand={hands.left}
                      rightHand={hands.right}
                      frequency={params.frequency}
                      volume={params.volume}
                      noteInfo={noteInfo}
                      muted={params.muted}
                    />
                  </div>

                  {/* Bottom Row: Oscilloscope Visualizer */}
                  <div className="min-h-[160px] sm:min-h-[210px] flex-1" id="row-visualizers">
                    <Visualizer
                      analyser={audioInitialized ? audioEngineRef.current?.getAnalyser() || null : null}
                      activeFrequency={params.frequency}
                      activeVolume={params.volume}
                      muted={params.muted}
                    />
                  </div>

                  {/* Retro tactile back-button */}
                  <div className="flex justify-center mt-0.5 shrink-0 landscape:hidden">
                    <button
                      onClick={() => setActiveTab('performance')}
                      className="flex items-center gap-2 px-4 py-1.5 sm:py-2.5 bg-[#C2B89D] hover:bg-black hover:text-[#C2B89D] text-black font-bold border-[3px] border-black rounded-none transition-colors uppercase tracking-wider text-[10px] sm:text-xs cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>RETURN TO PERFORMANCE VIEW / 返回监控画面</span>
                    </button>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Retro tactile footer bar / status bar at the very bottom of the DOS window */}
        <div className="bg-[#E8DFC0] text-black border-t-[2px] sm:border-t-[3px] border-black px-3 py-1.5 flex flex-col sm:flex-row justify-between items-center text-[9px] sm:text-xs font-mono font-bold uppercase shrink-0 gap-1" id="app-footer-bar">
          <div>Designed by LIFAN  &copy; 2026</div>
          <div className="flex gap-4">
            <span>MODEL: CAMERA_EXE_1.10</span>
            {activeTab === 'console' && (
              <>
                <span>BPM: {params.tempoBpm} CLOCK</span>
                <span>LATENCY: ~15MS</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
