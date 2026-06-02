import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface Props {
  children: ReactNode;
  id: string;
  fullBleed?: boolean;
}

export function PageTransition({ children, id, fullBleed }: Props) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={
        fullBleed
          ? "flex-1 flex flex-col min-h-0 w-full relative"
          : "w-full relative"
      }
    >
      {children}
    </motion.div>
  );
}
