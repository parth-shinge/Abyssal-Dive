import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ═══════════════════════════════════════════════════
   SURFACE ATMOSPHERE
   Low-poly birds + floating buoys.
   Only visible near the surface (camera.y > -5).
   ═══════════════════════════════════════════════════ */

// ── Bird Geometry (simple V-shape) ────────────────

function createBirdGeometry() {
  // Two triangles forming a V-shaped wing pair
  const vertices = new Float32Array([
    // Left wing
    -1.2,  0,   0,
    -0.1,  0,  -0.3,
     0,    0.15, 0,
    // Right wing
     0.1,  0,  -0.3,
     1.2,  0,   0,
     0,    0.15, 0,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geo.computeVertexNormals();
  return geo;
}

const BIRD_COUNT = window.innerWidth < 768 ? 5 : 15;

function Birds() {
  const groupRef = useRef();
  const birdGeo = useMemo(() => createBirdGeometry(), []);
  const birdMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1a1a2e',
        roughness: 0.8,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    []
  );

  // Generate random bird flight paths
  const birdData = useMemo(() => {
    return Array.from({ length: BIRD_COUNT }).map((_, i) => ({
      radius: 25 + Math.random() * 40,         // orbit radius
      height: 8 + Math.random() * 12,           // altitude
      speed: 0.15 + Math.random() * 0.12,       // orbit speed
      flapSpeed: 3.5 + Math.random() * 2,       // wing flap rate
      flapAmp: 0.35 + Math.random() * 0.2,      // wing flap amplitude
      phase: (i / BIRD_COUNT) * Math.PI * 2,    // starting angle
      scale: 0.4 + Math.random() * 0.25,
      yOffset: Math.sin(i * 1.7) * 4,           // vertical variation
      flutter: Math.random() * 0.1,             // slight wobble
    }));
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    const camY = state.camera.position.y;

    // Fade out birds as camera goes deeper
    const opacity = THREE.MathUtils.clamp((camY + 5) / 10, 0, 1);
    groupRef.current.visible = opacity > 0.01;

    groupRef.current.children.forEach((bird, i) => {
      const d = birdData[i];
      const angle = time * d.speed + d.phase;

      // Circular flight path with varied radii
      const currentRadius = d.radius + Math.sin(time * 0.4 + d.phase) * 8;
      bird.position.x = Math.cos(angle) * currentRadius;
      bird.position.z = Math.sin(angle) * currentRadius;
      bird.position.y = d.height + d.yOffset + Math.sin(time * (0.5 + d.flutter) + d.phase) * (0.8 + d.flutter * 3);

      // Face direction of travel
      bird.rotation.y = -angle + Math.PI / 2;

      // Wing flap: rotate the bird slightly on Z axis
      bird.rotation.z = Math.sin(time * d.flapSpeed + d.phase) * d.flapAmp;

      // Slight banking on turns
      bird.rotation.x = Math.sin(time * d.speed * 0.5 + d.phase) * 0.1;
    });
  });

  return (
    <group ref={groupRef}>
      {birdData.map((d, i) => (
        <mesh key={i} geometry={birdGeo} material={birdMat} scale={d.scale} />
      ))}
    </group>
  );
}

// ── Floating Buoys ────────────────────────────────

const BUOY_POSITIONS = [
  [15, 0, -8],
  [-20, 0, 12],
  [8, 0, 22],
  [-12, 0, -18],
  [28, 0, 5],
  [-30, 0, -4],
];

function Buoy({ position }) {
  const groupRef = useRef();
  const glowRef = useRef();
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();

    // Bobbing motion
    groupRef.current.position.y =
      position[1] + Math.sin(time * 0.8 + phase) * 0.3;

    // Gentle rocking
    groupRef.current.rotation.x = Math.sin(time * 0.6 + phase) * 0.08;
    groupRef.current.rotation.z = Math.cos(time * 0.5 + phase + 1) * 0.06;

    // Pulsing glow
    if (glowRef.current) {
      glowRef.current.intensity =
        1.0 + Math.sin(time * 1.5 + phase) * 0.6;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Main buoy body */}
      <mesh position={[0, 0.4, 0]}>
        <capsuleGeometry args={[0.25, 0.6, 4, 8]} />
        <meshStandardMaterial
          color="#cc3322"
          roughness={0.6}
          metalness={0.2}
          emissive="#ff4422"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* Base float ring */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.35, 0.1, 6, 12]} />
        <meshStandardMaterial
          color="#dddddd"
          roughness={0.5}
          metalness={0.3}
        />
      </mesh>

      {/* Top light */}
      <mesh position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.08, 6, 6]} />
        <meshStandardMaterial
          color="#ffcc00"
          emissive="#ffbb00"
          emissiveIntensity={1.8}
        />
      </mesh>

      {/* Point light for glow */}
      <pointLight
        ref={glowRef}
        position={[0, 0.9, 0]}
        color="#ffbb00"
        distance={12}
        intensity={1.0}
      />
    </group>
  );
}

function Buoys() {
  const groupRef = useRef();

  useFrame((state) => {
    if (!groupRef.current) return;
    const camY = state.camera.position.y;
    const opacity = THREE.MathUtils.clamp((camY + 5) / 10, 0, 1);
    groupRef.current.visible = opacity > 0.01;
  });

  return (
    <group ref={groupRef}>
      {BUOY_POSITIONS.map((pos, i) => (
        <Buoy key={i} position={pos} />
      ))}
    </group>
  );
}

// ── Floating Particles ─────────────────────────────

function SurfaceParticles() {
  const groupRef = useRef();
  
  const particles = useMemo(() => {
    const pCount = window.innerWidth < 768 ? 30 : 80;
    return Array.from({ length: pCount }).map(() => ({
      position: [
        (Math.random() - 0.5) * 60,
        Math.random() * 3, // slightly above and below surface
        (Math.random() - 0.5) * 60
      ],
      scale: Math.random() * 0.04 + 0.01,
      speedPhase: Math.random() * Math.PI * 2,
    }));
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    const camY = state.camera.position.y;
    const opacity = THREE.MathUtils.clamp((camY + 5) / 10, 0, 1);
    groupRef.current.visible = opacity > 0.01;
    
    groupRef.current.children.forEach((p, i) => {
      const d = particles[i];
      p.position.y = d.position[1] + Math.sin(time * 0.5 + d.speedPhase) * 0.5;
      p.position.x = d.position[0] + Math.sin(time * 0.2 + d.speedPhase) * 1.0;
      p.rotation.x = time * 0.2 + d.speedPhase;
      p.rotation.y = time * 0.3 + d.speedPhase;
      if (p.material) {
        p.material.opacity = opacity * 0.6;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {particles.map((d, i) => (
        <mesh key={i} position={d.position} scale={d.scale}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color="#aaddff" transparent opacity={0.6} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── Exports ───────────────────────────────────────

export { Birds, Buoys, SurfaceParticles };
