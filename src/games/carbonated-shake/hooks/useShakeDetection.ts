'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MOTION_GRAVITY_SMOOTHING,
  MOTION_MAX_GAP_SECONDS,
  MOTION_NOISE_THRESHOLD,
  MOTION_NORMALIZATION,
} from '../constants';

type MotionPermission = 'unknown' | 'granted' | 'denied' | 'unsupported';
interface MotionVector { x: number; y: number; z: number }

function finiteVector(value: { x?: unknown; y?: unknown; z?: unknown } | null | undefined): MotionVector | null {
  if (!value) return null;
  if (typeof value.x !== 'number' || typeof value.y !== 'number' || typeof value.z !== 'number') return null;
  const { x, y, z } = value;
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? { x, y, z } : null;
}

function magnitude(vector: MotionVector): number {
  return Math.sqrt(vector.x ** 2 + vector.y ** 2 + vector.z ** 2);
}

export function useShakeDetection(onShakeAmount: (amount: number) => void, fallbackEnabled = false) {
  const [permission, setPermission] = useState<MotionPermission>('unknown');
  const [holding, setHolding] = useState(false);
  const [sensorSeen, setSensorSeen] = useState(false);
  const holdingRef = useRef(false);
  const lastTimestampRef = useRef<number | null>(null);
  const gravityRef = useRef<MotionVector | null>(null);
  const onShakeAmountRef = useRef(onShakeAmount);
  useEffect(() => { onShakeAmountRef.current = onShakeAmount; }, [onShakeAmount]);

  const resetSensorBaseline = useCallback(() => {
    lastTimestampRef.current = null;
    gravityRef.current = null;
  }, []);

  const endHold = useCallback(() => {
    holdingRef.current = false;
    setHolding(false);
    resetSensorBaseline();
  }, [resetSensorBaseline]);

  const beginHold = useCallback(() => {
    holdingRef.current = true;
    setHolding(true);
    resetSensorBaseline();
  }, [resetSensorBaseline]);

  const addFallbackShake = useCallback((distance: number) => {
    if (fallbackEnabled && holdingRef.current && Number.isFinite(distance)) {
      onShakeAmountRef.current(Math.max(0, Math.min(distance, 80)) / 160);
    }
  }, [fallbackEnabled]);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !window.isSecureContext || !('DeviceMotionEvent' in window)) {
      setPermission('unsupported');
      return false;
    }

    const motionEvent = window.DeviceMotionEvent as typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    try {
      if (typeof motionEvent.requestPermission === 'function') {
        const result = await motionEvent.requestPermission();
        const granted = result === 'granted';
        setPermission(granted ? 'granted' : 'denied');
        return granted;
      }
      setPermission('granted');
      return true;
    } catch {
      setPermission('denied');
      return false;
    }
  }, []);

  useEffect(() => {
    if (permission !== 'granted' || fallbackEnabled) return;

    const handleMotion = (event: DeviceMotionEvent) => {
      if (!holdingRef.current) return;
      const now = event.timeStamp > 0 ? event.timeStamp : performance.now();
      const previous = lastTimestampRef.current;
      lastTimestampRef.current = now;
      if (previous === null) return;
      const deltaSeconds = (now - previous) / 1000;
      if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || deltaSeconds > MOTION_MAX_GAP_SECONDS) {
        if (deltaSeconds > MOTION_MAX_GAP_SECONDS) gravityRef.current = null;
        return;
      }

      let vector = finiteVector(event.acceleration);
      if (!vector) {
        const withGravity = finiteVector(event.accelerationIncludingGravity);
        if (!withGravity) return;
        const previousGravity = gravityRef.current ?? withGravity;
        const alpha = 1 - Math.exp(-deltaSeconds / Math.max(0.001, MOTION_GRAVITY_SMOOTHING));
        const gravity = {
          x: previousGravity.x + (withGravity.x - previousGravity.x) * alpha,
          y: previousGravity.y + (withGravity.y - previousGravity.y) * alpha,
          z: previousGravity.z + (withGravity.z - previousGravity.z) * alpha,
        };
        gravityRef.current = gravity;
        vector = { x: withGravity.x - gravity.x, y: withGravity.y - gravity.y, z: withGravity.z - gravity.z };
      }

      const movement = Math.max(0, magnitude(vector) - MOTION_NOISE_THRESHOLD);
      setSensorSeen(true);
      if (movement > 0) onShakeAmountRef.current(movement * deltaSeconds * MOTION_NORMALIZATION);
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [fallbackEnabled, permission]);

  useEffect(() => {
    const stop = () => endHold();
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stop);
    return () => {
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', stop);
    };
  }, [endHold]);

  return { permission, holding, sensorSeen, beginHold, endHold, requestPermission, addFallbackShake };
}
