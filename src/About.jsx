import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import './About.css';

const CHAPTERS = [
  { id: 1, title: 'The Surface', desc: 'The sun kisses the waves, and life begins in the light.' },
  { id: 2, title: 'The Descent', desc: 'The warmth fades. Shadows grow longer. The known world stays behind.' },
  { id: 3, title: 'The Twilight', desc: 'Faint glows emerge from the dark. Strange eyes watch from the gloom.' },
  { id: 4, title: 'The Midnight', desc: 'Sunlight is but a memory. Here, pressure is king, and darkness is absolute.' },
  { id: 5, title: 'The Abyss', desc: 'Surviving the extremes. A world that feels more alien than another planet.' },
  { id: 6, title: 'The Realization', desc: 'In the deepest dark, we find our own reflection. Humanity is but a guest in this vast blue cradle.' }
];

const MARINE_LIFE = [
  { name: 'Shark', depth: '0-200m', desc: 'Apex predator of the upper layers. Swift and deeply misunderstood.' },
  { name: 'Tuna', depth: '0-500m', desc: 'High-speed hunters of the open ocean. Built for endurance.' },
  { name: 'Catfish', depth: '0-600m', desc: 'Bottom-dwellers of the coastal shelves. Whiskered navigators of the dark.' },
  { name: 'Jellyfish', depth: '0-1000m', desc: 'Ethereal drifters of the deep. Pulsing lights in the pitch black.' },
  { name: 'Stingray', depth: '0-3000m', desc: 'Flat shadows gliding silently across the sea floor.' },
  { name: 'Anglerfish', depth: '1000-4000m', desc: 'The iconic "bulb fish" of the midnight zone. A living trap.' },
  { name: 'Starfish', depth: '0-6000m', desc: 'Hardy survivors on the deepest floor. Slow but resilient.' }
];

const ChapterCard = ({ chapter, index }) => {
  return (
    <motion.div 
      className="about-chapter-card"
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: false, margin: "-20%" }}
      transition={{ duration: 1.2, ease: [0.25, 1, 0.5, 1] }}
      whileHover={{ scale: 1.05, zIndex: 10 }}
    >
      <div className="chapter-number">0{chapter.id}</div>
      <h2 className="chapter-title">{chapter.title}</h2>
      <p className="chapter-desc">{chapter.desc}</p>
    </motion.div>
  );
};

export default function About({ onClose }) {
  const containerRef = useRef(null);
  
  // Create a cinematic zoom effect based on scroll position
  const { scrollYProgress } = useScroll({ target: containerRef });
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.5]);
  const bgOpacity = useTransform(scrollYProgress, [0, 0.8, 1], [0.6, 0.2, 0]);

  return (
    <motion.div 
      className="about-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
      ref={containerRef}
    >
      <motion.div 
        className="about-background" 
        style={{ scale: bgScale, opacity: bgOpacity }}
      />
      
      <button className="about-close-btn" onClick={onClose}>
        <span className="close-icon">×</span> CLOSE
      </button>

      <div className="about-content">
         <motion.div 
            className="about-header"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 1 }}
         >
            <h1>THE DEEP STORY</h1>
            <p>Our journey into the unknown.</p>
         </motion.div>

         <div className="chapters-grid">
            {CHAPTERS.map((chap, i) => (
               <ChapterCard key={chap.id} chapter={chap} index={i} />
            ))}
         </div>

         <motion.div 
            className="marine-life-section"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 1.5 }}
         >
            <h2 className="section-title">DENIZENS OF THE DEEP</h2>
            <div className="marine-grid">
               {MARINE_LIFE.map((life, i) => (
                  <motion.div 
                     className="marine-card" 
                     key={i}
                     initial={{ opacity: 0, x: -20 }}
                     whileInView={{ opacity: 1, x: 0 }}
                     viewport={{ once: true }}
                     transition={{ delay: i * 0.1, duration: 0.8 }}
                  >
                     <div className="marine-header">
                        <h3>{life.name}</h3>
                        <span className="marine-depth">{life.depth}</span>
                     </div>
                     <p>{life.desc}</p>
                  </motion.div>
               ))}
            </div>
         </motion.div>
      </div>
    </motion.div>
  );
}
