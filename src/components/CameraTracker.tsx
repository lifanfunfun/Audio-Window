import { useEffect, useRef, useState } from 'react';
import { Camera, Video, VideoOff, Layers, Loader2, Sparkles } from 'lucide-react';
import { HandsState, HandStatus } from '../types';

interface CameraTrackerProps {
  onHandsUpdate: (hands: HandsState) => void;
  onCameraActiveChange: (active: boolean) => void;
  cameraActive: boolean;
  analyser?: AnalyserNode | null;
  muted?: boolean;
  activeVolume?: number;
}

export default function CameraTracker({
  onHandsUpdate,
  onCameraActiveChange,
  cameraActive: cameraActiveProp,
  analyser = null,
  muted = true,
  activeVolume = 0
}: CameraTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const particlesRef = useRef<any[]>([]);
  const prevSolfegeIndexRef = useRef<number>(-1);
  const floatingTextsRef = useRef<any[]>([]);

  const propsRef = useRef({ analyser, muted, activeVolume });
  useEffect(() => {
    propsRef.current = { analyser, muted, activeVolume };
  }, [analyser, muted, activeVolume]);

  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [displayMode, setDisplayMode] = useState<'pip' | 'ambient' | 'hidden'>('pip');
  const [fps, setFps] = useState(0);
  const [handsDetected, setHandsDetected] = useState({ left: false, right: false });

  // Sync prop changes into internal state
  useEffect(() => {
    setCameraActive(cameraActiveProp);
  }, [cameraActiveProp]);

  // 1. Check for MediaPipe scripts availability on CDN
  useEffect(() => {
    let active = true;
    const checkMediaPipe = () => {
      if (!active) return;
      const mpHands = (window as any).Hands;
      const mpCamera = (window as any).Camera;
      
      if (mpHands && mpCamera) {
        setScriptsLoaded(true);
        setIsLoading(false);
      } else {
        setTimeout(checkMediaPipe, 200);
      }
    };
    checkMediaPipe();
    return () => {
      active = false;
    };
  }, []);

  // 2. Initialize MediaPipe Hands and Camera
  useEffect(() => {
    if (!scriptsLoaded || !videoRef.current || !canvasRef.current) return;

    let isDestroyed = false;
    let lastFrameTime = performance.now();
    let frameCount = 0;

    // Custom drawing utility inside callback
    const onResults = (results: any) => {
      if (isDestroyed) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Update FPS counter
      const now = performance.now();
      frameCount++;
      if (now - lastFrameTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastFrameTime)));
        frameCount = 0;
        lastFrameTime = now;
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw mirror camera feed if display is visible
      if (displayMode !== 'hidden') {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        
        // Apply Retro Green CRT filter to webcam feed!
        ctx.filter = 'grayscale(100%) sepia(30%) hue-rotate(45deg) saturate(140%) contrast(120%)';
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none'; // reset filter
        
        ctx.restore();
      } else {
        // Draw solid screen color in hidden mode
        ctx.fillStyle = '#D0D8B0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw visual guidelines in black
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();
      }

      const landmarks = results.multiHandLandmarks || [];
      const handedness = results.multiHandedness || [];

      let leftHandData: HandStatus = { active: false, x: 0, y: 0, z: 0, palmOpen: true };
      let rightHandData: HandStatus = { active: false, x: 0, y: 0, z: 0, palmOpen: true };

      // Reset detection states
      let hasLeft = false;
      let hasRight = false;

      if (landmarks.length > 0) {
        // We classify left/right based on x position on screen to make playing super predictable
        // x < 0.5 is left-hand side of screen, controls volume
        // x >= 0.5 is right-hand side of screen, controls pitch
        // We mirror the coordinates (1 - x) to align with mirrored webcam view!
        
        const sortedHands = landmarks.map((hand: any[], idx: number) => {
          // Landmark 8 is Index Finger Tip
          const indexTip = hand[8];
          const xMirrored = 1 - indexTip.x; // Mirror X to match user's physical orientation
          const y = indexTip.y; // 0 at top, 1 at bottom
          const z = indexTip.z;

          // Check if palm is open (distance from wrist [0] to middle finger tip [12] is large,
          // or simple index-to-wrist comparison vs index-to-MCP)
          const wrist = hand[0];
          const middleTip = hand[12];
          const distWristToTip = Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y);
          const palmOpen = distWristToTip > 0.18; // hand is open if finger stretched
          const proximity = Math.max(0, Math.min(1, (distWristToTip - 0.08) / 0.32));

          // Calculate precise individual finger extension states
          const indexExtended = hand[8].y < hand[6].y;
          const middleExtended = hand[12].y < hand[10].y;
          const ringExtended = hand[16].y < hand[14].y;
          const pinkyExtended = hand[20].y < hand[18].y;
          const thumbExtended = Math.hypot(hand[4].x - hand[9].x, hand[4].y - hand[9].y) > Math.hypot(hand[2].x - hand[9].x, hand[2].y - hand[9].y) * 1.15;

          const fingersExtended = {
            thumb: thumbExtended,
            index: indexExtended,
            middle: middleExtended,
            ring: ringExtended,
            pinky: pinkyExtended
          };

          return {
            landmarks: hand,
            x: xMirrored,
            y: y,
            z: proximity,
            palmOpen,
            fingersExtended
          };
        });

        if (sortedHands.length === 1) {
          // Single-hand mode: hand is both left and right target depending on position,
          // but we report single hand mode to the parent component
          const hand = sortedHands[0];
          
          // Let's decide if single-hand mode maps left or right based on relative position,
          // or just flags both active. Let's map it as rightHand for pitch and leftHand for volume:
          rightHandData = { active: true, x: hand.x, y: hand.y, z: hand.z, palmOpen: hand.palmOpen, fingersExtended: hand.fingersExtended };
          leftHandData = { active: true, x: hand.x, y: hand.y, z: hand.z, palmOpen: hand.palmOpen, fingersExtended: hand.fingersExtended };
          
          if (hand.x < 0.5) {
            hasLeft = true;
          } else {
            hasRight = true;
          }
        } else {
          // Dual-hand mode: sort by mirrored X coordinate
          // The leftmost hand (lower mirrored X) controls Volume (Left Hand)
          // The rightmost hand (higher mirrored X) controls Pitch (Right Hand)
          sortedHands.sort((a, b) => a.x - b.x);
          
          const leftHand = sortedHands[0];
          const rightHand = sortedHands[1];

          leftHandData = { active: true, x: leftHand.x, y: leftHand.y, z: leftHand.z, palmOpen: leftHand.palmOpen, fingersExtended: leftHand.fingersExtended };
          rightHandData = { active: true, x: rightHand.x, y: rightHand.y, z: rightHand.z, palmOpen: rightHand.palmOpen, fingersExtended: rightHand.fingersExtended };

          hasLeft = true;
          hasRight = true;
        }

        // Trigger rendering of skeletons on Canvas
        sortedHands.forEach((handObj, idx) => {
          const isLeftHand = handObj.x < 0.5;
          const themeColor = '#000000';

          // Draw skeleton lines
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.lineCap = 'square';

          // Hand joint paths
          const fingerConnections = [
            [0, 1, 2, 3, 4], // Thumb
            [0, 5, 6, 7, 8], // Index
            [9, 10, 11, 12], // Middle
            [13, 14, 15, 16], // Ring
            [17, 18, 19, 20], // Pinky
            [5, 9, 13, 17, 0] // Palm base
          ];

          fingerConnections.forEach(jointGroup => {
            ctx.beginPath();
            jointGroup.forEach((ptIdx, loopIdx) => {
              const pt = handObj.landmarks[ptIdx];
              const xPos = (1 - pt.x) * canvas.width; // Mirror X
              const yPos = pt.y * canvas.height;
              
              if (loopIdx === 0) ctx.moveTo(xPos, yPos);
              else ctx.lineTo(xPos, yPos);
            });
            ctx.stroke();
          });

          // Draw retro square nodes (index tip, thumb tip, wrist, palm)
          handObj.landmarks.forEach((pt: any, ptIdx: number) => {
            const xPos = (1 - pt.x) * canvas.width;
            const yPos = pt.y * canvas.height;

            // Highlight index finger tip (landmark 8)
            if (ptIdx === 8) {
              // Flat retro black circle
              ctx.beginPath();
              ctx.arc(xPos, yPos, 10, 0, 2 * Math.PI);
              ctx.fillStyle = '#000000';
              ctx.fill();

              // Concentric retro hand-drawn circle
              ctx.beginPath();
              ctx.arc(xPos, yPos, 18, 0, 2 * Math.PI);
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 2;
              ctx.stroke();
            } else if (ptIdx === 0 || ptIdx === 4 || ptIdx === 12 || ptIdx === 16 || ptIdx === 20) {
              // Main joint anchors: retro black squares with yellow-green core
              const size = 10;
              ctx.fillStyle = '#D0D8B0';
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.rect(xPos - size / 2, yPos - size / 2, size, size);
              ctx.fill();
              ctx.stroke();
            } else {
              // Minor joints: tiny black squares
              const size = 5;
              ctx.fillStyle = '#000000';
              ctx.beginPath();
              ctx.rect(xPos - size / 2, yPos - size / 2, size, size);
              ctx.fill();
            }
          });

          // Particle emission on hand trigger
          const indexTip = handObj.landmarks[8];
          const tipX = (1 - indexTip.x) * canvas.width;
          const tipY = indexTip.y * canvas.height;
          
          if (isLeftHand) {
            const yVal = 1 - indexTip.y; // 0 at bottom, 1 at top
            const solfegeNames = ["DO 🔉", "RE 🎛️", "MI ⚡", "FA 🌊", "SOL 🎚️", "LA 🚀", "TI 🌌"];
            const solfegeIndex = Math.max(0, Math.min(6, Math.floor(yVal * 7)));

            if (prevSolfegeIndexRef.current === -1) {
              prevSolfegeIndexRef.current = solfegeIndex;
            }

            if (solfegeIndex !== prevSolfegeIndexRef.current) {
              // Burst of particles on crossing solfege boundary
              for (let pIdx = 0; pIdx < 16; pIdx++) {
                particlesRef.current.push({
                  id: Math.random(),
                  x: tipX,
                  y: tipY,
                  vx: (Math.random() - 0.5) * 8,
                  vy: (Math.random() - 0.6) * 6 - 3,
                  size: Math.random() * 11 + 5,
                  alpha: 1,
                  life: 1,
                  decay: Math.random() * 0.035 + 0.015,
                  type: 'star',
                  colorTheme: 'black'
                });
              }

              // Create floating comic-style solfege bubble
              floatingTextsRef.current.push({
                id: Math.random(),
                text: solfegeNames[solfegeIndex],
                x: tipX,
                y: tipY - 15,
                vy: -2.5,
                alpha: 1.0,
                scale: 1.0,
                colorTheme: 'black'
              });

              prevSolfegeIndexRef.current = solfegeIndex;
            }

            // Left hand continuous stars (retro black theme)
            for (let pIdx = 0; pIdx < 2; pIdx++) {
              particlesRef.current.push({
                id: Math.random(),
                x: tipX,
                y: tipY,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.7) * 2 - 1.2,
                size: Math.random() * 6 + 3,
                alpha: 1,
                life: 1,
                decay: Math.random() * 0.02 + 0.015,
                type: 'star',
                colorTheme: 'black'
              });
            }
          } else {
            // Right hand continuous stars (retro black theme)
            for (let pIdx = 0; pIdx < 2; pIdx++) {
              particlesRef.current.push({
                id: Math.random(),
                x: tipX,
                y: tipY,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.7) * 2 - 1.2,
                size: Math.random() * 6 + 3,
                alpha: 1,
                life: 1,
                decay: Math.random() * 0.02 + 0.015,
                type: 'star',
                colorTheme: 'black'
              });
            }
          }
        });

        // Update & Render all active particles (pixelated monochrome stars)
        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          
          // Physics and position update (buoyant floating upward with wind drift)
          p.x += p.vx;
          p.y += p.vy;
          p.vy -= 0.035; // buoyancy
          p.vx += Math.sin(Date.now() / 160 + p.id) * 0.08; // gentle sway

          p.life -= p.decay;
          p.alpha = Math.max(0, p.life);

          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }

          // Render elegant retro-pixel four-pointed star (✦) with sharp tips and dithered grain noise
          ctx.save();
          ctx.globalAlpha = p.alpha;

          const cx = p.x;
          const cy = p.y;
          
          // Radius of the star and cell size for retro pixelated look
          const r = p.size * 1.4;
          const cellSize = p.size > 8 ? 3 : 2;
          
          // Outer dithered threshold to add organic grain/noise at the star borders
          const maxScore = Math.sqrt(r);

          // Iterate over the bounding box to check membership in the astroid star shape: sqrt(|x|) + sqrt(|y|) <= sqrt(r)
          for (let dx = -r; dx <= r; dx += cellSize) {
            for (let dy = -r; dy <= r; dy += cellSize) {
              const absX = Math.abs(dx);
              const absY = Math.abs(dy);
              const score = Math.sqrt(absX) + Math.sqrt(absY);
              
              if (score <= maxScore) {
                // Inside the star: draw pixel block with beautiful dithered noise textures
                const rand = Math.random();
                let color = '#D9B94A'; // Base gold
                
                if (rand < 0.18) {
                  color = '#B3942C'; // Textured shadow grain
                } else if (rand < 0.32) {
                  color = '#ECD278'; // Textured highlight grain
                }
                
                ctx.fillStyle = color;
                ctx.fillRect(
                  Math.round(cx + dx),
                  Math.round(cy + dy),
                  cellSize,
                  cellSize
                );
              } else if (score <= maxScore * 1.25) {
                // Dithered edges / outer noise particles at the boundary
                const edgeDistanceRatio = (score - maxScore) / (maxScore * 0.25);
                const ditherChance = (1 - edgeDistanceRatio) * 0.35;
                
                if (Math.random() < ditherChance) {
                  ctx.fillStyle = '#D9B94A';
                  ctx.fillRect(
                    Math.round(cx + dx),
                    Math.round(cy + dy),
                    cellSize,
                    cellSize
                  );
                }
              }
            }
          }

          ctx.restore();
        }

        // Update and Render floating Solfège texts ("带黑边的硬核拟声浮动气泡")
        const fTexts = floatingTextsRef.current;
        for (let i = fTexts.length - 1; i >= 0; i--) {
          const t = fTexts[i];
          t.y += t.vy;
          t.alpha -= 0.016; // gradual fade out

          if (t.alpha <= 0) {
            fTexts.splice(i, 1);
            continue;
          }

          ctx.save();
          ctx.globalAlpha = t.alpha;

          // Drawing a retro flat rect bubble box around the text
          ctx.font = 'bold 12px "JetBrains Mono", monospace';
          const textWidth = ctx.measureText(t.text).width;
          const paddingX = 10;
          const paddingY = 6;
          const boxWidth = textWidth + paddingX * 2;
          const boxHeight = 22;

          // Comic black-bordered rectangle background
          ctx.fillStyle = '#E8DFC0'; // Kraft paper yellow
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.rect(t.x - boxWidth / 2, t.y - boxHeight / 2, boxWidth, boxHeight);
          ctx.fill();
          ctx.stroke();

          // Render Text with clean monospace style
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          ctx.fillStyle = '#000000';
          ctx.fillText(t.text, t.x, t.y);
          ctx.restore();
        }
      }

      // Draw beautiful flat retro solid-black real-time spectrum at the bottom inside the picture frame!
      const currentProps = propsRef.current;
      if (currentProps.analyser && !currentProps.muted && currentProps.activeVolume > 0.01) {
        const analyser = currentProps.analyser;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        // Draw spectrum bars focusing on active low-mid frequencies (first 50% bins)
        const binsToDraw = Math.floor(bufferLength * 0.5);
        const barWidth = canvas.width / binsToDraw;
        const heightScale = canvas.height * 0.38; // up to 38% of height (enlarged as requested)

        ctx.save();
        const spectrumY = canvas.height;

        ctx.fillStyle = '#000000'; // Solid black bars

        for (let i = 0; i < binsToDraw; i++) {
          const value = dataArray[i];
          const percent = value / 255;
          const barHeight = percent * heightScale;

          if (barHeight > 0) {
            const x = i * barWidth;
            const y = spectrumY - barHeight;

            ctx.beginPath();
            ctx.rect(x + 1, y, Math.max(1.5, barWidth - 1.5), barHeight);
            ctx.fill();
          }
        }
        ctx.restore();
      } else {
        // Idle ambient subtle black wave at the bottom inside the frame
        const time = Date.now() * 0.002;
        ctx.save();
        ctx.beginPath();
        
        ctx.strokeStyle = '#000000'; // Pure black wave line
        ctx.lineWidth = 2;

        const points = 80;
        const step = canvas.width / points;

        for (let i = 0; i <= points; i++) {
          const x = i * step;
          const y = (canvas.height - 15) + Math.sin(x * 0.03 + time) * 8 * Math.sin((i / points) * Math.PI);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        ctx.restore();
      }

      setHandsDetected({ left: hasLeft, right: hasRight });

      // Send the state to parents
      onHandsUpdate({
        left: leftHandData,
        right: rightHandData,
        singleHandMode: landmarks.length === 1
      });
    };

    // Instantiate Hands
    const HandsClass = (window as any).Hands;
    const handsInstance = new HandsClass({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    handsInstance.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55
    });

    handsInstance.onResults(onResults);
    handsRef.current = handsInstance;

    // Start Webcam using MediaPipe Camera utility
    const CameraClass = (window as any).Camera;
    const cameraInstance = new CameraClass(videoRef.current, {
      onFrame: async () => {
        if (!isDestroyed && handsInstance && videoRef.current && cameraActive) {
          try {
            await handsInstance.send({ image: videoRef.current });
          } catch (e) {
            console.error('Camera frame processing error:', e);
          }
        }
      },
      width: 640,
      height: 480
    });

    cameraRef.current = cameraInstance;

    if (cameraActive) {
      cameraInstance.start()
        .then(() => {
          if (isDestroyed) return;
          setHasPermission(true);
          onCameraActiveChange(true);
        })
        .catch((err: any) => {
          if (isDestroyed) return;
          console.error('Failed to open camera:', err);
          setHasPermission(false);
          setCameraActive(false);
          onCameraActiveChange(false);
        });
    }

    return () => {
      isDestroyed = true;
      if (cameraRef.current) {
        try {
          cameraRef.current.stop();
        } catch (e) {}
      }
      if (handsRef.current) {
        try {
          handsRef.current.close();
        } catch (e) {}
      }
    };
  }, [scriptsLoaded, cameraActive, displayMode]);

  // Handle manual activation of camera
  const toggleCamera = async () => {
    if (cameraActive) {
      setCameraActive(false);
      onCameraActiveChange(false);
      if (cameraRef.current) {
        try {
          await cameraRef.current.stop();
        } catch (e) {}
      }
      // Clear canvas on stop
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      setHandsDetected({ left: false, right: false });
    } else {
      setCameraActive(true);
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#D0D8B0] retro-scanlines" id="camera-tracker-panel">
      {/* Pure Tracking Area Viewport with no margins and no text headers/footers */}
      <div className="relative w-full h-full flex items-center justify-center" id="tracker-viewport">
        {/* Hidden video element for MediaPipe stream */}
        <video
          ref={videoRef}
          className="hidden"
          playsInline
          muted
          width="640"
          height="480"
        />

        {/* Display Canvas */}
        <canvas
          ref={canvasRef}
          width="640"
          height="480"
          className="w-full h-full object-cover max-w-full max-h-full portrait:aspect-[9/16] landscape:aspect-auto transition-all opacity-100"
        />

        {/* Not Active Placeholder */}
        {!cameraActive && (
          <div 
            onClick={toggleCamera}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[#D0D8B0] retro-scanlines cursor-pointer transition-colors hover:bg-[#c6ceaa]"
            title="点击启动摄像头 / CLICK TO START CAMERA"
          >
            <div className="flex flex-col items-center justify-center gap-5 text-black font-mono select-none px-6 text-center">
              {/* Elegant Retro Loading text with custom dot pulse animations */}
              <div className="text-lg sm:text-xl font-bold tracking-widest uppercase flex items-center justify-center gap-0.5">
                <span>CAMERA LOADING</span>
                <span className="inline-flex min-w-[20px] text-left">
                  <span className="animate-[pulse_1.2s_infinite_0ms] font-black">.</span>
                  <span className="animate-[pulse_1.2s_infinite_300ms] font-black">.</span>
                  <span className="animate-[pulse_1.2s_infinite_600ms] font-black">.</span>
                </span>
              </div>
              
              {/* Retro Blocky Pixelated Loading Bar */}
              <div className="w-48 sm:w-60 h-6 border-[3px] border-black p-[2px] bg-transparent">
                <div className="h-full bg-black animate-retro-progress" style={{ width: '0%' }} />
              </div>
              

            </div>
          </div>
        )}

        {/* Permission Denied Placeholder */}
        {cameraActive && hasPermission === false && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-[#D0D8B0] retro-scanlines">
            <div className="p-4 bg-[#E8DFC0] border-4 border-black text-black mb-4">
              <VideoOff className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-black font-mono mb-1 uppercase tracking-tight">
              [ 摄像头访问被拒绝 ]
            </h3>
            <p className="text-xs text-black max-w-[280px] font-mono leading-relaxed">
              请允许浏览器访问摄像头权限，刷新页面重试。
            </p>
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#D0D8B0] retro-scanlines z-20">
            <div className="w-12 h-12 border-4 border-black border-t-transparent animate-spin mb-4" />
            <p className="text-xs text-black font-mono font-bold uppercase tracking-wider">
              正在载入 MediaPipe CV 引擎...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
