import { motion } from 'framer-motion';

// Mount-only transition (see App.jsx for why this isn't paired with
// AnimatePresence for an exit animation).
export function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
