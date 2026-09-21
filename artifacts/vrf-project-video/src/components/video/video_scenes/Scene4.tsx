import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export const Scene4 = ({ currentScene }: { currentScene: number }) => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),  // Start gentle pan
      setTimeout(() => setPhase(2), 1500), // Show Insight
      setTimeout(() => setPhase(3), 2500), // Show Action
      setTimeout(() => setPhase(4), 3500), // Show Technical Report
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-between py-8 px-6"
      initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ opacity: 1, clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full text-center shrink-0 z-20">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-4xl font-bold mb-2 drop-shadow-md"
        >
          Insights e Plano
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-lg text-muted-foreground bg-background/80 backdrop-blur-md px-4 py-1.5 rounded-xl inline-block shadow-lg"
        >
          Passos claros gerados tecnicamente.
        </motion.p>
      </div>

      <motion.div
        initial={{ y: 50, opacity: 0, scale: 0.9 }}
        animate={phase >= 1 ? { y: 0, opacity: 1, scale: 1 } : { y: 50, opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 80, damping: 20 }}
        className="w-full flex-1 max-h-[35%] my-4 bg-card rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-card-border relative overflow-hidden flex flex-col items-center"
      >
        <motion.img 
          src={`${import.meta.env.BASE_URL}diagnostico-real.jpg`}
          alt="Diagnóstico Real"
          className="w-full h-full object-contain bg-black/50"
          initial={{ scale: 1.0, y: "0%" }}
          animate={{
            scale: phase >= 1 ? 1.05 : 1.0,
            y: "0%",
          }}
          transition={{ duration: 11, ease: "linear" }}
        />
      </motion.div>

      <div className="w-full shrink-0 flex flex-col gap-3 z-10 pb-4">
        {/* Insight Highlight Label */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          className="w-full bg-card/95 backdrop-blur-xl px-5 py-4 rounded-xl shadow-2xl border border-card-border"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            </div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Diagnóstico</div>
          </div>
          <div className="text-xl font-bold leading-tight">Leitura Anômala Detectada</div>
          <div className="text-sm text-muted-foreground mt-1">Variação térmica fora do padrão.</div>
        </motion.div>

        {/* Recommendation Highlight Label */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={phase >= 3 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          className="w-full bg-primary/95 backdrop-blur-xl text-primary-foreground px-5 py-4 rounded-xl shadow-2xl border border-primary-foreground/20"
        >
          <div className="text-xs uppercase tracking-widest opacity-90 mb-2 font-bold flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Ação Sugerida
          </div>
          <div className="text-xl font-bold leading-tight">Repetir Coleta</div>
          <div className="text-sm opacity-90 mt-1">Aguardar estabilização térmica.</div>
        </motion.div>

        {/* Technical Report Line */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full mt-2 text-center"
        >
          <div className="inline-flex items-start text-left gap-3 bg-blue-500/10 text-blue-300 px-5 py-4 rounded-xl border border-blue-500/20 shadow-2xl backdrop-blur-sm">
            <svg className="w-6 h-6 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="font-semibold text-base leading-snug">Gere um relatório técnico de registro para cada leitura, em Word.</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
