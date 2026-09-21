import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export const Scene1 = ({ currentScene }: { currentScene: number }) => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-between py-12 px-8"
      initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, x: -50, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="text-center w-full z-20 shrink-0 mt-4">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="text-4xl font-bold mb-4 drop-shadow-lg"
        >
          Coleta de Dados
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="text-xl text-muted-foreground bg-background/80 backdrop-blur-md px-4 py-2 rounded-xl inline-block"
        >
          Anexe leituras atuais do LGMV e compare com o startup ou a referência LG.
        </motion.p>
      </div>

      {/* Real App Screenshot UI */}
      <motion.div
        initial={{ y: 60, opacity: 0, rotateX: 20 }}
        animate={{ y: 0, opacity: 1, rotateX: 0 }}
        transition={{ delay: 0.6, duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="w-full flex-1 max-h-[45%] my-6 bg-card rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-card-border overflow-hidden perspective-1000"
      >
        <motion.img 
          src={`${import.meta.env.BASE_URL}images/app-system.jpg`}
          alt="App System UI"
          className="w-full h-full object-contain bg-black/50"
          initial={{ scale: 1.0, y: "0%" }}
          animate={{
            scale: phase >= 2 ? 1.05 : 1.0,
            y: "0%"
          }}
          transition={{ duration: 2, ease: "easeInOut" }}
        />
      </motion.div>

      {/* Explanatory Label - Moved Below Image */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={phase >= 2 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: 20 }}
        transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
        className="w-full shrink-0 mb-4 bg-primary/95 text-primary-foreground backdrop-blur-md px-5 py-4 rounded-xl shadow-2xl border border-white/10 text-center"
      >
        <div className="text-xs uppercase tracking-widest opacity-80 mb-1">Entradas</div>
        <div className="font-bold text-lg leading-tight">Leituras LGMV + Startup original</div>
      </motion.div>
    </motion.div>
  );
};
