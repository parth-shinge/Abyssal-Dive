import React, { useRef, useLayoutEffect, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './index.css';
import FishSystem from './FishSystem';
import EnvironmentSystem from './EnvironmentSystem';
import MuseumSystem from './MuseumSystem';
import AudioSystem from './AudioSystem';
import DiverSystem from './DiverSystem';
import IntroCards from './IntroCards';
import About from './About';
import { Birds, Buoys, SurfaceParticles } from './SurfaceAtmosphere';

gsap.registerPlugin(ScrollTrigger);

const CAMERA_START = { y: 1.5, z: 12, rx: -0.05 };
const CAMERA_END = { y: -50, z: 8, rx: 0.1 };

// Global target variables that GSAP will animate
const cameraState = {
  y: CAMERA_START.y,
  z: CAMERA_START.z,
  rx: CAMERA_START.rx,
};

function WaterSurface() {
  const meshRef = useRef();
  
  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.getElapsedTime();
      const positionAttribute = meshRef.current.geometry.attributes.position;
      const positions = positionAttribute.array;
      for (let i = 0; i < positionAttribute.count; i++) {
        const x = positions[i * 3];
        const y = positions[i * 3 + 1];
        // Add subtle wave to Z (since plane is rotated -PI/2 on X, local Z is world Y)
        const wave = Math.sin(x * 0.05 + time * 1.5) * 0.3 + Math.cos(y * 0.05 + time * 1.2) * 0.3;
        positions[i * 3 + 2] = wave;
      }
      positionAttribute.needsUpdate = true;
      // Removed computeVertexNormals() due to extreme performance cost on main thread
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      {/* 800x800 to fade into fog limits seamlessly and remove hard rectangular edges */}
      <planeGeometry args={[800, 800, 32, 32]} />
      <meshStandardMaterial 
        color="#0B3D91"
        transparent
        opacity={0.8}
        roughness={0.4}
        metalness={0.1}
        side={THREE.DoubleSide}
        emissive="#0A3A7A"
        emissiveIntensity={0.1}
      />
    </mesh>
  );
}

