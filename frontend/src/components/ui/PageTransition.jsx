import { motion } from 'framer-motion';
import { useSettingsStore } from '../../state/useSettingsStore';

// Mount-only transition (see App.jsx for why this isn't paired with
// AnimatePresence for an exit animation). Disabled when the player turns off
// animations in settings — then the route mounts instantly.
export function PageTransition({ children }) {
  const animations = useSettingsStore((s) => s.animations);
  if (!animations) return <div>{children}</div>;
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
