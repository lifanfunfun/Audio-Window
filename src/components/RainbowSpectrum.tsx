import { useEffect, useRef } from 'react';

interface RainbowSpectrumProps {
  analyser: AnalyserNode | null;
  muted: boolean;
  activeVolume: number;
}

export default function RainbowSpectrum({ analyser, muted, activeVolume }: RainbowSpectrumProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Responsive Canvas dimensions
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

    // Get buffer length
    const bufferLength = analyser ? analyser.frequencyBinCount : 128;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      // Clear with retro background color
      ctx.fillStyle = '#E8DFC0';
      ctx.fillRect(0, 0, width, height);

      // Draw faint horizontal grid lines
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 1;
      const divisions = 4;
      for (let i = 1; i < divisions; i++) {
        const y = (height / divisions) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw vertical retro grid bars
      const vertDivs = 16;
      for (let i = 1; i < vertDivs; i++) {
        const x = (width / vertDivs) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Render audio frequencies in solid retro block style
      if (analyser && !muted && activeVolume > 0.01) {
        analyser.getByteFrequencyData(dataArray);

        // Render lower-mid range for visible musical responses
        const activeBins = Math.floor(bufferLength * 0.45);
        const rawBarWidth = width / activeBins;
        const barWidth = Math.max(3, rawBarWidth - 2);

        ctx.fillStyle = '#D0D8B0'; // Retro CRT light green/yellow
        ctx.strokeStyle = '#000000'; // High contrast outline
        ctx.lineWidth = 1.5;

        for (let i = 0; i < activeBins; i++) {
          const value = dataArray[i];
          const percent = value / 255;
          const barHeight = percent * height * 0.9;

          if (barHeight > 1) {
            const x = i * rawBarWidth;
            const y = height - barHeight;

            // Draw square block bars with solid outline
            ctx.beginPath();
            ctx.rect(x + 1, y, barWidth, barHeight);
            ctx.fill();
            ctx.stroke();

            // Draw a second block cap for vintage physical meter look
            ctx.fillStyle = '#000000';
            ctx.fillRect(x + 1, y, barWidth, 3);
            ctx.fillStyle = '#D0D8B0'; // Restore fill color
          }
        }
      } else {
        // Idle ambient retro scanner line wave
        const time = Date.now() * 0.003;
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.beginPath();

        const points = 60;
        const step = width / points;

        for (let i = 0; i <= points; i++) {
          const x = i * step;
          // Simple sine pattern simulating 90s electronic signal idle state
          const y = (height / 2) + Math.sin(x * 0.04 + time) * 10 * Math.sin((i / points) * Math.PI);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Print vintage monospaced status indicator
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[ CAMERA.EXE SPECTRO-ANALYZER CONNECTED - IDLE ]', width / 2, height / 2 + 3);
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [analyser, muted, activeVolume]);

  return (
    <div className="w-full h-20 relative overflow-hidden border-[3px] border-black bg-[#E8DFC0]" id="rainbow-spectrum-container">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
