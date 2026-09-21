import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react';
import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const titles = ['Apresentação', 'Leituras', 'Análise IA', 'Referência LG', 'Relatório Word', 'Encerramento'];
const formatTime = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

function PlaybackStatus({ controls }: { controls: ReturnType<typeof useSceneControls> }) {
  const { tick, paused, activeDuration, activeStartTime, totalDuration, sceneKeys, activeIndex, jumpTo } = controls;
  const [elapsed, setElapsed] = useState(0);
  const base = useRef(0);
  useEffect(() => { base.current = 0; setElapsed(0); }, [tick]);
  useEffect(() => {
    if (paused) return;
    const start = performance.now();
    const id = window.setInterval(() => setElapsed(base.current + performance.now() - start), 60);
    return () => { clearInterval(id); base.current += performance.now() - start; };
  }, [tick, paused]);
  return <>
    <div style={{ display: 'flex', gap: 5, flex: 1 }}>
      {sceneKeys.map((key, i) => <button key={key} aria-label={`Cena ${i + 1}: ${titles[i]}`}
        onClick={() => {
          jumpTo(i);
          window.parent.postMessage({ type: 'REPLIT_VIDEO_SCENE_SELECTED', payload: {
            sceneIndex: i, sceneCount: sceneKeys.length, sceneTitle: titles[i],
            filePath: `src/components/video/video_scenes/Scene${i}.tsx`, lineNumber: 1,
          } }, '*');
        }} style={{ flex: 1, height: 14, borderRadius: 8, background: '#ffffff35', overflow: 'hidden', border: 0, padding: 0 }}>
        <span style={{ display: 'block', height: '100%', background: '#ff6200',
          width: `${i === activeIndex ? Math.min(1, elapsed / activeDuration) * 100 : 0}%` }} />
      </button>)}
    </div>
    <span>{activeIndex + 1}/{sceneKeys.length}</span>
    <span role="timer">{formatTime(activeStartTime + Math.min(elapsed, activeDuration))} / {formatTime(totalDuration)}</span>
  </>;
}

export default function VideoWithControls() {
  const controls = useSceneControls(SCENE_DURATIONS);
  const [muted, setMuted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [pinned, setPinned] = useState(false);
  const sensor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!controls.paused) return;
    const animations = document.getAnimations().filter(a => a.playState === 'running');
    animations.forEach(a => a.pause());
    return () => animations.forEach(a => a.play());
  }, [controls.paused]);
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && !sensor.current?.contains(e.target as Node)) setPinned(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  if (window.self === window.top) return <VideoTemplate />;
  const visible = !collapsed || hovering || pinned;
  const buttonStyle = { width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 0, background: 'transparent', color: 'white', flexShrink: 0 } as const;
  return <div className="relative w-full h-screen">
    <VideoTemplate key={controls.mountKey} durations={controls.durations} paused={controls.paused}
      muted={muted} onSceneChange={controls.onSceneChange} />
    <div ref={sensor} onPointerEnter={e => e.pointerType === 'mouse' && setHovering(true)}
      onPointerLeave={e => e.pointerType === 'mouse' && setHovering(false)}
      onPointerDown={e => e.pointerType !== 'mouse' && collapsed && setPinned(true)}
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '25%', zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div style={{ flex: 1 }} />
      <div aria-hidden={!visible} style={{ padding: '8px 12px', background: '#08090be8', color: 'white',
        fontSize: 12, transition: 'transform .2s, opacity .2s', transform: visible ? 'none' : 'translateY(100%)',
        opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button style={buttonStyle} onClick={controls.togglePause} aria-label={controls.paused ? 'Reproduzir' : 'Pausar'}>{controls.paused ? <Play /> : <Pause />}</button>
          <button style={{ ...buttonStyle, color: controls.locked ? '#ff6200' : 'white' }} aria-label="Repetir cena" aria-pressed={controls.locked} onClick={controls.toggleLock}><Repeat /></button>
          <button style={buttonStyle} aria-label={muted ? 'Ativar som' : 'Silenciar'} onClick={() => setMuted(v => !v)}>{muted ? <VolumeX /> : <Volume2 />}</button>
          <button style={buttonStyle} aria-label={collapsed ? 'Mostrar controles' : 'Ocultar controles'} onClick={() => { setCollapsed(v => !v); setHovering(false); setPinned(false); }}>{collapsed ? <ChevronUp /> : <ChevronDown />}</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 8px' }}><PlaybackStatus controls={controls} /></div>
      </div>
    </div>
  </div>;
}