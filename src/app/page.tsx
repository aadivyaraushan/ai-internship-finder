'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Just redirect immediately to dashboard
    // Dashboard will handle all auth logic
    router.push('/dashboard');
  }, [router]);

  return (
    <div className='flex items-center justify-center min-h-screen bg-neutral-950'>
      <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-white'></div>
    </div>
  );
}