function OceanScene({ isMuted, onOpenPanel, onOpenDialogue, memoryState, isDiverMode, setIsDiverMode, isTransitioningDive, setIsTransitioningDive, setCrosshairHover, triggerHint, depthCounterRef }) {
  const [museumHovered, setMuseumHovered] = useState(false);
  const scrollTracker = useRef({ lastY: window.scrollY });

  useFrame((state, delta) => {
    // Ocean Memory Mode: Pollution increases on scroll UP, decreases on scroll DOWN
    const currentY = window.scrollY;
    const dy = currentY - scrollTracker.current.lastY;
    scrollTracker.current.lastY = currentY;

    let targetPollution = memoryState.current.pollutionFactor;
    if (dy < -1) {
       targetPollution += delta * 1.5; // Rapidly pollutes on scroll up
    } else if (dy > 1) {
       targetPollution -= delta * 0.8; // Cleans on scroll down
    } else {
       targetPollution -= delta * 0.1; // Slowly cleans naturally over time
    }
    memoryState.current.pollutionFactor = THREE.MathUtils.clamp(targetPollution, 0, 1);
    // Smooth trailing effect with delta-based inertia
    // Much slower lerp factor for cinematic float
    const lerpFactor = 1 - Math.exp(-2.5 * delta);
    
    if (!isDiverMode && !isTransitioningDive) {
      const time = state.clock.getElapsedTime();
      let swayY = 0;
      let swayX = 0;
      if (cameraState.y < -40) {
         // Deep abyss emotional sway: reduced motion
         swayY = Math.sin(time * 0.4) * 0.03;
         swayX = Math.cos(time * 0.25) * 0.015;
      }
      
      state.camera.position.lerp(new THREE.Vector3(swayX, cameraState.y + swayY, cameraState.z), lerpFactor);
      const targetRotation = new THREE.Euler(cameraState.rx, 0, 0, 'YXZ');
      const targetQuat = new THREE.Quaternion().setFromEuler(targetRotation);
      state.camera.quaternion.slerp(targetQuat, lerpFactor);
      
      // Trigger beacon hint if nearby
      if (state.camera.position.y < -12 && state.camera.position.y > -22) {
        triggerHint('beacon');
      }
    } else {
      state.pointer.set(0, 0); // Force crosshair interaction in Diver Mode
    }

    // Museum Hover Effect (Subtle Zoom-In)
    const targetZoom = museumHovered ? 1.15 : 1.0;
    state.camera.zoom = THREE.MathUtils.lerp(state.camera.zoom, targetZoom, lerpFactor * 2);
    state.camera.updateProjectionMatrix();

    if (depthCounterRef && depthCounterRef.current) {
      const actualY = state.camera.position.y;
      const targetDepth = Math.max(0, THREE.MathUtils.clamp((1.5 - actualY) / 51.5, 0, 1) * 4000);
      depthCounterRef.current.innerText = `DEPTH: ${Math.floor(targetDepth).toString().padStart(4, '0')} m`;
    }
  });

  return (
    <>
      <AudioSystem isMuted={isMuted} />
      <EnvironmentSystem memoryState={memoryState} />

      {/* Animated Surface plane */}
      <WaterSurface />
      <Birds />
      <Buoys />
      <SurfaceParticles />
      
      <DiverSystem isDiverMode={isDiverMode} setIsDiverMode={setIsDiverMode} isTransitioningDive={isTransitioningDive} setIsTransitioningDive={setIsTransitioningDive} />

      {/* Fish System - Interactivity enabled only when deep enough */}
      <FishSystem onOpenPanel={onOpenPanel} memoryState={memoryState} isDiverMode={isDiverMode} setCrosshairHover={setCrosshairHover} />

      <MuseumSystem 
        onOpenPanel={onOpenPanel} 
        onOpenDialogue={onOpenDialogue}
        setMuseumHovered={setMuseumHovered} 
        museumHovered={museumHovered} 
      />

      {/* Ocean floor plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -60, 0]}>
        <planeGeometry args={[800, 800, 32, 32]} />
        <meshStandardMaterial color="#00040a" roughness={1} metalness={0} />
      </mesh>
    </>
  );
}

function App() {
  const containerRef = useRef(null);
  const memoryState = useRef({ pollutionFactor: 0 });
  const [activePanel, setActivePanel] = useState(null);
  const [activeDialogue, setActiveDialogue] = useState(null);
  const [isDiverMode, setIsDiverMode] = useState(false);
  const [isTransitioningDive, setIsTransitioningDive] = useState(false);
  const [crosshairHover, setCrosshairHover] = useState(false);
  const [hasStartedDive, setHasStartedDive] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [showAbout, setShowAbout] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasActivatedPOV, setHasActivatedPOV] = useState(false);
  
  const [activeHint, setActiveHint] = useState(null);
  const hasSeenSoundHint = useRef(false);
  const hasSeenScrollHint = useRef(false);
  const hasSeenBeaconHint = useRef(false);
  const hasSeenDiverHint = useRef(false);
  const depthCounterRef = useRef(null);

  useEffect(() => {
    if (!showIntro && !hasSeenSoundHint.current) {
      hasSeenSoundHint.current = true;
      setActiveHint("🎧 Best experienced with sound");
      
      const t1 = setTimeout(() => {
        setActiveHint(null); // start fade out
        
        const t2 = setTimeout(() => {
          if (!hasSeenScrollHint.current && !isDiverMode) {
             hasSeenScrollHint.current = true;
             setActiveHint("SCROLL TO DIVE");
             setTimeout(() => {
               setActiveHint(prev => prev === "SCROLL TO DIVE" ? null : prev);
             }, 4000);
          }
        }, 1000); // Wait 1s for CSS fade out before showing next
      }, 3000); // 3 seconds visible

      return () => clearTimeout(t1);
    }
  }, [showIntro, isDiverMode]);

  useEffect(() => {
    if (isDiverMode && !hasSeenDiverHint.current) {
      hasSeenDiverHint.current = true;
      setActiveHint("WASD to move • Mouse to look • ESC to exit");
      const t = setTimeout(() => setActiveHint(null), 5000);
      return () => clearTimeout(t);
    }
  }, [isDiverMode]);

  const triggerHint = React.useCallback((type) => {
    if (type === 'beacon' && !hasSeenBeaconHint.current) {
      hasSeenBeaconHint.current = true;
      setActiveHint("Look for the glowing beacon");
      setTimeout(() => {
         setActiveHint(prev => prev === "Look for the glowing beacon" ? null : prev);
      }, 5000);
    }
  }, []);

  useEffect(() => {
    if (showIntro) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showIntro]);

  useEffect(() => {
    if (activeDialogue) {
      const timer = setTimeout(() => setActiveDialogue(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [activeDialogue]);

  const handleFirstInteraction = () => {
    if (!hasStartedDive) {
      setHasStartedDive(true);
    }
  };

  useLayoutEffect(() => {
    // Reset camera state in case of hot reload
    cameraState.y = CAMERA_START.y;
    cameraState.z = CAMERA_START.z;
    cameraState.rx = CAMERA_START.rx;

    const ctx = gsap.context(() => {
      gsap.to(cameraState, {
        y: CAMERA_END.y,
        z: CAMERA_END.z,
        rx: CAMERA_END.rx,
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 2.5, // 2.5s lag for cinematic heavy camera feel
        }
      });

      // Cinematic Text Animation (blur + transform, staggered)
      const sections = gsap.utils.toArray('.story-content');
      sections.forEach((sec) => {
        const isAbyssEnding = sec.parentElement.classList.contains('abyss-ending');
        // Find title, standard descriptions, and the final reveal (if any)
        const title = sec.querySelector('h2');
        const descAll = sec.querySelectorAll('p:not(.final-reveal)');
        const finalReveal = sec.querySelector('.final-reveal');
        
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sec.parentElement,
            start: "top 60%",
            end: "bottom 30%",
            toggleActions: "play reverse play reverse",
          }
        });

        if (title) {
          tl.fromTo(title,
            { opacity: 0, y: 30, filter: 'blur(10px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', duration: isAbyssEnding ? 2.5 : 1.5, ease: "power2.out" }
          );
        }
        if (descAll.length > 0) {
          tl.fromTo(descAll,
            { opacity: 0, y: 20, filter: 'blur(5px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', duration: isAbyssEnding ? 3.0 : 2.0, ease: "power2.out", stagger: isAbyssEnding ? 2.5 : 1.5 },
            title ? (isAbyssEnding ? "-=1.0" : "-=1.0") : "0" // Stagger start
          );
        }
        if (finalReveal) {
          tl.fromTo(finalReveal,
            { opacity: 0, y: 15, filter: 'blur(10px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', duration: 4.0, ease: "power2.inOut" },
            "+=1.8" // Strong pause before the final emotional line
          );
        }
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <>
      <button 
         className="global-about-btn" 
         onClick={() => setShowAbout(true)}
         style={{ 
            display: showIntro && !hasStartedDive ? 'none' : 'block',
            opacity: isDiverMode ? 0 : 1,
            pointerEvents: isDiverMode ? 'none' : 'auto'
         }}
      >
         ABOUT
      </button>

      <button 
         className="global-sound-btn" 
         onClick={() => setIsMuted(m => !m)}
         style={{ 
            display: showIntro && !hasStartedDive ? 'none' : 'block',
            opacity: isDiverMode ? 0 : 1,
            pointerEvents: isDiverMode ? 'none' : 'auto'
         }}
      >
         {isMuted ? 'UNMUTE' : 'MUTE'}
      </button>

      {showAbout && <About onClose={() => setShowAbout(false)} />}

      {showIntro ? (
        <IntroCards
          onBeforeInteract={handleFirstInteraction}
          onFinish={() => setShowIntro(false)}
        />
      ) : (
        <div
          className={`start-overlay ${hasStartedDive ? 'hidden' : ''}`}
          onClick={handleFirstInteraction}
          role="button"
          aria-label="Start dive"
        >
          <p className="start-overlay-message">Click anywhere to begin the dive</p>
        </div>
      )}

      {/* Unified User Hint System */}
      <div className={`global-hint ${activeHint ? 'active' : ''}`}>
         {activeHint}
      </div>

      {/* Cinematic Depth Counter */}
      <div className={`depth-counter ${showIntro ? 'hidden' : ''}`} ref={depthCounterRef}>
        DEPTH: 0000 m
      </div>

      {isDiverMode && (
         <div className="scuba-hud">
            <div className="scuba-mask-overlay"></div>
            <div className={`crosshair ${crosshairHover ? 'active' : ''}`}></div>
            <div className="hud-top-right">
               <p className="depth-text">DEPTH: DIVE ZONE</p>
               <p className="exit-text">PRESS "E" TO EXIT</p>
            </div>
         </div>
      )}

      {/* Dialogue Bubble Overlay */}
      <div className={`dialogue-container ${activeDialogue ? 'active' : ''}`}>
        {activeDialogue && (
          <div className="dialogue-bubble">
            "{activeDialogue}"
          </div>
        )}
      </div>

      {/* Information Panel Overlay */}
      <div 
        className={`overlay-container ${activePanel ? 'active' : ''}`} 
        onClick={(e) => {
          if(e.target === e.currentTarget) setActivePanel(null);
        }}
      >
        {activePanel && (
          <div className="info-panel" onClick={(e) => e.stopPropagation()}>
            <h2>{activePanel.title}</h2>
            <p>{activePanel.desc}</p>
            {activePanel.fact && <div className="fact">{activePanel.fact}</div>}
            <button className="close-btn" onClick={() => setActivePanel(null)}>Close Data Panel</button>
          </div>
        )}
      </div>

      {isDiverMode && (
        <div 
           className="pov-hint-overlay"
           style={{
              position: 'fixed',
              left: 0, right: 0, top: 0, bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 1000,
              opacity: hasActivatedPOV ? 0 : 1,
              transition: 'opacity 0.6s ease'
           }}
        >
           <p style={{
              marginTop: '100px',
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: '1.2rem',
              color: '#00ffff',
              background: 'rgba(0, 15, 30, 0.7)',
              padding: '10px 24px',
              borderRadius: '30px',
              border: '1px solid rgba(0, 255, 255, 0.4)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              animation: 'pulse 2s infinite alternate',
              boxShadow: '0 0 15px rgba(0, 255, 255, 0.2)'
           }}>
             Click to start POV
           </p>
        </div>
      )}

      <div 
         className="canvas-container"
         onClick={() => {
            if (isDiverMode && !hasActivatedPOV) {
               setHasActivatedPOV(true);
            }
         }}
      >
        <Canvas 
          dpr={window.innerWidth < 768 ? [1, 1] : [1, 2]}
          camera={{ position: [0, CAMERA_START.y, CAMERA_START.z], fov: 60 }}
          gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
          onCreated={({ camera }) => {
            camera.near = 0.1;
            camera.far = 1000;
            camera.updateProjectionMatrix();
          }}
          onPointerMissed={() => setActivePanel(null)}
        >
          <OceanScene 
            isMuted={isMuted}
            onOpenPanel={setActivePanel} 
            onOpenDialogue={setActiveDialogue}
            memoryState={memoryState}
            isDiverMode={isDiverMode}
            setIsDiverMode={(val) => {
               setIsDiverMode(val);
               if (val === true) setHasActivatedPOV(false);
            }}
            isTransitioningDive={isTransitioningDive}
            setIsTransitioningDive={setIsTransitioningDive}
            setCrosshairHover={setCrosshairHover}
            triggerHint={triggerHint}
            depthCounterRef={depthCounterRef}
          />
        </Canvas>
      </div>

      <div className={`scroll-container ${(isDiverMode || isTransitioningDive) ? 'hidden' : ''}`} ref={containerRef}>
        <div className="section landing-section">
          <div className="landing-content">
            <h1 className="title-glow">ABYSSAL DIVE</h1>
            <p className="subtitle">Dive into the deepest place on Earth</p>
          </div>
        </div>
        
        {/* Story Sections */}
        <div className="section story-section">
          <div className="story-content">
            <h2>The Sunlight Zone</h2>
            <p className="depth-marker">0m - 200m Below</p>
            <p>Life flourishes near the surface where sunlight penetrates the water.</p>
          </div>
        </div>

        <div className="section story-section">
          <div className="story-content">
            <h2>The Twilight Zone</h2>
            <p className="depth-marker">200m - 1000m Below</p>
            <p>Light begins to fade. Pressure increases, and the shadows grow longer.</p>
          </div>
        </div>

        <div className="section story-section">
          <div className="story-content">
            <h2>The Midnight Zone</h2>
            <p className="depth-marker">1000m - 4000m Below</p>
            <p>Complete darkness. Only isolated bioluminescence guides the way.</p>
          </div>
        </div>

        <div className="section story-section abyss-ending">
          <div className="story-content ending-content">
            <h2 className="ending-title">THE ABYSS</h2>
            <p className="depth-marker">4000m+ Below the Surface</p>
            <p className="ending-quote">The ocean remembers everything.</p>
            <p className="ending-quote">Silence. Pressure. Darkness.</p>
            <p className="ending-quote highlight">And yet... life still exists.</p>
            <p className="ending-line final-reveal"><br/>We explored the ocean…<br/>but it changed how we see ourselves.</p>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
