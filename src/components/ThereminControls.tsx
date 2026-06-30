import { WaveformType, SynthParams, FreqRange } from '../types';
import { Settings, RefreshCw, VolumeX, Volume2, HelpCircle as HelpIcon, Zap, Music, Radio, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ThereminControlsProps {
  params: SynthParams;
  onParamsChange: (params: Partial<SynthParams>) => void;
  onResetToDefaults: () => void;
  frequencyRanges: FreqRange[];
  rhythmLayer?: number;
  onRhythmLayerChange?: (layer: number) => void;
}

/**
 * Custom Segmented Retro Slider that aligns with the user request to show bands 0-100,
 * but adheres strictly to the DOS Style Guide by using flat, high-contrast monochrome
 * segmented indicator blocks (like a physical synthesizer LED track) instead of prohibited gradients.
 */
function RetroSegmentedSlider({
  min,
  max,
  step,
  value,
  onChange,
  label,
  displayValue
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (val: number) => void;
  label: string;
  displayValue?: string;
}) {
  const percent = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const activeSegmentsCount = Math.round(percent / 10); // 10 segments total

  return (
    <div className="flex flex-col gap-1.5 font-mono select-none" id={`retro-slider-container-${label.replace(/\s+/g, '-').toLowerCase()}`}>
      {/* Label and 0-100% badge */}
      <div className="flex justify-between items-center text-[11px] font-bold uppercase text-black">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-black"></span>
          {label}
        </span>
        <span className="px-2 py-0.5 border-[2px] border-black bg-[#D0D8B0] rounded-none font-bold text-[10px] tracking-tight">
          {displayValue || `${Math.round(percent)}%`}
        </span>
      </div>

      <div className="relative flex items-center group h-8">
        {/* Track with thick black outline and segmented LED bands */}
        <div className="absolute left-0 right-0 h-5 border-[2.5px] border-black bg-[#C2B89D] rounded-none pointer-events-none overflow-hidden flex">
          {[...Array(10)].map((_, i) => {
            const isActive = i < activeSegmentsCount;
            return (
              <div
                key={i}
                className={`flex-1 border-r border-black/30 transition-colors ${
                  isActive ? 'bg-[#D0D8B0] first:bg-[#D0D8B0]' : 'bg-[#C2B89D]'
                }`}
              />
            );
          })}
        </div>

        {/* Real HTML Range Slider overlayed invisibly */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="relative w-full h-8 opacity-0 cursor-pointer z-10"
        />

        {/* Custom DOS styled slider thumb [ █ ] */}
        <div 
          className="absolute w-5 h-7 border-[2.5px] border-black bg-[#E8DFC0] pointer-events-none flex items-center justify-center font-bold text-[10px] text-black transition-all rounded-none"
          style={{ left: `calc(${percent}% - 10px)` }}
        >
          █
        </div>
      </div>
    </div>
  );
}

function getActiveLayerName(pattern: string, layer: number): string {
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

function getActiveLayerDesc(pattern: string, layer: number): string {
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
      '第 2/6/10/14 反拍处加入轻盈 closed hat，模拟雷鬼吉他切音。',
      '军鼓在第三拍与底鼓完美合击，落地重音，产生沉重的反作用力。',
      '反拍延迟 rimshot 音效切入，在混响空间中泛起阵阵迷离涟漪。',
      '完全释放反拍 Open Hi-Hat 与多重过门，步入 Dub 幻境核心。',
      '大混响 Dub 汽笛轰鸣！底鼓重整为 4/4 四分音，开启巨浪狂欢！'
    ]
  };
  return descs[pattern]?.[layer] || '';
}

export default function ThereminControls({
  params,
  onParamsChange,
  onResetToDefaults,
  frequencyRanges,
  rhythmLayer = 0,
  onRhythmLayerChange
}: ThereminControlsProps) {
  const [pulseActive, setPulseActive] = useState(false);

  // Blinking LED pulse synchronized dynamically to params.tempoBpm
  useEffect(() => {
    const beatMs = 60000 / params.tempoBpm;
    const interval = setInterval(() => {
      setPulseActive(true);
      const timer = setTimeout(() => setPulseActive(false), 90);
      return () => clearTimeout(timer);
    }, beatMs);
    return () => clearInterval(interval);
  }, [params.tempoBpm]);

  const waveforms: { id: WaveformType; label: string; icon: string; desc: string }[] = [
    { id: 'sine', label: '正弦波', icon: '〰️', desc: '经典空灵特雷门琴' },
    { id: 'triangle', label: '三角波', icon: '🔺', desc: '暖和圆润木管音色' },
    { id: 'sawtooth', label: '锯齿波', icon: '🪚', desc: '太空霸气侵略合成' },
    { id: 'square', label: '方波', icon: '⬜', desc: '复古 FC 8bit 街机' }
  ];

  return (
    <div 
      className="relative bg-[#E8DFC0] border-[4px] border-black rounded-none p-5 flex flex-col gap-6 h-full overflow-y-auto text-black select-none font-mono" 
      id="theremin-controls-panel"
    >
      {/* 1. DOS styled Header with reset button */}
      <div className="flex items-center justify-between border-b-[3px] border-black pb-4" id="controls-header">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-black" />
          <span className="text-sm font-bold tracking-wider uppercase">
            CONSOLE / 音色控制台
          </span>
        </div>
        <button
          onClick={onResetToDefaults}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#C2B89D] hover:bg-black hover:text-[#C2B89D] border-[3px] border-black rounded-none text-black transition-colors cursor-pointer uppercase"
          id="btn-reset-params"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>RESTORATION</span>
        </button>
      </div>

      {/* 2. Standby / On Air state banner */}
      <div className="flex gap-3" id="sound-state-banner">
        <button
          onClick={() => onParamsChange({ muted: !params.muted })}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-none font-bold text-xs uppercase tracking-wider transition-colors border-[3px] border-black cursor-pointer ${
            params.muted
              ? 'bg-[#C2B89D] text-black/60 hover:bg-black hover:text-[#C2B89D]'
              : 'bg-black text-[#D0D8B0]'
          }`}
          id="btn-master-mute"
        >
          {params.muted ? (
            <>
              <VolumeX className="w-4 h-4 text-black shrink-0" />
              <span>[ STANDBY / 点击激活发声 ]</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4 text-[#D0D8B0] shrink-0" />
              <span>[ ON AIR / 正在实时演奏 ]</span>
            </>
          )}
        </button>
      </div>

      {/* 3. BPM Control with editable range slider */}
      <div className="bg-[#C2B89D] border-[3px] border-black rounded-none p-4 flex flex-col gap-3" id="bpm-control-panel">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-black/50 uppercase tracking-widest">MASTER TEMPO</span>
            <span className="text-lg font-bold text-black tracking-wider">{params.tempoBpm} BPM</span>
          </div>
          <div className="flex items-center gap-2 bg-[#E8DFC0] px-2.5 py-1.5 border-[2.5px] border-black rounded-none">
            <span className="text-[9px] font-bold uppercase">BEAT TICK</span>
            {/* Flat Solid Black/White Blink LED */}
            <div 
              className={`w-3.5 h-3.5 rounded-none border-2 border-black transition-colors ${
                pulseActive 
                  ? 'bg-black' 
                  : 'bg-[#E8DFC0]'
              }`}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <input
            type="range"
            min="60"
            max="160"
            step="1"
            value={params.tempoBpm}
            onChange={(e) => onParamsChange({ tempoBpm: parseInt(e.target.value, 10) })}
            className="w-full h-2 bg-[#E8DFC0] border-[2px] border-black rounded-none appearance-none cursor-pointer accent-black"
            id="bpm-range-input"
          />
          <div className="flex justify-between text-[8px] font-bold text-black/60 px-0.5">
            <span>60 BPM</span>
            <span>90</span>
            <span>110 (DEF)</span>
            <span>135</span>
            <span>160 BPM</span>
          </div>
        </div>

        {/* Quick presets buttons */}
        <div className="grid grid-cols-5 gap-1.5">
          {[60, 90, 110, 130, 160].map((bpmVal) => (
            <button
              key={bpmVal}
              onClick={() => onParamsChange({ tempoBpm: bpmVal })}
              className={`py-1 text-[10px] font-bold rounded-none border-[2px] border-black transition-colors cursor-pointer ${
                params.tempoBpm === bpmVal
                  ? 'bg-black text-[#E8DFC0]'
                  : 'bg-[#E8DFC0] text-black hover:bg-black hover:text-[#E8DFC0]'
              }`}
            >
              {bpmVal === 110 ? '110*' : bpmVal}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Left Hand Bass Modes */}
      <div className="flex flex-col gap-3 border-t-[3px] border-black pt-4" id="group-left-modes">
        <label className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-black" />
          <span>左手低音演奏模式 (Left Bass Mode)</span>
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => onParamsChange({ leftPlayMode: 'drone' })}
            className={`flex flex-col items-center p-3 border-[3px] border-black text-center transition-colors rounded-none cursor-pointer ${
              params.leftPlayMode === 'drone'
                ? 'bg-black text-[#E8DFC0]'
                : 'bg-[#E8DFC0] text-black hover:bg-black/10'
            }`}
          >
            <span className="text-xs font-bold tracking-wider">通奏低音 (Drone)</span>
            <span className="text-[9px] opacity-80 mt-1 leading-tight">
              大空间超宽氛围低通扫频声场
            </span>
          </button>
          <button
            onClick={() => onParamsChange({ leftPlayMode: 'pulse' })}
            className={`flex flex-col items-center p-3 border-[3px] border-black text-center transition-colors rounded-none cursor-pointer ${
              params.leftPlayMode === 'pulse'
                ? 'bg-black text-[#E8DFC0]'
                : 'bg-[#E8DFC0] text-black hover:bg-black/10'
            }`}
          >
            <span className="text-xs font-bold tracking-wider">脉冲脉搏 (Pulse)</span>
            <span className="text-[9px] opacity-80 mt-1 leading-tight">
              短促断奏、精准跟随主时钟律动
            </span>
          </button>
        </div>
      </div>

      {/* 5. Right Hand Lead Modes */}
      <div className="flex flex-col gap-3 border-t-[3px] border-black pt-4" id="group-right-modes">
        <label className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
          <Music className="w-4 h-4 text-black" />
          <span>右手旋律与和声对位模式 (Right Melody Mode)</span>
        </label>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { id: 'arp', label: '五声琶音 (Arp)', desc: '五声音阶自动琶音对位' },
            { id: 'stepwise', label: '极速级进', desc: '相邻级进台阶式滑行' },
            { id: 'thirdLeaps', label: '三度跳进', desc: '美妙起伏的三度音程' },
            { id: 'jazzLoop', label: '爵士模进', desc: '和弦爵士音程模进' },
            { id: 'harmonicIntervals', label: '和声音程', desc: '双音声部音程点缀' },
            { id: 'blockChords', label: '柱式和弦', desc: '饱满三声部柱式和弦' },
            { id: 'auto', label: '智能适配', desc: '根据节奏智能切换' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => onParamsChange({ rightPlayMode: item.id as any })}
              className={`flex flex-col items-center justify-center p-2 border-[2px] border-black text-center transition-colors rounded-none cursor-pointer ${
                params.rightPlayMode === item.id
                  ? 'bg-black text-[#E8DFC0]'
                  : 'bg-[#E8DFC0] text-black hover:bg-black/10'
              }`}
            >
              <span className="text-[11px] font-bold leading-tight">{item.label}</span>
              <span className="text-[8px] opacity-75 leading-tight mt-0.5">{item.desc}</span>
            </button>
          ))}
        </div>

        {params.rightPlayMode === 'arp' && (
          <div className="mt-2" id="random-melody-mix-container">
            <RetroSegmentedSlider
              min={0}
              max={1.0}
              step={0.05}
              value={params.randomMelodyMix}
              onChange={(val) => onParamsChange({ randomMelodyMix: val })}
              label="琶音 ⇄ 随机旋律交叉度 / Random Melody Mix"
              displayValue={params.randomMelodyMix === 0 ? '纯正琶音 (0%)' : params.randomMelodyMix === 1 ? '纯随机旋律 (100%)' : `交叉混合 (${Math.round(params.randomMelodyMix * 100)}%)`}
            />
            <div className="text-[8px] text-black/55 mt-1 leading-normal">
              * 拖动滑块混合五声琶音与随机音高旋律，手掌伸缩张开合拢时琶音音域可达三个八度。
            </div>
          </div>
        )}
      </div>

      {/* 5.5. Four Major Harmonic Systems and Scale Settings */}
      <div className="flex flex-col gap-3.5 border-t-[3px] border-black pt-4" id="group-harmonic-theory">
        <label className="text-xs font-bold uppercase tracking-wider text-black flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-black animate-pulse" />
            <span>四大和声调式控制台</span>
          </span>
          <span className="text-[9px] bg-[#D0D8B0] text-black px-1.5 py-0.5 border-[2px] border-black font-bold uppercase">
            HARM_SYS
          </span>
        </label>

        {/* System Choice */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-black/55 uppercase tracking-wide">和声体系 (Harmonic System)</span>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 'classical', label: '大小调', defaultMode: 'minor' },
              { id: 'church', label: '中古调式', defaultMode: 'dorian' },
              { id: 'jazz', label: '爵士调式', defaultMode: 'lydian_dominant' },
              { id: 'eastern', label: '民族五声', defaultMode: 'gong' }
            ].map((sys) => (
              <button
                key={sys.id}
                onClick={() => onParamsChange({ harmonicSystem: sys.id as any, scaleMode: sys.defaultMode as any })}
                className={`py-1.5 px-1 text-center border-[2px] border-black font-bold text-[10px] transition-colors rounded-none cursor-pointer ${
                  params.harmonicSystem === sys.id
                    ? 'bg-black text-[#E8DFC0]'
                    : 'bg-[#E8DFC0] text-black hover:bg-black/10'
                }`}
              >
                {sys.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scale Mode Choice */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-black/55 uppercase tracking-wide">调式选择 (Scale Mode)</span>
          <div className="grid grid-cols-2 gap-1.5">
            {params.harmonicSystem === 'classical' && [
              { id: 'major', name: '自然大调 (Major)' },
              { id: 'minor', name: '自然小调 (Minor)' },
              { id: 'harmonic_minor', name: '和声小调' },
              { id: 'melodic_minor', name: '旋律小调' }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => onParamsChange({ scaleMode: m.id as any })}
                className={`py-1 px-2 text-left border-[2px] border-black text-[9px] font-bold flex items-center justify-between transition-colors rounded-none cursor-pointer ${
                  params.scaleMode === m.id
                    ? 'bg-black text-[#E8DFC0]'
                    : 'bg-[#E8DFC0] text-black hover:bg-black/10'
                }`}
              >
                <span>{m.name}</span>
                {params.scaleMode === m.id && <span>[X]</span>}
              </button>
            ))}

            {params.harmonicSystem === 'church' && [
              { id: 'dorian', name: '多利亚 (Dorian)' },
              { id: 'phrygian', name: '弗里吉亚 (Phrygian)' },
              { id: 'lydian', name: '利底亚 (Lydian)' },
              { id: 'mixolydian', name: '混合利底亚' },
              { id: 'locrian', name: '洛克里亚 (Locrian)' }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => onParamsChange({ scaleMode: m.id as any })}
                className={`py-1 px-2 text-left border-[2px] border-black text-[9px] font-bold flex items-center justify-between transition-colors rounded-none cursor-pointer ${
                  params.scaleMode === m.id
                    ? 'bg-black text-[#E8DFC0]'
                    : 'bg-[#E8DFC0] text-black hover:bg-black/10'
                }`}
              >
                <span>{m.name}</span>
                {params.scaleMode === m.id && <span>[X]</span>}
              </button>
            ))}

            {params.harmonicSystem === 'jazz' && [
              { id: 'lydian_dominant', name: '利底亚属七 (Lydian Dom)' },
              { id: 'altered', name: '变化音阶 (Altered)' },
              { id: 'diminished', name: '减音阶 (Diminished)' },
              { id: 'super_locrian', name: '超级洛克里亚' }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => onParamsChange({ scaleMode: m.id as any })}
                className={`py-1 px-2 text-left border-[2px] border-black text-[9px] font-bold flex items-center justify-between transition-colors rounded-none cursor-pointer ${
                  params.scaleMode === m.id
                    ? 'bg-black text-[#E8DFC0]'
                    : 'bg-[#E8DFC0] text-black hover:bg-black/10'
                }`}
              >
                <span>{m.name}</span>
                {params.scaleMode === m.id && <span>[X]</span>}
              </button>
            ))}

            {params.harmonicSystem === 'eastern' && [
              { id: 'gong', name: '宫调式 (Gong - C)' },
              { id: 'shang', name: '商调式 (Shang - D)' },
              { id: 'jue', name: '角调式 (Jue - E)' },
              { id: 'zhi', name: '徵调式 (Zhi - G)' },
              { id: 'yu', name: '羽调式 (Yu - A)' }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => onParamsChange({ scaleMode: m.id as any })}
                className={`py-1 px-2 text-left border-[2px] border-black text-[9px] font-bold flex items-center justify-between transition-colors rounded-none cursor-pointer ${
                  params.scaleMode === m.id
                    ? 'bg-black text-[#E8DFC0]'
                    : 'bg-[#E8DFC0] text-black hover:bg-black/10'
                }`}
              >
                <span>{m.name}</span>
                {params.scaleMode === m.id && <span>[X]</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Scale Root Note Choice */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-black/55 uppercase tracking-wide">主音根音 (Scale Root Key)</span>
          <div className="grid grid-cols-6 gap-1">
            {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((note) => (
              <button
                key={note}
                onClick={() => onParamsChange({ scaleRoot: note as any })}
                className={`py-1 text-center border-[2px] border-black text-[10px] font-bold transition-colors rounded-none cursor-pointer ${
                  params.scaleRoot === note
                    ? 'bg-black text-[#D0D8B0]'
                    : 'bg-[#E8DFC0] text-black hover:bg-black/10'
                }`}
              >
                {note}
              </button>
            ))}
          </div>
        </div>

        {/* Chord Degree Controls & Auto Toggle */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-black/55 uppercase tracking-wide">
              {params.autoChordProgression ? '🔴 [智能自动和弦进行中]' : '手动定位级数 (Chord Degree)'}
            </span>
            <button
              onClick={() => onParamsChange({ autoChordProgression: !params.autoChordProgression })}
              className={`px-2.5 py-1 text-[9px] font-bold border-[2px] border-black transition-colors rounded-none cursor-pointer ${
                params.autoChordProgression 
                  ? 'bg-black text-[#D0D8B0]' 
                  : 'bg-[#C2B89D] text-black'
              }`}
            >
              {params.autoChordProgression ? 'AUTO_LOOP: ON' : 'MANUAL: ON'}
            </button>
          </div>

          {!params.autoChordProgression && (
            <div className="grid grid-cols-7 gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((deg) => (
                <button
                  key={deg}
                  onClick={() => onParamsChange({ activeChordDegree: deg })}
                  className={`py-1.5 text-center border-[2px] border-black font-bold text-[10px] transition-colors rounded-none cursor-pointer ${
                    params.activeChordDegree === deg
                      ? 'bg-black text-[#E8DFC0]'
                      : 'bg-[#E8DFC0] text-black hover:bg-black/10'
                  }`}
                >
                  {deg === 1 ? 'I' : deg === 2 ? 'ii' : deg === 3 ? 'iii' : deg === 4 ? 'IV' : deg === 5 ? 'V' : deg === 6 ? 'vi' : 'vii°'}
                </button>
              ))}
            </div>
          )}
          
          <div className="text-[8px] text-black/55 leading-normal">
            * 开启自动进行时，左手和弦根音与右手主音琶音在主时钟下强力对齐。
          </div>
        </div>
      </div>

      {/* 6. Rhythm Models */}
      <div className="flex flex-col gap-2.5 border-t-[3px] border-black pt-4" id="group-rhythm-model">
        <label className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
          <Radio className="w-4 h-4 text-black" />
          <span>节拍节奏模型 (BPM Rhythm Patterns)</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'triplets', label: '三连音 (手势1)', desc: '食指☝️ 连续三连音' },
            { id: 'four16ths', label: '四个十六 (手势2)', desc: '食指中指✌️ 16分音' },
            { id: 'front16th', label: '前十六 (手势3)', desc: '中无名小指👌 前十六' },
            { id: 'back16th', label: '后十六 (手势4)', desc: '食中无名小🖐️ 后十六' },
            { id: 'syncopated', label: '切分音 (手势6)', desc: '拇指小指🤙 切分音型' },
            { id: 'dotted', label: '附点音', desc: '摇摆附点节奏' },
            { id: 'random', label: '随机切换', desc: '手势无缝切变' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => onParamsChange({ rhythmModel: item.id as any })}
              className={`flex flex-col items-center justify-center p-2 border-[2px] border-black transition-colors rounded-none text-center cursor-pointer ${
                params.rhythmModel === item.id
                  ? 'bg-black text-[#E8DFC0]'
                  : 'bg-[#E8DFC0] text-black hover:bg-black/10'
              }`}
            >
              <span className="text-[10px] font-bold">{item.label}</span>
              <span className="text-[8px] opacity-75 mt-0.5 leading-tight">{item.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 7. Synthesizer Waveform */}
      <div className="flex flex-col gap-2 border-t-[3px] border-black pt-4" id="group-waveform">
        <label className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
          <Music className="w-4 h-4 text-black" />
          <span>振荡发生器波形 (Synthesizer Waveform)</span>
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          {waveforms.map((wave) => (
            <button
              key={wave.id}
              onClick={() => onParamsChange({ waveform: wave.id })}
              className={`flex flex-col items-start p-2.5 border-[3px] border-black text-left transition-colors rounded-none cursor-pointer ${
                params.waveform === wave.id
                  ? 'bg-black text-[#E8DFC0]'
                  : 'bg-[#E8DFC0] text-black hover:bg-black/10'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-sm">{wave.icon}</span>
                <span className="text-xs font-bold">{wave.label}</span>
              </div>
              <span className="text-[9px] opacity-80 leading-tight">
                {wave.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 8. Presets Timbres */}
      <div className="flex flex-col gap-2 border-t-[3px] border-black pt-4" id="group-preset-timbre">
        <label className="text-xs font-bold uppercase tracking-wider text-black flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-black" />
            <span>太空复古音色库 (10 Timbres)</span>
          </span>
          <span className="text-[9px] bg-black text-[#D0D8B0] px-1.5 py-0.5 rounded-none font-bold">10 PRESETS</span>
        </label>
        <div className="grid grid-cols-2 gap-2" id="preset-list-container">
          {[
            { id: 'classic', label: '正弦波特雷门', icon: '🍃', desc: '纯净空气颤动' },
            { id: 'ambientPad', label: '电影感垫音', icon: '🌌', desc: '宽广滤波扫频' },
            { id: 'cyberpunkLead', label: '赛博电音铅', icon: '⚡', desc: '双锯齿波合奏' },
            { id: 'oceanBass', label: '史诗云端低音', icon: '☁️', desc: '史诗低频 Sub' },
            { id: 'cosmicArp', label: '星轨自动琶音', icon: '🌟', desc: '级数自动步进' },
            { id: 'nebulaStrings', label: '慢起合奏弦乐', icon: '🎻', desc: '合唱弦乐声场' },
            { id: 'arcade8Bit', label: 'FC红白像素音', icon: '👾', desc: '晶体管方波街机' },
            { id: 'glassBell', label: '水晶全息钟琴', icon: '🔮', desc: '晶莹清亮空灵' },
            { id: 'darkDrone', label: '暗潮工業低频', icon: '⛓️', desc: '厚重重工业沉浸' },
            { id: 'radioStatic', label: '扫频电波天线', icon: '🛰️', desc: '太空通讯电波' }
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => onParamsChange({ activePreset: preset.id as any })}
              className={`flex items-start gap-2 p-2 border-[2px] border-black text-left transition-colors rounded-none cursor-pointer ${
                params.activePreset === preset.id
                  ? 'bg-black text-[#E8DFC0]'
                  : 'bg-[#E8DFC0] text-black hover:bg-black/10'
              }`}
            >
              <span className="text-sm leading-none mt-0.5">{preset.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold truncate leading-tight">{preset.label}</div>
                <div className="text-[8px] opacity-80 leading-none mt-1 truncate">{preset.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 9. RAINBOW GRADIENT SLIDERS - SECOND PAGE TIMBRE ADJUSTMENT */}
      <div className="flex flex-col gap-4 border-t-[3px] border-black pt-4" id="group-rainbow-sliders">
        <label className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
          <Settings className="w-4 h-4 text-black" />
          <span>高保真模拟调音参量 (High-Fidelity Parameters)</span>
        </label>

        {/* Filter Cutoff */}
        <RetroSegmentedSlider
          min={150}
          max={12000}
          step={50}
          value={params.filterCutoff}
          onChange={(val) => onParamsChange({ filterCutoff: val })}
          label="滤波器截止频率 / Filter Cutoff"
          displayValue={params.filterCutoff >= 1000 ? `${(params.filterCutoff / 1000).toFixed(1)} kHz` : `${params.filterCutoff} Hz`}
        />

        {/* Delay Time */}
        {params.delayEnabled && (
          <RetroSegmentedSlider
            min={0.1}
            max={1.2}
            step={0.05}
            value={params.delayTime}
            onChange={(val) => onParamsChange({ delayTime: val })}
            label="空间回音延迟时间 / Delay Time"
            displayValue={`${Math.round(params.delayTime * 1000)} ms`}
          />
        )}

        {/* Delay Feedback */}
        {params.delayEnabled && (
          <RetroSegmentedSlider
            min={0.0}
            max={0.9}
            step={0.05}
            value={params.delayFeedback}
            onChange={(val) => onParamsChange({ delayFeedback: val })}
            label="回声空间反馈深度 / Delay Feedback"
            displayValue={`${Math.round(params.delayFeedback * 100)}%`}
          />
        )}
      </div>

      {/* 10. DRUM MACHINE CONTROLS */}
      <div className="flex flex-col gap-3.5 border-t-[3px] border-black pt-4" id="group-drums-panel">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-black" />
            <span>左手电子鼓机 (808 Drum Machine)</span>
          </label>
          <button
            onClick={() => onParamsChange({ drumEnabled: !params.drumEnabled })}
            className={`w-12 h-6 p-0.5 border-[2.5px] border-black transition-colors rounded-none cursor-pointer ${
              params.drumEnabled ? 'bg-black' : 'bg-[#E8DFC0]'
            }`}
          >
            <div className={`w-4 h-4 border border-black transition-transform transform duration-150 rounded-none ${
              params.drumEnabled ? 'bg-[#D0D8B0] translate-x-5' : 'bg-black translate-x-0'
            }`} />
          </button>
        </div>

        {params.drumEnabled && (
          <div className="flex flex-col gap-4 bg-[#C2B89D] p-3.5 border-[3px] border-black rounded-none" id="drum-controls">
            {/* Drum Pattern Selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-black/55">选择鼓组节奏风格 (4 modes)</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'disco', label: 'Retro Disco', desc: '经典强击动次打次律动' },
                  { id: 'techno', label: 'Techno 4/4', desc: '工业重低音与四分击' },
                  { id: 'funk', label: 'Groovy Funk', desc: '动感碎拍与切分击' },
                  { id: 'reggae', label: 'Reggae Skank', desc: '经典反拍雷鬼律动' }
                ].map((pattern) => (
                  <button
                    key={pattern.id}
                    onClick={() => onParamsChange({ drumPattern: pattern.id as any })}
                    className={`flex flex-col items-center p-2 border-[2px] border-black text-center transition-colors rounded-none cursor-pointer ${
                      params.drumPattern === pattern.id
                        ? 'bg-black text-[#E8DFC0]'
                        : 'bg-[#E8DFC0] text-black hover:bg-black/10'
                    }`}
                  >
                    <span className="text-[10px] font-bold leading-none">{pattern.label}</span>
                    <span className="text-[8px] opacity-80 mt-1.5 leading-tight">{pattern.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Drum Volume */}
            <RetroSegmentedSlider
              min={0}
              max={1.0}
              step={0.05}
              value={params.drumVolume}
              onChange={(val) => onParamsChange({ drumVolume: val })}
              label="鼓组音量控制 / Drum Volume"
              displayValue={`${Math.round(params.drumVolume * 100)}%`}
            />

            {/* Drum Gain */}
            <RetroSegmentedSlider
              min={0}
              max={1.0}
              step={0.05}
              value={params.drumGain}
              onChange={(val) => onParamsChange({ drumGain: val })}
              label="鼓组饱和增益 / Drum Gain"
              displayValue={`${Math.round(params.drumGain * 100)}%`}
            />

            {/* Drum Low Boost */}
            <RetroSegmentedSlider
              min={0}
              max={1.0}
              step={0.05}
              value={params.drumLowBoost}
              onChange={(val) => onParamsChange({ drumLowBoost: val })}
              label="低频重音强化 / Bass Boost"
              displayValue={`${Math.round(params.drumLowBoost * 100)}%`}
            />

            {/* NEW: Progressive Rhythm Level Meter */}
            <div className="flex flex-col gap-2 border-[2px] border-black bg-[#E8DFC0] p-2.5 font-mono" id="rhythm-layer-indicator">
              <div className="flex items-center justify-between text-[10px] font-bold text-black uppercase">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse text-black" />
                  <span>递进节奏层级 / Rhythm Layer</span>
                </span>
                <span className="bg-black text-[#E8DFC0] px-1.5 py-0.5 text-[9px] font-extrabold">
                  LEVEL {rhythmLayer + 1} / 6
                </span>
              </div>

              {/* Progress bars indicator */}
              <div className="grid grid-cols-6 gap-1" id="rhythm-layer-btn-grid">
                {[...Array(6)].map((_, idx) => {
                  const isActive = idx <= rhythmLayer;
                  const labelMap = ['起', '承', '转', '合', '潮', '爆'];
                  return (
                    <button
                      key={idx}
                      id={`rhythm-layer-btn-${idx}`}
                      onClick={() => onRhythmLayerChange?.(idx)}
                      className={`h-7 border border-black flex flex-col items-center justify-center transition-all select-none cursor-pointer ${
                        isActive
                          ? 'bg-[#D0D8B0] text-black font-extrabold shadow-[1px_1px_0px_#000]'
                          : 'bg-[#C2B89D]/40 text-black/40 hover:bg-[#C2B89D]/80 hover:text-black/70'
                      }`}
                    >
                      <span className="text-[10px] leading-none">{labelMap[idx]}</span>
                      <span className="text-[7px] mt-0.5 font-sans">L{idx + 1}</span>
                    </button>
                  );
                })}
              </div>

              {/* Description of active stage */}
              <div className="border border-black bg-[#C2B89D] p-2 text-[9px] text-black leading-snug" id="rhythm-layer-desc-panel">
                <div className="font-bold border-b border-black/30 pb-0.5 mb-1 text-black text-[9.5px]">
                  {getActiveLayerName(params.drumPattern, rhythmLayer)}
                </div>
                <div className="text-black/85 leading-normal">
                  {getActiveLayerDesc(params.drumPattern, rhythmLayer)}
                </div>
              </div>
              
              <div className="text-[8px] text-black/50 leading-normal italic text-center mt-0.5">
                💡 提示: 在演奏中「左手握拳 ✊」可直接向前递进升级节奏层，形成循环！
              </div>
            </div>

            <div className="text-[8px] text-black/55 leading-normal">
              * 极速响应：鼓机与贝斯在16分音符级完美对齐，为您带来无损、极致震撼的现场混音品质。
            </div>
          </div>
        )}
      </div>

      {/* 11. Mini Quick Tutorial */}
      <div className="bg-[#C2B89D] p-4 border-[3px] border-black rounded-none landscape:hidden" id="panel-quick-tutorial">
        <h4 className="text-xs font-bold text-black mb-2 flex items-center gap-1.5 uppercase">
          <HelpIcon className="w-4 h-4 text-black" />
          <span>特雷门琴物理手势机制说明</span>
        </h4>
        <ul className="text-[10px] text-black list-decimal list-inside space-y-2 leading-normal">
          <li>
            <span className="font-bold">16:9 视画幅适配</span>：整个界面专为标准宽屏比例打造，线条分明，契合极简古旧风格。
          </li>
          <li>
            <span className="font-bold">左右手十二平均律对位</span>：音高自动完美量化到大调/中古/民族音阶，避免刺耳失准。
          </li>
          <li>
            <span className="font-bold">宇宙大气波 / 史诗云端</span>：左手配置具有超大空间氛围与慢速低通滤波扫频的 Bass 音色。
          </li>
          <li>
            <span className="font-bold">左手握拳节奏递进控制</span>：
            <ul className="pl-4 list-disc space-y-0.5 mt-1 text-[9px] text-black/60">
              <li>握紧左拳 ✊：立即向下一阶段递进(起 ➜ 承 ➜ 转 ➜ 合 ➜ 潮 ➜ 爆)，增强律动层次！</li>
              <li>骶骨与贝斯合一 🥁：贝斯不再只是音高旋律，而是精确贴合底鼓重音同步触发！</li>
              <li>上下垂直移动 ↕️：仅用于移动贝斯音高基准，完全不碰乱底层的节奏骨架！</li>
            </ul>
          </li>
          <li>
            <span className="font-bold">右手手指实时节奏控制</span>：
            <ul className="pl-4 list-disc space-y-0.5 mt-1 text-[9px] text-black/60">
              <li>仅伸出食指 👆：持续三连音 (Triplets)</li>
              <li>伸出食指+中指 ✌️：四个十六分音符 (Four 16ths)</li>
              <li>中指+无名指+小指 👋：前十六分音符 (Front 16th)</li>
              <li>除大拇指外全张开 🖐️：触发小切分节奏 (Syncopated)</li>
              <li>仅大拇指和小指 🤙：触发随机附点/三连音/十六分</li>
            </ul>
          </li>
          <li>
            <span className="font-bold">智能手势动态映射</span>：
            <ul className="pl-4 list-disc space-y-0.5 mt-1 text-[9px] text-black/60">
              <li>✊ <span className="font-bold text-black">合拢握拳</span>：锁定音量为饱满状态，上下滑动可连续改变音高，进行滑音演奏！</li>
              <li>🖐️ <span className="font-bold text-black">张手伸缩</span>：手张得越开，琶音音域越宽阔，声音越亮；合拢时音域缩窄至 1 个八度。</li>
              <li>↕️ <span className="font-bold text-black">上下滑动</span>：垂直上下移动手势，提供流畅的音高上下增减。</li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  );
}
