import { HandStatus, NoteInfo } from '../types';
import { HelpCircle, Activity } from 'lucide-react';

interface ThereminAntennasProps {
  leftHand: HandStatus;  // Volume
  rightHand: HandStatus; // Pitch
  frequency: number;
  volume: number;
  noteInfo: NoteInfo;
  muted: boolean;
}

export default function ThereminAntennas({
  leftHand,
  rightHand,
  frequency,
  volume,
  noteInfo,
  muted
}: ThereminAntennasProps) {
  
  // Calculate relative hand positions on screen coordinates for drawing (0 to 100%)
  const leftX = leftHand.active ? leftHand.x * 100 : 20;
  const leftY = leftHand.active ? leftHand.y * 100 : 50;
  
  const rightX = rightHand.active ? rightHand.x * 100 : 80;
  const rightY = rightHand.active ? rightHand.y * 100 : 50;

  // Calculate volume percentage and gauge heights
  const volPercent = Math.round(volume * 100);
  
  return (
    <div className="relative bg-[#E8DFC0] border-[4px] border-black rounded-none p-3 sm:p-5 flex flex-col h-full text-black font-mono" id="theremin-antennas-panel">
      
      {/* Header and status */}
      <div className="flex items-center justify-between mb-2.5 sm:mb-4 z-10" id="antennas-header">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-black" />
          <span className="text-sm font-bold tracking-wider uppercase text-black">
            虚拟天线场 / ANTENNA FIELD
          </span>
        </div>
        <div className="text-[10px] font-bold border-2 border-black bg-[#D0D8B0] px-2 py-0.5 rounded-none">
          <span>MODE: {leftHand.active && rightHand.active ? 'DUAL_SYS' : 'SINGLE_SYS'}</span>
        </div>
      </div>

      {/* Main interactive stage */}
      <div className="flex-1 min-h-[130px] sm:min-h-[180px] md:min-h-[220px] border-[3px] border-black rounded-none bg-[#D0D8B0] p-1.5 sm:p-4 relative flex justify-between overflow-hidden retro-scanlines" id="antennas-stage">
        {/* Simple crisp black gridlines with low opacity */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{
          backgroundImage: 'linear-gradient(to right, #000000 1.5px, transparent 1.5px), linear-gradient(to bottom, #000000 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px'
        }} />

        {/* ================== LEFT VOLUME LOOP ANTENNA ================== */}
        <div className="w-[30%] flex flex-col items-center justify-between h-full relative z-10" id="antenna-volume-zone">
          <span className="text-[7.5px] sm:text-[9px] font-bold tracking-wide text-black uppercase bg-[#E8DFC0] border-2 border-black px-1 sm:px-1.5 py-0.5 rounded-none whitespace-nowrap">
            VOL LOOP (L)
          </span>

          {/* SVG of Volume Loop Antenna */}
          <div className="flex-1 flex items-center justify-center w-full relative">
            <svg viewBox="0 0 100 150" className="w-full max-w-[45px] sm:max-w-[90px] md:max-w-[120px] h-auto max-h-[85px] sm:max-h-[140px] md:max-h-[180px] transition-all">
              {/* Antenna metal stand */}
              <line x1="50" y1="150" x2="50" y2="80" stroke="#000000" strokeWidth="6" />
              <line x1="50" y1="150" x2="50" y2="80" stroke="#E8DFC0" strokeWidth="2" />
              
              {/* Metal Loop */}
              <path
                d="M 15,80 C 15,30, 85,30, 85,80"
                fill="none"
                stroke="#000000"
                strokeWidth={leftHand.active ? '7' : '4'}
                strokeLinecap="square"
                className="transition-all duration-150"
              />
              <path
                d="M 15,80 C 15,30, 85,30, 85,80"
                fill="none"
                stroke="#E8DFC0"
                strokeWidth="2"
                strokeLinecap="square"
              />

              {/* Antenna range ring */}
              {leftHand.active && !muted && (
                <circle
                  cx="50"
                  cy="50"
                  r={10 + volume * 25}
                  fill="none"
                  stroke="#000000"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              )}
            </svg>

            {/* Square Hand Landmark overlay spot for Left Hand */}
            {leftHand.active && (
              <div
                className="absolute w-4 h-4 sm:w-6 sm:h-6 bg-[#E8DFC0] border-2 sm:border-3 border-black flex items-center justify-center rounded-none z-20 transition-all duration-75"
                style={{
                  left: `${leftX}%`,
                  top: `${leftY}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="w-1 h-1 sm:w-2 sm:h-2 bg-black"></div>
                
                {/* SVG connection Line to Antenna */}
                <svg className="absolute overflow-visible pointer-events-none top-0 left-0 w-1 h-1">
                  <path
                    d={`M 0,0 Q ${(50 - leftX) / 2},${(70 - leftY) / 2} ${50 - leftX},${70 - leftY}`}
                    fill="none"
                    stroke="#000000"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Volume Indicator Bar */}
          <div className="w-full bg-[#E8DFC0] h-2.5 sm:h-4 rounded-none border-[1.5px] sm:border-[2.5px] border-black overflow-hidden relative">
            <div
              className="bg-black h-full transition-all duration-100"
              style={{ width: `${volPercent}%` }}
            />
            {leftHand.active && (
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[7px] sm:text-[9px] font-bold text-white mix-blend-difference leading-none">
                {volPercent}%
              </span>
            )}
          </div>
        </div>

        {/* ================== CENTER TUNER (Retro Card) ================== */}
        <div className="w-[36%] border-x-[2px] sm:border-x-[3px] border-black px-1 sm:px-2 flex flex-col justify-center items-center h-full text-center relative z-10" id="antenna-center-hologram">
          <div className="absolute inset-x-1 sm:inset-x-2 inset-y-2 sm:inset-y-6 bg-[#C2B89D]/20 border border-black/20 rounded-none pointer-events-none"></div>
          
          <div className="flex flex-col items-center justify-center gap-0.5 sm:gap-1">
            <span className="text-[7px] sm:text-[9px] font-bold text-black uppercase tracking-wider bg-[#E8DFC0] border-2 border-black px-1 sm:px-1.5 py-0.5 rounded-none">
              音高对位 / PITCH TUNER
            </span>
            
            {/* BIG ACTIVE NOTE NAME */}
            <div className="h-8 sm:h-12 md:h-16 flex items-center justify-center select-none">
              {muted ? (
                <span className="text-[9px] sm:text-xs font-bold text-black">
                  [ MUTED ]
                </span>
              ) : frequency > 20 && volume > 0.01 ? (
                <span className="text-xl sm:text-3xl md:text-4xl font-bold text-black tracking-tighter border-[2px] sm:border-[3px] border-black bg-[#E8DFC0] px-1.5 sm:px-4 py-0.5 sm:py-1.5 rounded-none">
                  {noteInfo.note}
                </span>
              ) : (
                <span className="text-lg sm:text-2xl font-bold text-black/45">
                  --
                </span>
              )}
            </div>

            {/* FREQUENCY HERTZ */}
            <div className="text-[9px] sm:text-xs text-black">
              {frequency > 20 && volume > 0.01 && !muted ? (
                <span className="font-bold bg-[#E8DFC0] border-[1.5px] sm:border-2 border-black px-1 sm:px-1.5 py-0.5 rounded-none">
                  {frequency.toFixed(1)} <span className="text-[8px] sm:text-[10px]">Hz</span>
                </span>
              ) : (
                <span className="text-black/50 font-bold">[ NO SIGNAL ]</span>
              )}
            </div>

            {/* TUNER GAUGE (CENTS DEVIATION) */}
            <div className="w-full mt-1 sm:mt-3 flex flex-col gap-0.5 sm:gap-1 items-center">
              {/* Scale meter markers */}
              <div className="w-full flex justify-between text-[6px] sm:text-[8px] text-black px-1 font-bold">
                <span>-50♭</span>
                <span>0</span>
                <span>+50♯</span>
              </div>
              
              {/* Visual Needle / Bar */}
              <div className="w-full h-2.5 sm:h-4 bg-[#E8DFC0] border-[1.5px] sm:border-[2px] border-black rounded-none relative overflow-hidden">
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-black z-10" /> {/* center mark */}
                
                {frequency > 20 && volume > 0.01 && !muted ? (
                  <>
                    {/* Deviation pointer block */}
                    <div
                      className="absolute top-0 bottom-0 w-1.5 sm:w-2.5 transition-all duration-100 bg-black"
                      style={{
                        left: `calc(${50 + (noteInfo.deviation / 100) * 100}% - 3px)`
                      }}
                    />
                    {/* Deviation numeric text */}
                    <span className="absolute top-0 bottom-0 left-0 right-0 flex items-center justify-center text-[7px] sm:text-[8px] font-bold leading-none text-black mix-blend-difference">
                      {noteInfo.deviation === 0 ? 'IN TUNE' : noteInfo.deviation > 0 ? `+${noteInfo.deviation}¢` : `${noteInfo.deviation}¢`}
                    </span>
                  </>
                ) : (
                  <div className="absolute inset-0 bg-[#D0D8B0]/30" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ================== RIGHT PITCH ROD ANTENNA ================== */}
        <div className="w-[30%] flex flex-col items-center justify-between h-full relative z-10" id="antenna-pitch-zone">
          <span className="text-[7.5px] sm:text-[9px] font-bold tracking-wide text-black uppercase bg-[#E8DFC0] border-2 border-black px-1 sm:px-1.5 py-0.5 rounded-none whitespace-nowrap">
            PITCH ROD (R)
          </span>

          {/* SVG of Pitch Rod Antenna */}
          <div className="flex-1 flex items-center justify-center w-full relative">
            <svg viewBox="0 0 100 150" className="w-full max-w-[45px] sm:max-w-[90px] md:max-w-[120px] h-auto max-h-[85px] sm:max-h-[140px] md:max-h-[180px] transition-all">
              {/* Base board */}
              <rect x="25" y="140" width="50" height="10" fill="#000000" />
              
              {/* Pitch antenna rod */}
              <line
                x1="50"
                y1="140"
                x2="50"
                y2="20"
                stroke="#000000"
                strokeWidth={rightHand.active ? '7' : '4'}
                className="transition-all duration-150"
              />
              <line
                x1="50"
                y1="140"
                x2="50"
                y2="20"
                stroke="#E8DFC0"
                strokeWidth="2"
              />

              {/* Antenna tip metal square ball */}
              <rect
                x="44"
                y="14"
                width="12"
                height="12"
                fill="#E8DFC0"
                stroke="#000000"
                strokeWidth="3"
              />

              {/* Proximity field ring */}
              {rightHand.active && !muted && (
                <ellipse
                  cx="50"
                  cy="70"
                  rx={10 + (1 - rightHand.x) * 35}
                  ry="25"
                  fill="none"
                  stroke="#000000"
                  strokeWidth="1.5"
                  strokeDasharray="5 5"
                />
              )}
            </svg>

            {/* Square Hand Landmark overlay spot for Right Hand */}
            {rightHand.active && (
              <div
                className="absolute w-4 h-4 sm:w-6 sm:h-6 bg-[#E8DFC0] border-2 sm:border-3 border-black flex items-center justify-center rounded-none z-20 transition-all duration-75"
                style={{
                  left: `${rightX}%`,
                  top: `${rightY}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="w-1 h-1 sm:w-2 sm:h-2 bg-black"></div>

                {/* SVG connection Line to Antenna */}
                <svg className="absolute overflow-visible pointer-events-none top-0 left-0 w-1 h-1">
                  <path
                    d={`M 0,0 Q ${(50 - rightX) / 2},${(70 - rightY) / 2} ${50 - rightX},${70 - rightY}`}
                    fill="none"
                    stroke="#000000"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Capacitance frequency range label */}
          <div className="text-[7px] sm:text-[9px] text-black tracking-tight text-center font-bold bg-[#E8DFC0] border-1.5 sm:border-2 border-black px-1 sm:px-1.5 py-0.5 rounded-none whitespace-nowrap">
            {rightHand.active ? (
              <span>
                CAP: {Math.round(Math.abs(rightX - 50))}%
              </span>
            ) : (
              <span>WAIT SIGNAL</span>
            )}
          </div>
        </div>

      </div>

      {/* Guide text overlay (Vintage Paper panel) */}
      <div className="mt-2 sm:mt-4 flex items-start gap-2 bg-[#C2B89D] border-[3px] border-black p-2 sm:p-3 rounded-none text-[10px] sm:text-[11px] hidden sm:flex landscape:hidden md:flex" id="antenna-field-guide">
        <HelpCircle className="w-4 h-4 text-black shrink-0 mt-0.5" />
        <div className="text-[10px] sm:text-[11px] text-black leading-relaxed font-bold">
          <span className="uppercase">[ PHYSICS MECHANISM ]</span> 左天线通过手势高度(Y轴)改变耦合电磁电容，调节音频混音衰减比例；右金属杆通过手势与极板的间距(X轴)引发电磁谐振，调节滑音频率。
        </div>
      </div>
    </div>
  );
}
