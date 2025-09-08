import { cn } from '@/lib/utils';
import React, { useState } from 'react';
import { motion } from 'motion/react';

interface StatefulButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
}

export const StatefulButton = React.forwardRef<
  HTMLButtonElement,
  StatefulButtonProps
>(({ className, children, onClick, ...props }, ref) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (loading || success || !onClick) return;

    setLoading(true);
    try {
      await onClick(e);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
      }, 2000);
    } catch (err) {
      // Handle error if needed
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      ref={ref}
      className={cn(
        'relative flex h-12 overflow-hidden rounded-full p-[1px] focus:outline-none m-0 border-0 outline-0',
        className
      )}
      onClick={handleClick}
      {...props}
    >
      <span className='absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]' />
      <span className='inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 px-8 py-1 text-sm font-medium text-white backdrop-blur-3xl'>
        {loading ? (
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className='flex items-center gap-1'
          >
            <svg
              className='h-4 w-4 animate-spin'
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
            >
              <circle
                className='opacity-25'
                cx='12'
                cy='12'
                r='10'
                stroke='currentColor'
                strokeWidth='4'
              />
              <path
                className='opacity-75'
                fill='currentColor'
                d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
              />
            </svg>
            Processing...
          </motion.span>
        ) : success ? (
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className='flex items-center gap-1'
          >
            <svg
              className='h-4 w-4'
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M5 13l4 4L19 7'
              />
            </svg>
            Welcome!
          </motion.span>
        ) : (
          children
        )}
      </span>
    </button>
  );
});
