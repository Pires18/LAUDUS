import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface Props {
  children: ReactNode;
  id: string;
}

export function PageTransition({ children, id }: Props) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="flex-1 flex flex-col min-h-0 min-h-full w-full relative"
    >
      {children}
    </motion.div>
  );
}
