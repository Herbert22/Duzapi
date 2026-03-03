import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingProps {
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  text?: string;
}

export function Loading({ className, size = 'default', text }: LoadingProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    default: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      <Loader2 className={cn('animate-spin text-violet-500', sizeClasses[size])} />
      {text && <span className="text-slate-400 text-sm">{text}</span>}
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <Loading size="lg" text="Carregando..." />
    </div>
  );
}
