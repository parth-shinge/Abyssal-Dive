import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';

const DIVE_START_POS = new THREE.Vector3(0, -20, 0);

function ScubaControls({ isDiverMode, setIsDiverMode }) {
  const { camera, gl } = useThree();
  const controlsRef = useRef();
  
  // Track keys
  const keys = useRef({ w: false, a: false, s: false, d: false });
  // Velocity for smooth movement
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());

  // Helper to clear all pressed keys (prevents stuck movement)
  const clearKeys = () => {
    keys.current.w = false;
    keys.current.a = false;
    keys.current.s = false;
    keys.current.d = false;
  };

  // Handle pointer lock changes — if user Esc's out, exit diver mode
  useEffect(() => {
    const onLockChange = () => {
      if (!document.pointerLockElement && isDiverMode) {
        clearKeys();
        setIsDiverMode(false);
      }
    };
    const onLockError = () => {
      console.warn('Pointer lock denied');
      clearKeys();
      setIsDiverMode(false);
    };

    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('pointerlockerror', onLockError);
    return () => {
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('pointerlockerror', onLockError);
    };
  }, [isDiverMode, setIsDiverMode]);

  // Request pointer lock when diver mode activates via user gesture click in DiverSystem
  // Removed setTimeout from useEffect to prevent pointer lock denial

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isDiverMode) return;
      if (e.code === 'KeyW') keys.current.w = true;
      if (e.code === 'KeyA') keys.current.a = true;
      if (e.code === 'KeyS') keys.current.s = true;
      if (e.code === 'KeyD') keys.current.d = true;
      if (e.code === 'KeyE' || e.key === 'Escape') {
         clearKeys();
         if (document.pointerLockElement) {
            document.exitPointerLock();
         }
         setIsDiverMode(false);
      }
    };
    const handleKeyUp = (e) => {
      // Always allow key-up to clear, even if isDiverMode just turned off
      if (e.code === 'KeyW') keys.current.w = false;
      if (e.code === 'KeyA') keys.current.a = false;
      if (e.code === 'KeyS') keys.current.s = false;
      if (e.code === 'KeyD') keys.current.d = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isDiverMode, setIsDiverMode]);

  useFrame((state, delta) => {
    if (!isDiverMode || !controlsRef.current || !controlsRef.current.isLocked) return;

    // Movement logic
    const speed = 40.0; // Increased speed for better traversal
    const drag = 5.0; // Adjusted drag to match new speed
    
    // Apply drag
    velocity.current.x -= velocity.current.x * drag * delta;
    velocity.current.z -= velocity.current.z * drag * delta;
    velocity.current.y -= velocity.current.y * drag * delta;

    direction.current.z = Number(keys.current.w) - Number(keys.current.s);
    direction.current.x = Number(keys.current.d) - Number(keys.current.a);
    if (direction.current.length() > 0.0001) direction.current.normalize();

    if (keys.current.w || keys.current.s) velocity.current.z -= direction.current.z * speed * delta;
    if (keys.current.a || keys.current.d) velocity.current.x -= direction.current.x * speed * delta;

    // Use raw camera translation instead of PointerLockControls.moveForward to allow 3D vertical swimming
    const cam = controlsRef.current.getObject();
    cam.translateX(-velocity.current.x * delta);
    cam.translateZ(velocity.current.z * delta);

    // Apply breathing / floaty effect
    const time = state.clock.getElapsedTime();
    camera.position.y += Math.sin(time * 1.5) * 0.005;

    // Radius constraints
    const dist = camera.position.distanceTo(DIVE_START_POS);
    const maxRadius = 30;
    if (dist > maxRadius) {
      const clampDir = camera.position.clone().sub(DIVE_START_POS).normalize();
      camera.position.copy(DIVE_START_POS).add(clampDir.multiplyScalar(maxRadius));
    }
    
    // Y Bounds
    if (camera.position.y > -5) camera.position.y = -5;
    if (camera.position.y < -55) camera.position.y = -55;
  });

  return isDiverMode ? <PointerLockControls ref={controlsRef} /> : null;
}

