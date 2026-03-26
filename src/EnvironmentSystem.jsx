import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const fogNearStops = [
  { depth: 0.00, val: 60 },   // sky: wide open
  { depth: 0.04, val: 45 },   // at surface: slightly tighter
  { depth: 0.15, val: 30 },   // shallow water
  { depth: 0.30, val: 22 },   // twilight entry
  { depth: 0.60, val: 15 },   // deep twilight
  { depth: 1.00, val: 8 },    // abyss: dense
];

const fogFarStops = [
  { depth: 0.00, val: 250 },  // sky: far visibility
  { depth: 0.04, val: 200 },  // surface crossing
  { depth: 0.15, val: 170 },  // shallow
  { depth: 0.30, val: 145 },  // twilight entry
  { depth: 0.60, val: 125 },  // deep
  { depth: 1.00, val: 100 },  // abyss
];

const ambientStops = [
  { depth: 0.00, val: 0.8 },
  { depth: 1.00, val: 0.5 },
];

const dirStops = [
  { depth: 0.00, val: 1.0 },
  { depth: 1.00, val: 0.6 },
];

const pointStops = [
  { depth: 0.00, val: 0.0 },
  { depth: 0.10, val: 0.2 },
  { depth: 1.00, val: 1.5 },
];

function lerpStops(value, stops) {
  if (value <= stops[0].depth) return stops[0].val;
  if (value >= stops[stops.length - 1].depth) return stops[stops.length - 1].val;
  
  for (let i = 0; i < stops.length - 1; i++) {
    const start = stops[i];
    const end = stops[i+1];
    if (value >= start.depth && value <= end.depth) {
      const t = (value - start.depth) / (end.depth - start.depth);
      if (start.val instanceof THREE.Color) {
         const c = new THREE.Color();
         return c.lerpColors(start.val, end.val, t);
      }
      return THREE.MathUtils.lerp(start.val, end.val, t);
    }
  }
  return stops[0].val;
}

const skyCol = new THREE.Color('#87CEFA');
const surfaceCol = new THREE.Color('#0B3D91');
const twilightCol = new THREE.Color('#001a33');
const abyssCol = new THREE.Color('#020f26'); // Enhanced faint blue glow for the abyss
const pollutionCol = new THREE.Color('#203028');
const particleBaseCol = new THREE.Color('#3388ff');
const particlePolCol = new THREE.Color('#667766');

const particleOpacityStops = [
  { depth: 0.00, val: 0.0 },
  { depth: 0.08, val: 0.0 },
  { depth: 0.12, val: 0.2 },
  { depth: 0.80, val: 0.5 },
  { depth: 1.00, val: 0.15 }
];

const particleEmissiveStops = [
  { depth: 0.00, val: 0.0 },
  { depth: 0.10, val: 0.1 },
  { depth: 0.80, val: 0.6 },
  { depth: 1.00, val: 1.2 } // Faint bright blue glow on particles in the deep
];

