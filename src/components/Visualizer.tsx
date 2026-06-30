import { useEffect, useRef, useState } from 'react';
import { Activity, BarChart2, Radio } from 'lucide-react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  activeFrequency: number;
  activeVolume: number;
  muted: boolean;
}

export default function Visualizer({ analyser, activeFrequency, activeVolume, muted }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visualMode, setVisualMode] = useState<'wave' | 'spectrum'>('wave');
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use ResizeObserver to keep canvas drawing buffer sharp and perfectly sized
    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    canvas.width = width;
    canvas.height = height;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        width = Math.floor(entry.contentRect.width);
        height = Math.floor(entry.contentRect.height);
        canvas.width = width;
        canvas.height = height;
      }
    });
    resizeObserver.observe(canvas);

    // Arrays to store audio data
    let dataArray: Uint8Array;
    let bufferLength = 0;

    if (analyser) {
      bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
    } else {
      bufferLength = 256;
      dataArray = new Uint8Array(bufferLength);
    }

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      // 1. Draw Background Grid in retro CRT screen color
      ctx.fillStyle = '#D0D8B0';
      ctx.fillRect(0, 0, width, height);

      // Draw horizontal grid lines (dashed/faint lines)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 1;
      const horizontalDivisions = 6;
      for (let i = 1; i < horizontalDivisions; i++) {
        const yPos = (height / horizontalDivisions) * i;
        ctx.beginPath();
        ctx.moveTo(0, yPos);
        ctx.lineTo(width, yPos);
        ctx.stroke();
      }

      // Draw vertical grid lines
      const verticalDivisions = 10;
      for (let i = 1; i < verticalDivisions; i++) {
        const xPos = (width / verticalDivisions) * i;
        ctx.beginPath();
        ctx.moveTo(xPos, 0);
        ctx.lineTo(xPos, height);
        ctx.stroke();
      }

      // Draw thick solid center axes (Crosshair)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();

      // 2. Fetch and render Audio Data in crisp solid Black
      if (analyser && !muted && activeVolume > 0.01) {
        if (visualMode === 'wave') {
          // TIME DOMAIN (Waveform)
          analyser.getByteTimeDomainData(dataArray);

          ctx.strokeStyle = '#000000'; // Pure high contrast black wave
          ctx.lineWidth = 3.5;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.beginPath();

          const sliceWidth = width / bufferLength;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * height) / 2;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }

            x += sliceWidth;
          }

          ctx.stroke();
        } else {
          // FREQUENCY DOMAIN (Spectrum bars)
          analyser.getByteFrequencyData(dataArray);

          const totalBars = Math.floor(bufferLength / 2.5);
          const barWidth = (width / totalBars) * 0.9;
          let barHeight;
          let x = 0;

          ctx.fillStyle = '#000000'; // High-contrast solid black bars for cartoon styling
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.5;

          for (let i = 0; i < totalBars; i++) {
            barHeight = dataArray[i];
            const scaledHeight = (barHeight / 255) * height * 0.85;

            if (scaledHeight > 0) {
              ctx.beginPath();
              // Standard rectangle with thick outline
              ctx.rect(x, height - scaledHeight, barWidth, scaledHeight);
              ctx.fill();
              ctx.stroke();
            }

            x += barWidth + (width / totalBars) * 0.1;
          }
        }
      } else {
        // Idle/Muted mode: Render clean synthesized sine wave
        const time = Date.now() * 0.003;
        
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'; // Faint black wave
        ctx.lineWidth = 2.5;
        ctx.beginPath();

        const points = 100;
        const step = width / points;

        const amplitude = activeVolume > 0.01 && !muted ? 12 : 6;
        const frequencyScale = 0.04;

        for (let i = 0; i <= points; i++) {
          const x = i * step;
          const y = (height / 2) + Math.sin(x * frequencyScale + time) * amplitude * Math.sin(i / points * Math.PI);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Draw centered helpful label
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(muted ? 'SYNTHESIZER MUTED' : 'AWAITING HAND GESTURE INPUT', width / 2, height - 12);
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [analyser, visualMode, muted, activeFrequency, activeVolume]);

  return (
    <div className="relative flex flex-col h-full bg-[#E8DFC0] border-[4px] border-black rounded-none overflow-hidden p-2.5 sm:p-4 text-black font-mono" id="theremin-visualizer-panel">
      {/* Visualizer header */}
      <div className="flex flex-row items-center justify-between gap-1 mb-1.5 sm:mb-3 shrink-0" id="visualizer-header">
        <div className="flex items-center gap-1.5 min-w-0">
          <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-black shrink-0" />
          <span className="text-[11px] sm:text-sm font-bold tracking-wider uppercase text-black truncate whitespace-nowrap">
            实时示波器 / OSCILLOSCOPE
          </span>
        </div>
        
        {/* Toggle visualizer mode in retro block */}
        <div className="flex bg-[#E8DFC0] p-0.5 sm:p-1 border-[2px] sm:border-[3px] border-black rounded-none shrink-0" id="visualizer-mode-buttons">
          <button
            onClick={() => setVisualMode('wave')}
            className={`flex items-center gap-1 px-1 sm:px-3 py-0.5 sm:py-1.5 rounded-none text-[8.5px] sm:text-xs cursor-pointer font-bold transition-all ${
              visualMode === 'wave' 
                ? 'bg-black text-[#E8DFC0]' 
                : 'text-black hover:bg-black/10'
            }`}
            id="btn-viz-wave"
          >
            <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden xs:inline">时域</span><span>波形</span>
          </button>
          <button
            onClick={() => setVisualMode('spectrum')}
            className={`flex items-center gap-1 px-1 sm:px-3 py-0.5 sm:py-1.5 rounded-none text-[8.5px] sm:text-xs cursor-pointer font-bold transition-all ${
              visualMode === 'spectrum' 
                ? 'bg-black text-[#E8DFC0]' 
                : 'text-black hover:bg-black/10'
            }`}
            id="btn-viz-spectrum"
          >
            <BarChart2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden xs:inline">频域</span><span>频谱</span>
          </button>
        </div>
      </div>

      {/* Render Canvas */}
      <div className="flex-1 relative border-[3px] border-black overflow-hidden bg-[#D0D8B0] retro-scanlines" id="visualizer-canvas-container">
        <canvas ref={canvasRef} className="w-full h-full block" />
        
        {/* Comic decorative grid labels */}
        <div className="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 flex flex-col font-mono text-[7px] sm:text-[9px] text-black/60 pointer-events-none select-none font-bold uppercase leading-tight">
          <span>CH1  AC  10mV  200μs</span>
          <span>TRIG  AUTO  SLOPE+</span>
        </div>

        <div className="absolute bottom-1.5 right-1.5 sm:bottom-2.5 sm:right-2.5 flex flex-col font-mono text-[7px] sm:text-[9px] text-right text-black/75 pointer-events-none select-none font-bold uppercase leading-tight">
          <span>{muted ? 'OSC_OFF' : 'OSC_RUNNING'}</span>
          <span>{activeFrequency > 0 ? `${Math.round(activeFrequency)} Hz` : '-- Hz'}</span>
        </div>
      </div>
    </div>
  );
}
