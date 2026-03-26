import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './IntroCards.css';

/* ═══════════════════════════════════════════════════
   CINEMATIC INTRO CARDS
   3-card story intro with 3D flip + staggered text.
   Props: onFinish() — called after the last card.
   ═══════════════════════════════════════════════════ */

const CARDS = [
  {
    id: 0,
    lines: [
      'The ocean covers more than 70% of Earth…',
      'yet we have explored less than 5% of it.',
    ],
  },
  {
    id: 1,
    lines: [
      'Beneath the surface lies a world untouched…',
      'where light fades, and pressure rises.',
    ],
  },
  {
    id: 2,
    lines: [
      'This is not just a dive…',
      'This is a descent into the unknown.',
    ],
  },
];

// ── Animation variants ────────────────────────────

// Cinematic cubic-bezier curves
const EASE_SLOW_IN_OUT = [0.16, 1, 0.3, 1];   // dramatic slow-out
const EASE_CINEMATIC   = [0.76, 0, 0.24, 1];   // smooth accelerate-decelerate

// Card: 3D flip with cinematic slow zoom + fade through black
const cardVariants = {
  enter: (direction) => ({
    rotateY: direction > 0 ? 150 : -150,
    scale: 0.92,
    opacity: 0,
    filter: 'blur(8px)',
  }),
  center: {
    rotateY: 0,
    scale: 1,
    opacity: 1,
    filter: 'blur(0px)',
    transition: {
      type: 'tween',
      duration: 1.4,            // slow reveal (cinematic)
      ease: EASE_SLOW_IN_OUT,
      opacity: { duration: 0.9, ease: EASE_CINEMATIC },  // fade in from black
      scale:   { duration: 1.6, ease: EASE_SLOW_IN_OUT }, // slight zoom overshoot
    },
  },
  exit: (direction) => ({
    rotateY: direction > 0 ? -120 : 120,
    scale: 1.04,                // subtle zoom-out as it leaves
    opacity: 0,
    filter: 'blur(8px)',
    transition: {
      type: 'tween',
      duration: 1.0,            // fade to black before next card
      ease: EASE_CINEMATIC,
      opacity: { duration: 0.6, ease: [0.4, 0, 1, 1] }, // quick fade to black
    },
  }),
};

// Each text line: staggered fade-in + rise (slow cinematic reveal)
const lineVariants = {
  hidden: {
    opacity: 0,
    y: 22,
    scale: 0.97,
    filter: 'blur(5px)',
  },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      delay: 0.7 + i * 0.45,     // longer stagger for dramatic pacing
      duration: 1.2,              // slow text reveal
      ease: EASE_SLOW_IN_OUT,
    },
  }),
};

// Full overlay fade-out (cinematic slow dissolve)
const overlayExit = {
  opacity: 0,
  scale: 1.05,
  filter: 'blur(3px)',
  transition: {
    duration: 1.6,              // slow final dissolve
    ease: EASE_CINEMATIC,
  },
};

export default function IntroCards({ onFinish, onBeforeInteract }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [exiting, setExiting] = useState(false);

  const advance = useCallback(() => {
    onBeforeInteract?.();

    if (exiting) return;

    if (index < CARDS.length - 1) {
      setDirection(1);
      setIndex((prev) => prev + 1);
    } else {
      // Last card — fade out the entire overlay
      setExiting(true);
    }
  }, [index, exiting, onBeforeInteract]);

  const handleExitComplete = useCallback(() => {
    if (exiting) {
      onFinish?.();
    }
  }, [exiting, onFinish]);

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {!exiting && (
        <motion.div
          className="intro-overlay"
          onClick={advance}
          exit={overlayExit}
          key="intro-overlay"
        >
          {/* 3D stage */}
          <div className="intro-card-stage">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                className="intro-card"
                key={CARDS[index].id}
                custom={direction}
                variants={cardVariants}
                initial="enter"
                animate="center"
                exit="exit"
                style={{ transformStyle: 'preserve-3d' }}
              >
                {CARDS[index].lines.map((line, i) => (
                  <motion.p
                    className="intro-line"
                    key={`${CARDS[index].id}-${i}`}
                    custom={i}
                    variants={lineVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    {line}
                  </motion.p>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>

          <motion.p
            className="intro-instruction"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0.2, 0.42, 0.2],
              scale: [1, 1.03, 1],
            }}
            transition={{
              duration: 4,
              ease: 'easeInOut',
              repeat: Infinity,
            }}
          >
            Click to begin
          </motion.p>

          {/* Minimal dot indicators */}
          <div className="intro-dots">
            {CARDS.map((_, i) => (
              <div
                key={i}
                className={`intro-dot ${i === index ? 'active' : ''}`}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
