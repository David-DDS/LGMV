import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export const Scene2 = ({ currentScene }: { currentScene: number }) => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1000),
      setTimeout(() => setPhase(2), 2500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-between py-12 px-8"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full text-center shrink-0 mt-4 relative z-20">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="text-4xl font-bold mb-4 drop-shadow-md"
        >
          Baseline de Referência
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="text-lg text-muted-foreground bg-background/80 backdrop-blur-md px-4 py-2 rounded-xl inline-block shadow-lg"
        >
          Sem startup, a tabela LG é a referência.
        </motion.p>
      </div>

      <motion.div
        initial={{ y: 50, opacity: 0, rotateX: 45 }}
        animate={{ y: 0, opacity: 1, rotateX: 0 }}
        transition={{ delay: 0.8, duration: 1.2, type: "spring", stiffness: 80, damping: 20 }}
        className="w-full flex-1 max-h-[45%] my-6 relative perspective-1000"
      >
        <div className="absolute inset-0 bg-primary/20 blur-[50px] rounded-full scale-90" />
        
        <div className="relative w-full h-full rounded-xl overflow-hidden border border-card-border shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-card flex flex-col items-center justify-center">
          <motion.img 
            src={`${import.meta.env.BASE_URL}images/lg-reference-table.png`}
            alt="LG Reference Table"
            className="w-full h-full object-contain bg-black/50"
            initial={{ scale: 1.0 }}
            animate={phase >= 1 ? { scale: 1.05 } : { scale: 1.0 }}
            transition={{ duration: 3, ease: "easeOut" }}
          />
        </div>
      </motion.div>

      {/* Explanatory Label - Moved Below Image */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 1, type: "spring" }}
        className="w-full shrink-0 mb-4 bg-primary/20 border border-primary backdrop-blur-md px-5 py-4 rounded-xl shadow-2xl text-center"
      >
        <span className="text-white text-lg font-bold drop-shadow-md">Air-Cooled Multi V 5 (Cooling)</span>
      </motion.div>
    </motion.div>
  );
};
