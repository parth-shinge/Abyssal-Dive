import React, { useRef, useMemo, useLayoutEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

const FISH_COUNT = window.innerWidth < 768 ? 50 : 150;
const NEIGHBOR_RADIUS = 10;
const MAX_SPEED = 0.05;
const MIN_SPEED = 0.02;

// Reusable vectors to eliminate GC pauses during O(N^2) calculations
const _tempSeparation = new THREE.Vector3();
const _tempVector = new THREE.Vector3();
const _tempMouse3D = new THREE.Vector3();
const _tempAvoid = new THREE.Vector3();
const _tempWander = new THREE.Vector3();

const FISH_SPECIES = {
  small_fish: {
    name: 'Flashfish',
    bodyColor: '#8cd6ff', emissiveColor: '#2e7fa6', emissiveBase: 0.15,
    speedScale: 1.25, tailAmp: 0.6, tailFreq: 7.5, bodySway: 0.12,
    bodyScale: [1.35, 0.8, 0.75], shape: 'standard', grouping: 1.5,
    scaleRange: [0.7, 0.95], label: 'Small fast fish that dart through the bright upper ocean.'
  },
  tuna: {
    name: 'Tuna',
    bodyColor: '#5a6d85', emissiveColor: '#344b61', emissiveBase: 0.05,
    speedScale: 1.8, tailAmp: 0.4, tailFreq: 8.0, bodySway: 0.05,
    bodyScale: [2.5, 0.9, 0.6], shape: 'sleek', grouping: 0.6,
    scaleRange: [1.2, 1.5], label: 'High-speed hunters built for endurance.'
  },
  shark: {
    name: 'Reef Shark',
    bodyColor: '#6a7d8f', emissiveColor: '#000000', emissiveBase: 0,
    speedScale: 0.9, tailAmp: 0.35, tailFreq: 4.0, bodySway: 0.1,
    bodyScale: [3.5, 1.1, 1.0], shape: 'shark', grouping: 0.1,
    scaleRange: [1.5, 1.8], label: 'Apex predator sweeping silently through the water.'
  },
  stingray: {
    name: 'Stingray',
    bodyColor: '#4b5c6b', emissiveColor: '#1a2b3c', emissiveBase: 0.05,
    speedScale: 0.6, tailAmp: 0.2, tailFreq: 3.0, bodySway: 0.02,
    bodyScale: [2.0, 0.2, 2.5], shape: 'flat', grouping: 0.2,
    scaleRange: [1.3, 1.6], label: 'Flat shadows gliding across the sea floor.'
  },
  jellyfish: {
    name: 'Bioluminescent Jellyfish',
    bodyColor: '#ffffff', emissiveColor: '#65ecff', emissiveBase: 0.8,
    speedScale: 0.3, tailAmp: 0, tailFreq: 2.0, bodySway: 0,
    bodyScale: [1.2, 1.2, 1.2], shape: 'jelly', grouping: 0.4,
    scaleRange: [1.2, 1.8], label: 'Ethereal drifters pulsing in the pitch black.'
  },
  anglerfish: {
    name: 'Abyssal Angler',
    bodyColor: '#2b3a4a', emissiveColor: '#65ecff', emissiveBase: 0.1,
    speedScale: 0.5, tailAmp: 0.3, tailFreq: 4.5, bodySway: 0.08,
    bodyScale: [1.6, 1.4, 1.4], shape: 'angler', grouping: 0.1,
    scaleRange: [1.0, 1.3], label: 'The iconic bulb fish. A living trap in the dark.'
  }
};

const TIERS = {
  surface: ['small_fish', 'small_fish', 'tuna'],
  mid: ['shark', 'stingray', 'small_fish'],
  deep: ['jellyfish', 'jellyfish', 'anglerfish']
};

function getDepthTier(cameraY) {
  if (cameraY > -12) return 'surface';
  if (cameraY > -32) return 'mid';
  return 'deep';
}

function getSpawnYForTier(tier) {
  if (tier === 'surface') return -2 - Math.random() * 12;
  if (tier === 'mid') return -14 - Math.random() * 18;
  return -33 - Math.random() * 22;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function makeFishData(tier) {
  const possibleSpecies = TIERS[tier];
  const speciesId = possibleSpecies[Math.floor(Math.random() * possibleSpecies.length)];
  const profile = FISH_SPECIES[speciesId];
  return {
    position: new THREE.Vector3(
      (Math.random() - 0.5) * 60,
      getSpawnYForTier(tier),
      (Math.random() - 0.5) * 30
    ),
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 2
    ).normalize().multiplyScalar(MAX_SPEED * profile.speedScale),
    tier,
    speciesId,
    scaleJitter: randomRange(profile.scaleRange[0], profile.scaleRange[1]),
    swimPhase: Math.random() * Math.PI * 2,
  };
}

function Fish({ index, sharedData, onOpenPanel, memoryState, setCrosshairHover }) {
  const groupRef = useRef();
  const bodyRef = useRef();
  const tailRef = useRef();
  const hitRef = useRef();
  const hoverScale = useRef(1);
  const { camera } = useThree();
  const [hovered, setHovered] = useState(false);

  useLayoutEffect(() => {
    if (hitRef.current) {
      hitRef.current.rotateX(Math.PI / 2);
    }
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    
    const context = sharedData.current;
    const myData = context.fishes[index];
    const pos = groupRef.current.position;
    const vel = myData.velocity;
    
    // Abyss Modifiers
    const cameraY = state.camera.position.y;
    const depthM = THREE.MathUtils.clamp((cameraY - (-30)) / -15, 0, 1); 
    const speedMult = THREE.MathUtils.lerp(1.0, 0.15, depthM);
    const spacingMult = THREE.MathUtils.lerp(1.0, 4.0, depthM);
    const glowBoost = THREE.MathUtils.lerp(0.0, 0.4, depthM * 0.6); // slight glow
    const tierProfile = FISH_SPECIES[myData.speciesId] || FISH_SPECIES.small_fish;
    
    let separation = new THREE.Vector3();
    let alignment = new THREE.Vector3();
    let cohesion = new THREE.Vector3();
    let numNeighbors = 0;

    // 1. Separation, Alignment, Cohesion (Boids)
    for (let i = 0; i < FISH_COUNT; i++) {
      if (i === index) continue;
      const other = context.fishes[i];
      // Only group strongly with same species
      const isSameSpecies = other.speciesId === myData.speciesId;
      const distance = pos.distanceTo(other.position);

      if (distance < NEIGHBOR_RADIUS) {
        // Separation: avoid crowding
        if (distance < 3.0) {
          _tempSeparation.subVectors(pos, other.position).normalize();
          _tempSeparation.divideScalar(distance || 0.1); // Weight by inverse distance
          separation.add(_tempSeparation);
        }
        
        if (isSameSpecies) {
           // Alignment: match direction
           alignment.add(other.velocity);
           // Cohesion: move toward center
           cohesion.add(other.position);
           numNeighbors++;
        }
      }
    }

    if (numNeighbors > 0) {
      // Average out alignment and cohesion
      alignment.divideScalar(numNeighbors).normalize().multiplyScalar(0.015 * tierProfile.grouping);
      
      // Cohesion force pulls toward the center of neighbors
      cohesion.divideScalar(numNeighbors).sub(pos).normalize().multiplyScalar(0.005 / spacingMult * tierProfile.grouping);
      
      separation.multiplyScalar(0.04 * spacingMult); // Strengthen separation relative to others
      
      vel.add(alignment);
      vel.add(cohesion);
      vel.add(separation);
    } else {
      // Gentle natural wander if alone
      const time = state.clock.getElapsedTime() + index * 10;
      _tempWander.set(
        Math.sin(time * 0.5),
        Math.cos(time * 0.4) * 0.2, // stay mostly horizontal
        Math.sin(time * 0.6)
      ).multiplyScalar(0.005);
      vel.add(_tempWander);
    }

    // 2. Cursor scatter behavior
    _tempVector.set(state.pointer.x, state.pointer.y, 0.5);
    _tempVector.unproject(state.camera);
    _tempVector.sub(state.camera.position).normalize();
    
    if (Math.abs(_tempVector.z) > 0.001) {
      const distanceToZ = (pos.z - state.camera.position.z) / _tempVector.z;
      _tempMouse3D.copy(state.camera.position).add(_tempVector.multiplyScalar(distanceToZ));
      const distToMouse = pos.distanceTo(_tempMouse3D);
      
      if (distToMouse < 8) {
        // Avoid the cursor
        _tempAvoid.subVectors(pos, _tempMouse3D).normalize();
        
        // Is the cursor moving fast? 1.5 units/frame distance in 2D is very fast
        const isFastCursor = context.cursorSpeed > 1.5 && !context.isDiverMode;
        
        // Scatter multiplier
        const scatterStr = isFastCursor ? 0.08 : (context.isDiverMode ? 0.01 : 0.02);
        vel.add(_tempAvoid.multiplyScalar(scatterStr));
      }
    }

    // Wrap boundaries (to keep them in the scene bounds)
    const bounds = { x: 40, yMin: -60, yMax: 5, z: 20 };
    if (pos.x > bounds.x) pos.x = -bounds.x;
    if (pos.x < -bounds.x) pos.x = bounds.x;
    if (pos.y > bounds.yMax) pos.y = bounds.yMin;
    if (pos.y < bounds.yMin) pos.y = bounds.yMax;
    if (pos.z > bounds.z) pos.z = -bounds.z;
    if (pos.z < -bounds.z) pos.z = bounds.z;

    // Apply speed limits and friction for scattering
    const speed = vel.length();
    const burstMax = MAX_SPEED * 2.5 * speedMult;
    const currentMaxSpeed = MAX_SPEED * speedMult * tierProfile.speedScale;
    const currentMinSpeed = MIN_SPEED * speedMult * tierProfile.speedScale;
    
    if (context.cursorSpeed > 1.5 && !context.isDiverMode) {
       // Fast cursor -> allow short burst of high speed
       if (speed > burstMax) {
           vel.normalize().multiplyScalar(burstMax);
       }
    } else {
       // Slow or stopped cursor -> slowly bleed off excess speed (regroup smoothly)
       if (speed > currentMaxSpeed) {
           vel.multiplyScalar(0.95);
       } else if (speed < currentMinSpeed) {
           vel.normalize().multiplyScalar(currentMinSpeed + 0.001);
       }
    }

    // Visibility control: Fish fade in underwater and out during pollution
    const depthOpacity = THREE.MathUtils.clamp((state.camera.position.y - (-2)) / -8, 0, 1);
    
    const pol = memoryState ? memoryState.current.pollutionFactor : 0;
    const survivalCount = FISH_COUNT * (1 - pol * 0.85); 
    
    let polOpacity = 1;
    if (index > survivalCount) {
       polOpacity = THREE.MathUtils.clamp(1 - (index - survivalCount) / 3, 0, 1);
    }
    
    const finalOpacity = depthOpacity * polOpacity;

    if (bodyRef.current && bodyRef.current.material) {
      bodyRef.current.material.transparent = true;
      bodyRef.current.material.opacity = finalOpacity;
      bodyRef.current.visible = finalOpacity > 0.01;
    }

    if (tailRef.current && tailRef.current.material) {
      tailRef.current.material.transparent = true;
      tailRef.current.material.opacity = finalOpacity;
      tailRef.current.visible = finalOpacity > 0.01;
    }

    // Hover logic lerping
    const isActiveHover = hovered && state.camera.position.y <= -10;
    const targetScale = isActiveHover ? 1.08 : 1.0;
    hoverScale.current = THREE.MathUtils.lerp(hoverScale.current, targetScale, 0.15);
    groupRef.current.scale.setScalar(hoverScale.current * myData.scaleJitter);

    if (bodyRef.current && bodyRef.current.material) {
      let targetEmissive = isActiveHover ? 0.9 : tierProfile.emissiveBase;
      targetEmissive += glowBoost;
      if (tierProfile.shape === 'jelly') {
         targetEmissive += Math.abs(Math.sin(state.clock.getElapsedTime() * tierProfile.tailFreq)) * 0.4;
      }

      bodyRef.current.material.emissiveIntensity = THREE.MathUtils.lerp(bodyRef.current.material.emissiveIntensity, targetEmissive, 0.1);
      bodyRef.current.material.emissive.set(tierProfile.emissiveColor);
      bodyRef.current.material.color.set(tierProfile.bodyColor);
      
      const swimTime = state.clock.getElapsedTime() + myData.swimPhase;
      const tailWave = Math.sin(swimTime * tierProfile.tailFreq) * tierProfile.tailAmp;
      
      if (tierProfile.shape === 'jelly') {
         const pulse = 1.0 + Math.sin(swimTime * tierProfile.tailFreq) * 0.3;
         bodyRef.current.scale.set(tierProfile.bodyScale[0] * pulse, tierProfile.bodyScale[1] * pulse, tierProfile.bodyScale[2] * pulse);
      } else {
         bodyRef.current.scale.set(tierProfile.bodyScale[0], tierProfile.bodyScale[1], tierProfile.bodyScale[2]);
      }

      if (tailRef.current) {
        tailRef.current.rotation.y = tailWave;
      }
      bodyRef.current.rotation.y = -tailWave * 0.18;
      bodyRef.current.rotation.z = Math.sin(swimTime * (tierProfile.tailFreq * 0.5)) * tierProfile.bodySway;
      bodyRef.current.position.y = Math.sin(swimTime * 1.5) * 0.03;
    }

    if (isActiveHover) {
        // Slow down slightly on hover for focus effect
        vel.multiplyScalar(0.75);
    }

    // Apply computed velocity to position
    pos.add(vel);
    
    // Sync position back to shared state so neighbors can read it
    myData.position.copy(pos);

    // Look along velocity vector
    _tempVector.copy(pos).add(vel);
    groupRef.current.lookAt(_tempVector);
  });

  return (
    <group ref={groupRef} position={sharedData.current.fishes[index].position}>
      <mesh
        onClick={(e) => {
           if (camera.position.y > -10) return;
           e.stopPropagation();
           const dist = groupRef.current.position.distanceTo(camera.position);
           if (dist < 30) {
                const profile = FISH_SPECIES[sharedData.current.fishes[index].speciesId];
                onOpenPanel({
                  title: profile.name,
                  desc: profile.label,
                  fact: 'Fun Fact: Procedurally animated based on its depth and species traits.'
                });
           }
        }}
        onPointerOver={() => { 
          if (camera.position.y <= -10) {
             document.body.style.cursor = 'pointer'; 
             setHovered(true);
             if (setCrosshairHover) setCrosshairHover(true);
          }
        }}
        onPointerOut={() => { 
          document.body.style.cursor = 'auto'; 
          setHovered(false);
          if (setCrosshairHover) setCrosshairHover(false);
        }}
        visible={false}
      >
        <cylinderGeometry ref={hitRef} args={[2.5, 2.5, 5]} />
        <meshBasicMaterial />
      </mesh>

      <group>
        <mesh ref={bodyRef}>
          {FISH_SPECIES[sharedData.current.fishes[index].speciesId].shape === 'jelly' ? (
            <sphereGeometry args={[0.45, 12, 12, 0, Math.PI * 2, 0, Math.PI / 1.5]} />
          ) : (
            <sphereGeometry args={[0.35, 8, 6]} />
          )}
          <meshStandardMaterial color="#88c8ff" roughness={0.35} metalness={0.05} />
          
          {/* Shark Dorsal Fin */}
          {FISH_SPECIES[sharedData.current.fishes[index].speciesId].shape === 'shark' && (
             <mesh position={[0, 0.4, 0]} rotation={[0, 0, 0]}>
                <coneGeometry args={[0.2, 0.4, 4]} />
                <meshStandardMaterial color="#6a7d8f" roughness={0.35} metalness={0.05} />
             </mesh>
          )}

          {/* Anglerfish Bulb */}
          {FISH_SPECIES[sharedData.current.fishes[index].speciesId].shape === 'angler' && (
             <group position={[0, 0.2, 0.5]}>
                <mesh position={[0, 0.3, 0.2]}>
                   <sphereGeometry args={[0.1, 8, 8]} />
                   <meshStandardMaterial color="#ffffff" emissive="#65ecff" emissiveIntensity={1.5} />
                </mesh>
                <mesh position={[0, 0.15, 0.1]} rotation={[-Math.PI / 4, 0, 0]}>
                   <cylinderGeometry args={[0.02, 0.02, 0.3]} />
                   <meshStandardMaterial color="#2b3a4a" />
                </mesh>
             </group>
          )}
        </mesh>

        {FISH_SPECIES[sharedData.current.fishes[index].speciesId].shape !== 'jelly' && (
          <mesh ref={tailRef} position={[0, 0, -0.55]} rotation={[0, 0, Math.PI]}>
            {FISH_SPECIES[sharedData.current.fishes[index].speciesId].shape === 'flat' ? (
              <coneGeometry args={[0.05, 1.2, 4]} /> // thin tail for stingray
            ) : (
              <coneGeometry args={[0.22, 0.4, 4]} />
            )}
            <meshStandardMaterial color="#7fc0e8" roughness={0.35} metalness={0.05} />
          </mesh>
        )}

        {FISH_SPECIES[sharedData.current.fishes[index].speciesId].shape !== 'jelly' && (
          <mesh position={[0, 0, 0.62]} scale={[0.35, 0.35, 0.35]}>
            <sphereGeometry args={[0.12, 6, 6]} />
            <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.0} emissive="#0a2138" emissiveIntensity={0.35} />
          </mesh>
        )}
      </group>
      
      {hovered && camera.position.y <= -10 && (
        <Html position={[0, 0, 0.5]} center style={{ pointerEvents: 'none', zIndex: 300 }}>
          <div className="fish-hover-label">
            {FISH_SPECIES[sharedData.current.fishes[index].speciesId]?.name || 'Deep Sea Fish'}
          </div>
        </Html>
      )}
    </group>
  ); // We keep the starting position identical to shared state
}

