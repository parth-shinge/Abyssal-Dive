import React, { useRef } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

const NPC_DIALOGUES = {
  guideA: [
    'Few humans have reached this depth...',
    'Every meter down rewrites what survival means.',
    'Listen closely. The abyss speaks in pressure and silence.',
  ],
  guideB: [
    'The pressure here can crush steel...',
    'Our tunnel walls flex by millimeters to absorb force.',
    'Down here, engineering is the difference between wonder and collapse.',
  ],
  guideC: [
    'We are visitors in a world not meant for us.',
    'Most life here evolved without sunlight.',
    'Bioluminescence is language, bait, and camouflage all at once.',
  ],
};

export default function MuseumSystem({ onOpenPanel, onOpenDialogue, setMuseumHovered, museumHovered }) {
  const tunnelRef = useRef();

  // Low poly human
  const Human = ({ position, onClick }) => (
    <group 
      position={position}
      onClick={onClick}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={(e) => { document.body.style.cursor = 'auto'; }}
    >
      <mesh position={[0, 0.8, 0]}>
        <capsuleGeometry args={[0.2, 0.6, 4, 8]} />
        <meshStandardMaterial color="#002244" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color="#113355" roughness={0.6} />
      </mesh>
    </group>
  );

  return (
    <group 
      position={[0, -35, 2]}
      onPointerOver={(e) => { e.stopPropagation(); setMuseumHovered(true); }}
      onPointerOut={() => setMuseumHovered(false)}
    >
      {/* Museum Status Label */}
      <Html position={[0, 3, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{ color: '#00ffff', fontSize: '1.2rem', background: 'rgba(5, 15, 30, 0.8)', padding: '8px 20px', borderRadius: '30px', whiteSpace: 'nowrap', border: '1px solid rgba(0, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.15em', display: museumHovered ? 'block' : 'none' }}>
           Abyssal Museum Observatory
        </div>
      </Html>

      {/* Structural Ribs */}
      {[...Array(7)].map((_, i) => (
        <mesh key={i} position={[(i - 3) * 4.5, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[4.05, 0.08, 16, 64, Math.PI]} />
          <meshStandardMaterial color="#1a2b3c" metalness={0.9} roughness={0.1} emissive="#0055ff" emissiveIntensity={0.8} />
        </mesh>
      ))}

      {/* Glass tunnel */}
      <mesh ref={tunnelRef} rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]}>
        <cylinderGeometry args={[4, 4, 30, 32, 1, true, 0, Math.PI]} />
        <meshPhysicalMaterial 
          color="#cceeff"
          transmission={0.9}
          opacity={1}
          metalness={0.2}
          roughness={0.05}
          ior={1.4}
          thickness={0.5}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Floor of the tunnel */}
      <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
         <planeGeometry args={[30, 8]} />
         <meshStandardMaterial color="#0b1a2a" roughness={0.1} metalness={0.8} />
      </mesh>

      {/* Museum Lights (Soft Blue/Cyan Anime Style) */}
      <ambientLight color="#0088ff" intensity={museumHovered ? 0.6 : 0.4} />
      <pointLight position={[0, 3, 0]} color="#00e5ff" intensity={museumHovered ? 1.5 : 1.0} distance={20} />
      <pointLight position={[-10, 3, 0]} color="#00e5ff" intensity={museumHovered ? 1.2 : 0.8} distance={20} />
      <pointLight position={[10, 3, 0]} color="#00e5ff" intensity={museumHovered ? 1.2 : 0.8} distance={20} />

      {/* Humans */}
      <Human
        position={[-3, 0, 1]}
        onClick={(e) => {
          e.stopPropagation();
          onOpenDialogue({
            npcId: 'guideA',
            lines: NPC_DIALOGUES.guideA,
          });
        }}
      />
      <Human
        position={[2, 0, -1]}
        onClick={(e) => {
          e.stopPropagation();
          onOpenDialogue({
            npcId: 'guideB',
            lines: NPC_DIALOGUES.guideB,
          });
        }}
      />
      <Human
        position={[6, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onOpenDialogue({
            npcId: 'guideC',
            lines: NPC_DIALOGUES.guideC,
          });
        }}
      />

      {/* Interactive Markers */}
      <group position={[-5, 1, -2]}>
         <mesh 
           onClick={(e) => {
             e.stopPropagation();
             onOpenPanel({
                title: 'Midnight Zone Observation',
                desc: 'At this depth, pressure is intense. These glass tunnels are made of advanced transparent alloys to withstand crushing forces while providing a panoramic view of the abyss.',
                fact: 'Fun Fact: Most creatures here have never seen sunlight!'
             });
           }}
           onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
           onPointerOut={(e) => { document.body.style.cursor = 'auto'; }}
         >
            <sphereGeometry args={[0.4, 16, 16]} />
            <meshStandardMaterial color="#00ffff" emissive="#00aaff" emissiveIntensity={2} />
         </mesh>
         <pointLight color="#00ffff" intensity={1} distance={3} />
      </group>
      
      <group position={[5, 1, 2]}>
         <mesh 
           onClick={(e) => {
             e.stopPropagation();
             onOpenPanel({
                title: 'Deep Sea Ecology',
                desc: 'Creatures here rely on bioluminescence to communicate, attract prey, or defend themselves in perpetual darkness.',
                fact: 'Fun Fact: 90% of deep-sea marine life uses bioluminescence.'
             });
           }}
           onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
           onPointerOut={(e) => { document.body.style.cursor = 'auto'; }}
         >
            <sphereGeometry args={[0.4, 16, 16]} />
            <meshStandardMaterial color="#ffaa00" emissive="#ff8800" emissiveIntensity={2} />
         </mesh>
         <pointLight color="#ffaa00" intensity={1} distance={3} />
      </group>
    </group>
  );
}
