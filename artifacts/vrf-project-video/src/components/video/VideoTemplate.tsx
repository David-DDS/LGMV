import {
  VideoCanvas,
  type VideoAspectRatio,
  useVideoPlayer,
  VideoPausedContext,
} from '@/lib/video';
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { Scene0 } from './video_scenes/Scene0';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS = {
  scene0: 6000,
  scene1: 6000,
  scene2: 6000,
  scene3: 8000,
  scene4: 12000,
  scene5: 4000,
};

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '9:16';

const scenes = [Scene0, Scene1, Scene2, Scene3, Scene4, Scene5];
const starts: Record<string, number> = {};
let offset = 0;
for (const [key, duration] of Object.entries(SCENE_DURATIONS)) {
  starts[key] = offset;
  offset += duration / 1000;
}

export default function VideoTemplate({ durations = SCENE_DURATIONS, paused = false, muted = false, onSceneChange }: {
  durations?: Record<string, number>; paused?: boolean; muted?: boolean; onSceneChange?: (key: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, paused });
  const baseKey = currentSceneKey.replace(/_r[12]$/, '');
  const currentScene = Object.keys(SCENE_DURATIONS).indexOf(baseKey);
  const Scene = scenes[currentScene];
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastScene = useRef<string | null>(null);
  useEffect(() => { onSceneChange?.(currentSceneKey); }, [currentSceneKey, onSceneChange]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    if (paused) { audio.pause(); return; }
    if (lastScene.current !== currentSceneKey) {
      lastScene.current = currentSceneKey;
      const target = starts[baseKey] ?? 0;
      if (Math.abs(audio.currentTime - target) > 0.18) audio.currentTime = target;
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseKey, muted, paused]);

  return (
    <VideoPausedContext.Provider value={paused}>
    <VideoCanvas
      aspectRatio={VIDEO_ASPECT_RATIO}
      style={{ backgroundColor: 'var(--color-background)', overflow: 'hidden' }}
    >
      {/* Persistent Background Elements */}
      <motion.div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 50%, var(--color-primary) 0%, transparent 60%)',
          backgroundSize: '150% 150%',
        }}
        animate={{
          backgroundPosition: currentScene % 2 === 0 ? '50% 30%' : '50% 70%',
          scale: currentScene === 0 ? 1 : 1.2,
          opacity: currentScene === 5 ? 0.3 : 0.15,
        }}
        transition={{ duration: 4, ease: 'easeInOut' }}
      />
      
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}
      />

      <AnimatePresence mode="popLayout">
        {Scene && <Scene key={currentSceneKey} currentScene={currentScene} />}
      </AnimatePresence>
      <audio ref={audioRef} src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`} preload="auto" autoPlay muted={muted} />
    </VideoCanvas>
    </VideoPausedContext.Provider>
  );
}