export default function FishSystem({ onOpenPanel, memoryState, isDiverMode, setCrosshairHover }) {
  const initialTier = getDepthTier(0);
  const sharedData = useRef({
    fishes: Array.from({ length: FISH_COUNT }).map(() => makeFishData(initialTier)),
    cursorSpeed: 0,
    isDiverMode: isDiverMode,
    activeTier: initialTier,
    tierShiftCooldown: 0,
  });

  // Sync isDiverMode to sharedData on every render update
  sharedData.current.isDiverMode = isDiverMode;

  const lastPointer = useRef(new THREE.Vector2());

  useFrame((state, delta) => {
    // Calculate 2D cursor speed to trigger scattering
    const currentPointer = new THREE.Vector2(state.pointer.x, state.pointer.y);
    const dist = currentPointer.distanceTo(lastPointer.current);
    
    // dist in normalized coordinates (-1 to 1). So screen-wide movements are ~2 units.
    sharedData.current.cursorSpeed = dist / (delta || 0.016);
    const currentTier = getDepthTier(state.camera.position.y);
    sharedData.current.tierShiftCooldown -= delta;

    // Depth-based spawning: recycle fish into the new biome tier as we dive/rise.
    if (currentTier !== sharedData.current.activeTier && sharedData.current.tierShiftCooldown <= 0) {
      sharedData.current.activeTier = currentTier;
      sharedData.current.tierShiftCooldown = 1.2;

      for (let i = 0; i < FISH_COUNT; i++) {
        const fish = sharedData.current.fishes[i];
        
        // Pick random species from new tier
        const possibleSpecies = TIERS[currentTier];
        const speciesId = possibleSpecies[Math.floor(Math.random() * possibleSpecies.length)];
        const profile = FISH_SPECIES[speciesId];
        
        fish.tier = currentTier;
        fish.speciesId = speciesId;
        fish.scaleJitter = randomRange(profile.scaleRange[0], profile.scaleRange[1]);
        fish.swimPhase = Math.random() * Math.PI * 2;

        fish.position.set(
          (Math.random() - 0.5) * 60,
          getSpawnYForTier(currentTier),
          (Math.random() - 0.5) * 30
        );

        fish.velocity.set(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(MAX_SPEED * profile.speedScale);
      }
    }
    
    lastPointer.current.copy(currentPointer);
  });

  return (
    <group>
      {Array.from({ length: FISH_COUNT }).map((_, i) => (
        <Fish key={i} index={i} sharedData={sharedData} onOpenPanel={onOpenPanel} memoryState={memoryState} setCrosshairHover={setCrosshairHover} />
      ))}
    </group>
  );
}
