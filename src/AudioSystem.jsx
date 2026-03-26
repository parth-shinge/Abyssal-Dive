import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function AudioSystem({ isMuted }) {
  const audioCtxRef = useRef(null);
  const nodesRef = useRef(null);
  const isAudioStartedRef = useRef(false);
  const isInitInProgressRef = useRef(false);

  useEffect(() => {
    const startAudio = (ctx) => {
      if (isAudioStartedRef.current) return;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const masterGain = ctx.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(ctx.destination);

      // 1. Surface Waves (White noise filtered)
      const bufferSize = ctx.sampleRate * 2; 
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const waveFilter = ctx.createBiquadFilter();
      waveFilter.type = 'lowpass';
      waveFilter.frequency.value = 800;

      const waveGain = ctx.createGain();
      // Immediate audible baseline for startup debug; useFrame depth logic takes over right after.
      waveGain.gain.value = 0.2;

      noiseSource.connect(waveFilter);
      waveFilter.connect(waveGain);
      waveGain.connect(masterGain);
      noiseSource.start();

      // 2. Mid Depth Ambience
      const midFilter = ctx.createBiquadFilter();
      midFilter.type = 'lowpass';
      midFilter.frequency.value = 300;
      
      const midGain = ctx.createGain();
      midGain.gain.value = 0;
      
      const midNoiseSource = ctx.createBufferSource();
      midNoiseSource.buffer = noiseBuffer;
      midNoiseSource.loop = true;
      midNoiseSource.connect(midFilter);
      midFilter.connect(midGain);
      midGain.connect(masterGain);
      midNoiseSource.start();

      // 3. Deep Hum
      const deepOsc1 = ctx.createOscillator();
      deepOsc1.type = 'sine';
      deepOsc1.frequency.value = 55; // Big bass
      
      const deepOsc2 = ctx.createOscillator();
      deepOsc2.type = 'triangle';
      deepOsc2.frequency.value = 54; // Detuned low frequency hum

      const deepFilter = ctx.createBiquadFilter();
      deepFilter.type = 'lowpass';
      deepFilter.frequency.value = 120; // pure rumble

      const deepGain = ctx.createGain();
      deepGain.gain.value = 0;
      
      deepOsc1.connect(deepFilter);
      deepOsc2.connect(deepFilter);
      deepFilter.connect(deepGain);
      deepGain.connect(masterGain);
      deepOsc1.start();
      deepOsc2.start();

      nodesRef.current = { masterGain, waveGain, waveFilter, midGain, midFilter, deepGain, deepFilter };
      isAudioStartedRef.current = true;
    };

    const playTestBeep = (ctx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = 440;
      gain.gain.value = 0.1;

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    };

    const removeInteractionListeners = () => {
      window.removeEventListener('scroll', initAudioOnInteraction);
      window.removeEventListener('click', initAudioOnInteraction);
      window.removeEventListener('keydown', initAudioOnInteraction);
    };

    const initAudioOnInteraction = async () => {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (isInitInProgressRef.current) return;
      isInitInProgressRef.current = true;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }

      const ctx = audioCtxRef.current;

      try {
        // Browser autoplay policy compliance: resume first after user gesture.
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        console.log('AudioContext state:', ctx.state);

        if (!isAudioStartedRef.current) {
          playTestBeep(ctx);
          startAudio(ctx);
        }

        if (isAudioStartedRef.current) {
          removeInteractionListeners();
        }
      } catch (error) {
        console.error('Audio init failed:', error);
      } finally {
        isInitInProgressRef.current = false;
      }
    };

    window.addEventListener('scroll', initAudioOnInteraction, { passive: true });
    window.addEventListener('click', initAudioOnInteraction, { passive: true });
    window.addEventListener('keydown', initAudioOnInteraction);

    return () => {
      removeInteractionListeners();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (nodesRef.current && audioCtxRef.current) {
      nodesRef.current.masterGain.gain.setTargetAtTime(isMuted ? 0 : 0.5, audioCtxRef.current.currentTime, 0.1);
    }
  }, [isMuted]);

  useFrame((state) => {
    if (!nodesRef.current || !audioCtxRef.current || audioCtxRef.current.state === 'suspended') return;
    const { waveGain, waveFilter, midGain, midFilter, deepGain } = nodesRef.current;
    
    const y = state.camera.position.y;
    const now = audioCtxRef.current.currentTime;
    
    // Smooth Transition 1: Surface Waves
    let waveVol = 0;
    if (y > -10) {
       waveVol = THREE.MathUtils.clamp((y - (-10)) / 10, 0, 1);
       if (y > 0) waveVol = 1;
    }
    waveGain.gain.setTargetAtTime(waveVol * 0.25, now, 0.5);
    
    // Smooth Transition 2: Mid-Depth Ambiance (Peaks at y: -20)
    let midVol = 0;
    if (y <= -5 && y >= -45) {
       midVol = 1.0 - Math.abs(y - (-20)) / 20;
       midVol = THREE.MathUtils.clamp(midVol, 0, 1);
    }
    midGain.gain.setTargetAtTime(midVol * 0.6, now, 0.5);

    // Smooth Transition 3: Deep Hum
    let deepVol = 0;
    if (y < -25) {
      deepVol = THREE.MathUtils.clamp((y - (-25)) / -25, 0, 1);
    }
    deepGain.gain.setTargetAtTime(deepVol * 1.5, now, 0.5);
    
    // Faint Breathing effect in Abyss and kill mids
    if (y < -40) {
      const breathCycle = Math.sin(now * 0.7) * 0.5 + 0.5; // 0 to 1 pulsing
      waveGain.gain.setTargetAtTime(breathCycle * 0.15, now, 0.5); // Faint pulsing
      midGain.gain.setTargetAtTime(0, now, 2.0); // Silence the mid ambience
    } else {
      waveGain.gain.setTargetAtTime(waveVol * 0.25, now, 0.5);
    }
    
    // Lowpass filter tightens with depth (Surface: 1200Hz, Abyss: 200Hz)
    const normalizedUnderwaterDepth = THREE.MathUtils.clamp((y - (-4)) / -46, 0, 1);
    const cutoff = THREE.MathUtils.lerp(1200, 200, normalizedUnderwaterDepth);
    waveFilter.frequency.setTargetAtTime(cutoff, now, 0.5);
    midFilter.frequency.setTargetAtTime(cutoff, now, 0.5);
  });

  return null;
}
