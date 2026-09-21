import { motion } from 'framer-motion';

export const Scene5 = ({ currentScene }: { currentScene: number }) => {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center text-center px-10"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="w-48 h-24 mb-10 relative flex items-center justify-center bg-black rounded-2xl border border-card-border shadow-[0_0_40px_rgba(255,255,255,0.05)] overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-primary opacity-20 blur-xl" />
        <img 
          src={`${import.meta.env.BASE_URL}images/xp-inc-clean.png`}
          alt="XP Inc" 
          className="w-full h-full object-contain p-3 relative z-10"
        />
      </motion.div>

      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="text-4xl font-bold mb-6"
      >
        Eficiência e conforto térmico.
      </motion.h2>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.8 }}
        className="text-xl text-muted-foreground max-w-sm"
      >
        Garantindo eficiência nos sistemas e conforto térmico aos colaboradores e clientes XP.
      </motion.p>
      
      {/* Loop indicator line */}
      <motion.div 
        className="absolute bottom-0 left-0 h-2 bg-primary glow-primary"
        initial={{ width: "0%" }}
        animate={{ width: "100%" }}
        transition={{ duration: 4, ease: "linear" }}
      />
    </motion.div>
  );
};
