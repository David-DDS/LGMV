import { motion } from 'framer-motion';

export const Scene0 = ({ currentScene }: { currentScene: number }) => {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center text-center px-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Logo Reveal - Fixed Presentation */}
      <motion.div
        initial={{ y: 50, opacity: 0, scale: 0.8 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 1, type: "spring", stiffness: 100, damping: 20 }}
        className="w-48 h-24 mb-10 relative flex items-center justify-center bg-black rounded-2xl border border-card-border shadow-[0_0_40px_rgba(255,255,255,0.05)] overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-primary opacity-20 blur-2xl" />
        <img 
          src={`${import.meta.env.BASE_URL}images/xp-inc-clean.png`} 
          alt="XP Inc" 
          className="w-full h-full object-contain p-3 relative z-10"
        />
      </motion.div>

      {/* Title */}
      <div className="overflow-hidden mb-6">
        <motion.h1
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          transition={{ delay: 0.8, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl font-bold tracking-tight leading-tight"
        >
          Monitoramento <span className="text-gradient">VRF</span>
        </motion.h1>
      </div>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4, duration: 0.8, ease: "easeOut" }}
        className="text-xl text-muted-foreground max-w-sm"
      >
        <span className="text-primary font-medium">Criado por Hard Service / Facilities.</span>
      </motion.p>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 0.8, ease: "easeOut" }}
        className="text-lg text-muted-foreground/70 max-w-sm mt-4"
      >
        Para prevenir falhas severas e indisponibilidade nos escritórios XP.
      </motion.p>
    </motion.div>
  );
};
