import { useCallback, useMemo, useState } from 'react';

export function useSceneControls(base: Record<string, number>) {
  const sceneKeys = useMemo(() => Object.keys(base), [base]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [startIndex, setStartIndex] = useState(0);
  const [locked, setLocked] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mountKey, setMountKey] = useState(0);
  const [tick, setTick] = useState(0);
  const durations = useMemo(() => {
    const key = sceneKeys[startIndex];
    if (locked) return { [`${key}_r1`]: base[key], [`${key}_r2`]: base[key] };
    return Object.fromEntries(sceneKeys.map((_, index) => {
      const name = sceneKeys[(startIndex + index) % sceneKeys.length];
      return [name, base[name]];
    }));
  }, [base, sceneKeys, startIndex, locked]);
  const onSceneChange = useCallback((key: string) => {
    const index = sceneKeys.indexOf(key.replace(/_r[12]$/, ''));
    if (index >= 0) setActiveIndex(index);
    setTick(t => t + 1);
  }, [sceneKeys]);
  const jumpTo = (index: number) => {
    setStartIndex(index); setActiveIndex(index); setPaused(false);
    setMountKey(k => k + 1);
  };
  const toggleLock = () => {
    setStartIndex(activeIndex); setLocked(v => !v); setPaused(false);
    setMountKey(k => k + 1);
  };
  return {
    sceneKeys, activeIndex, locked, paused, mountKey, tick, durations,
    activeDuration: base[sceneKeys[activeIndex]],
    activeStartTime: sceneKeys.slice(0, activeIndex).reduce((t, k) => t + base[k], 0),
    totalDuration: Object.values(base).reduce((t, n) => t + n, 0),
    onSceneChange, jumpTo, toggleLock, togglePause: () => setPaused(v => !v),
  };
}