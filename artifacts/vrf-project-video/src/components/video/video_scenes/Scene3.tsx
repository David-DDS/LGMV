import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export const Scene3 = ({ currentScene }: { currentScene: number }) => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-between py-12 px-8"
      initial={{ opacity: 0, rotateY: 90, perspective: 1000 }}
      animate={{ opacity: 1, rotateY: 0 }}
      exit={{ opacity: 0, scale: 1.2, filter: 'blur(10px)' }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full text-center shrink-0 mt-4 relative z-20">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-4xl font-bold mb-4 drop-shadow-md"
        >
          Diagnóstico Inteligente
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-lg text-muted-foreground bg-background/80 backdrop-blur-md px-4 py-2 rounded-xl inline-block shadow-lg"
        >
          Comparação paramétrica para avaliar a saúde do equipamento.
        </motion.p>
      </div>

      <motion.div
        initial={{ y: 50, opacity: 0, scale: 0.9 }}
        animate={phase >= 1 ? { y: 0, opacity: 1, scale: 1 } : { y: 50, opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 80, damping: 20 }}
        className="w-full flex-1 max-h-[45%] my-6 bg-card rounded-2xl shadow-2xl border border-card-border relative overflow-hidden flex flex-col items-center"
      >
        <motion.img 
          src={`${import.meta.env.BASE_URL}images/app-session.jpg`}
          alt="App Session Diagnostico"
          className="w-full h-full object-contain bg-black/50"
          initial={{ scale: 1.0, y: "0%" }}
          animate={{
            scale: phase >= 2 ? 1.05 : 1.0,
            y: "0%"
          }}
          transition={{ duration: 2, ease: "easeInOut" }}
        />
      </motion.div>

      {/* Disclaimer Note - Moved Below Image */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="w-full shrink-0 mb-4 bg-muted/95 backdrop-blur-md px-5 py-4 rounded-xl border border-border shadow-xl text-center"
      >
        <p className="text-[15px] text-foreground font-semibold leading-relaxed">
          Status de saúde operacional para orientar os próximos passos da manutenção.
        </p>
      </motion.div>
    </motion.div>
  );
};