export default function EnvironmentSystem({ memoryState }) {
  const bgRef = useRef();
  const fogRef = useRef();
  const ambientRef = useRef();
  const directionalRef = useRef();
  const pointRef = useRef();
  const particlesRef = useRef();

  const baseColor = useMemo(() => new THREE.Color(), []);
  const finalColor = useMemo(() => new THREE.Color(), []);
  
  useFrame((state, delta) => {
    const y = state.camera.position.y;
    
    // SINGLE SOURCE OF TRUTH FOR DEPTH (for fog distances & lights)
    // y goes from 2 (sky) to -50 (abyss)
    const depthNormalized = THREE.MathUtils.clamp((y - 2) / -52, 0, 1);
    
    // Debug depth visibility as requested by user (throttled slightly to avoid complete browser crash)
    if (Math.random() < 0.01) {
       console.log("Current Depth Y:", y.toFixed(2), "Normalized:", depthNormalized.toFixed(2));
    }
    
    // Strict piecewise color logic to prevent sky color leakage underwater
    if (y > 0) {
      // Above surface: smooth blend from sky to water
      const t = THREE.MathUtils.clamp(1.0 - (y / 2.0), 0, 1);
      baseColor.lerpColors(skyCol, surfaceCol, t);
    } else if (y >= -10) {
      // Sunlight zone: fixed rich deep blue, NO sky leak
      baseColor.copy(surfaceCol);
    } else {
      // Twilight and Abyss: blend deeper blues to black
      const t = THREE.MathUtils.clamp((y - (-10)) / -40.0, 0, 1);
      if (t <= 0.5) {
        baseColor.lerpColors(surfaceCol, twilightCol, t * 2.0);
      } else {
        baseColor.lerpColors(twilightCol, abyssCol, (t - 0.5) * 2.0);
      }
    }

    const pol = memoryState ? memoryState.current.pollutionFactor : 0;

    finalColor.lerpColors(baseColor, pollutionCol, pol * 0.75);

    if (bgRef.current) bgRef.current.set(finalColor);
    
    if (fogRef.current) {
      fogRef.current.color.copy(finalColor);
      fogRef.current.near = lerpStops(depthNormalized, fogNearStops);
      fogRef.current.far = lerpStops(depthNormalized, fogFarStops);
    }

    if (ambientRef.current) {
      ambientRef.current.intensity = lerpStops(depthNormalized, ambientStops);
    }
    if (directionalRef.current) {
      directionalRef.current.intensity = lerpStops(depthNormalized, dirStops);
    }
    if (pointRef.current) {
      pointRef.current.intensity = lerpStops(depthNormalized, pointStops);
    }

    // Floating particles smoothly drift (marine snow)
    if (particlesRef.current) {
      const isAbyss = y < -35;
      const isAbyssEnding = y < -47;
      
      const baseOpacity = lerpStops(depthNormalized, particleOpacityStops);
      const emissiveInt = lerpStops(depthNormalized, particleEmissiveStops);

      particlesRef.current.children.forEach((p, i) => {
        const speed = isAbyssEnding
          ? (0.003 + (i % 5) * 0.001) // Extremely slow floating in abyss
          : (isAbyss ? (0.05 + (i % 5) * 0.02) : (0.5 + (i % 5) * 0.1));
        p.position.y += delta * speed;
        p.rotation.x += delta * (isAbyssEnding ? 0.004 : (isAbyss ? 0.05 : 0.2));
        p.rotation.y += delta * (isAbyssEnding ? 0.002 : (isAbyss ? 0.02 : 0.1));

        if (p.position.y > 0) {
          p.position.y = -60;
        }

        if (p.material) {
           let currentOpacity = baseOpacity;
           
           if (pol > 0.01) {
              p.material.color.lerpColors(particleBaseCol, particlePolCol, pol);
              currentOpacity = THREE.MathUtils.lerp(currentOpacity, 0.8, pol);
              p.material.emissiveIntensity = THREE.MathUtils.lerp(emissiveInt, 0.0, pol);
           } else {
              p.material.color.copy(particleBaseCol);
              p.material.emissiveIntensity = emissiveInt;
           }
           
           if (isAbyssEnding) {
             currentOpacity = Math.min(currentOpacity, 0.25); // Keeps slightly more visible so glow shines
           }

           p.material.opacity = currentOpacity;
           p.visible = currentOpacity > 0.01;
        }
      });
    }
  });

  const particles = useMemo(() => {
    const particleCount = window.innerWidth < 768 ? 50 : 150;
    return Array.from({ length: particleCount }).map(() => ({
      position: [
        (Math.random() - 0.5) * 80,
        -Math.random() * 60,
        (Math.random() - 0.5) * 80
      ],
      rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0],
      scale: Math.random() * 0.3 + 0.05
    }));
  }, []);

  return (
    <>
      <color ref={bgRef} attach="background" args={['#87CEFA']} />
      <fog ref={fogRef} attach="fog" args={['#87CEFA', 50, 200]} />

      <ambientLight ref={ambientRef} color="#062255" intensity={0.5} />
      <directionalLight ref={directionalRef} position={[10, 10, 5]} color="#66aaff" intensity={0.8} />
      
      <pointLight ref={pointRef} position={[0, -20, 0]} color="#1188ff" distance={60} intensity={0.0} />

      <group ref={particlesRef}>
        {particles.map((data, i) => (
          <mesh 
            key={i} 
            position={data.position} 
            rotation={data.rotation}
          >
            <octahedronGeometry args={[data.scale]} />
            <meshStandardMaterial 
              color="#3388ff" 
              transparent 
              opacity={0.3} 
              emissive="#0044aa"
              emissiveIntensity={0.2}
              roughness={0.2}
            />
          </mesh>
        ))}
      </group>
    </>
  );
}
