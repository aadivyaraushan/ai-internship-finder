'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth } from '@/lib/firebase';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkAuthentication = async () => {
      const isAuthenticated = await checkAuth();
      if (isAuthenticated) {
        router.push('/upload-resume');
      } else {
        router.push('/signup');
      }
    };

    checkAuthentication();
  }, [router]);

  return null; // This page will redirect immediately
}
