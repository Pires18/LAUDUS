import { motion } from 'framer-motion';
import { classNames } from '../utils/format';

interface SkeletonProps {
  className?: string;
  count?: number;
}

export function Skeleton({ className, count = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0.5 }}
          animate={{ 
            opacity: [0.5, 0.8, 0.5],
            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"]
          }}
          transition={{ 
            duration: 2, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className={classNames(
            "bg-gradient-to-r from-ink-100 via-ink-50 to-ink-100 bg-[length:200%_auto] rounded-xl", 
            className
          )}
          style={{
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}
        />
      ))}
    </>
  );
}

export function CardSkeleton() {
  return (
    <div className="card p-6 space-y-6 bg-white/50 backdrop-blur-sm border-white/20 shadow-premium">
      <div className="flex items-center gap-4">
        <Skeleton className="w-14 h-14 rounded-2xl shadow-sm" />
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-4.5 w-1/2 rounded-lg" />
          <Skeleton className="h-3.5 w-1/3 rounded-lg opacity-60" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-full rounded-lg" />
        <Skeleton className="h-3 w-3/4 rounded-lg" />
        <Skeleton className="h-3 w-1/2 rounded-lg opacity-40" />
      </div>
      <div className="pt-2 flex gap-3">
         <Skeleton className="h-9 w-24 rounded-xl" />
         <Skeleton className="h-9 w-24 rounded-xl opacity-50" />
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5 flex items-center gap-5 bg-white/40 border-white/10 shadow-sm">
          <Skeleton className="w-11 h-11 rounded-2xl shadow-inner" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-4 w-1/3 rounded-lg" />
            <Skeleton className="h-3 w-1/2 rounded-lg opacity-50" />
          </div>
          <div className="hidden sm:flex gap-2">
             <Skeleton className="h-8 w-8 rounded-xl" />
             <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