export default function DiverSystem({ isDiverMode, setIsDiverMode, isTransitioningDive, setIsTransitioningDive }) {
  const { camera, gl } = useThree();
  const beaconCoreRef = useRef();
  const beaconRingRef = useRef();
  const beaconHaloRef = useRef();
  const beaconLightRef = useRef();

  useFrame((state) => {
    if (isDiverMode) return;

    const time = state.clock.getElapsedTime();
    const pulse = 0.72 + 0.28 * Math.sin(time * 2.1);
    const depthBoost = THREE.MathUtils.clamp((-state.camera.position.y - 12) / 34, 0, 1);

    if (beaconCoreRef.current?.material) {
      beaconCoreRef.current.material.emissiveIntensity = 0.55 + depthBoost * 1.25 + pulse * 0.55;
    }

    if (beaconHaloRef.current?.material) {
      beaconHaloRef.current.material.opacity = (0.14 + depthBoost * 0.28) * pulse;
      beaconHaloRef.current.scale.setScalar(1.08 + pulse * 0.15);
    }

    if (beaconRingRef.current?.material) {
      beaconRingRef.current.material.opacity = (0.2 + depthBoost * 0.35) * (0.55 + pulse * 0.45);
      const ringScale = 1.0 + pulse * 0.35;
      beaconRingRef.current.scale.set(ringScale, ringScale, ringScale);
      beaconRingRef.current.rotation.z += 0.006;
    }

    if (beaconLightRef.current) {
      beaconLightRef.current.intensity = 0.9 + depthBoost * 1.8 + pulse * 0.45;
      beaconLightRef.current.distance = 6 + depthBoost * 4;
    }
  });

  return (
    <>
      <ScubaControls isDiverMode={isDiverMode} setIsDiverMode={setIsDiverMode} />
      
      {!isDiverMode && (
        <group position={[0, -20, 0]} onClick={(e) => { 
                 e.stopPropagation(); 
                 if (isTransitioningDive) return;
                 setIsTransitioningDive(true);
                 
                 const beaconPos = new THREE.Vector3(0, -20, 0);
                 const dir = beaconPos.clone().sub(camera.position).normalize();
                 const dist = camera.position.distanceTo(beaconPos);
                 const moveDist = Math.min(10, dist * 0.4);
                 const targetPos = camera.position.clone().add(dir.multiplyScalar(moveDist));

                 gsap.to(camera.position, {
                   x: targetPos.x,
                   y: targetPos.y,
                   z: targetPos.z,
                   duration: 1.5,
                   ease: "power2.inOut",
                   onComplete: () => {
                     setIsTransitioningDive(false);
                     setIsDiverMode(true);
                     try {
                        gl.domElement.requestPointerLock();
                     } catch (err) {
                        console.warn("Could not request pointer lock:", err);
                     }
                   }
                 });
               }}
               onPointerOver={() => document.body.style.cursor = 'pointer'}
               onPointerOut={() => document.body.style.cursor = 'auto'}>
          {/* Simple Diver Avatar/Beacon */}
          <mesh position={[0, 0, 0]}>
            <capsuleGeometry args={[0.4, 1, 4, 16]} />
            <meshStandardMaterial color="#222" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.6, 0.2]}>
             <boxGeometry args={[0.6, 0.3, 0.4]} />
             <meshStandardMaterial ref={beaconCoreRef} color="#66bfff" emissive="#2d8cff" emissiveIntensity={1.0} roughness={0.08} metalness={0.15} />
           </mesh>
           <mesh ref={beaconHaloRef} position={[0, 0.6, 0.2]}>
             <sphereGeometry args={[0.52, 16, 16]} />
             <meshBasicMaterial color="#5ec5ff" transparent opacity={0.2} depthWrite={false} />
           </mesh>
           <mesh ref={beaconRingRef} position={[0, 0.6, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
             <torusGeometry args={[0.74, 0.032, 12, 48]} />
             <meshBasicMaterial color="#8fe0ff" transparent opacity={0.18} depthWrite={false} />
          </mesh>
           <pointLight ref={beaconLightRef} color="#63bfff" distance={7} intensity={1.2} />
          <Html position={[0, 1.5, 0]} center style={{ pointerEvents: 'none' }}>
            <div className="diver-beacon-label" style={{ color: '#fff', fontSize: '0.9rem', background: 'rgba(0,20,40,0.8)', padding: '6px 14px', borderRadius: '20px', whiteSpace: 'nowrap', border: '1px solid #44aaff' }}>
              Click to Dive
            </div>
          </Html>
        </group>
      )}
    </>
  );
}
