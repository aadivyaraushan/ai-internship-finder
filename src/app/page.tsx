'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth } from '@/lib/firebase';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (checkAuth()) {
      router.push('/upload-resume');
    } else {
      router.push('/signup');
    }
  }, [router]);

  return null; // This page will redirect immediately
}
