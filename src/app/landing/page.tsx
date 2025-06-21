'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const GraphAnimation = dynamic(() => import('@/components/GraphAnimation'), {
  ssr: false,
});

const LandingPage = () => {
  const [scrollZ, setScrollZ] = useState(10);
  const [titleOpacity, setTitleOpacity] = useState(1);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      // Convert wheel delta to scroll Z position
      const delta = event.deltaY * 0.025;
      const newScrollZ = Math.max(10, Math.min(500, scrollZ + delta));
      setScrollZ(newScrollZ);
      console.log(newScrollZ);
      // Calculate title opacity based on scroll Z
      const fadeStart = 20;
      const fadeEnd = 50;
      const opacity = Math.max(0, Math.min(1, 1 - (newScrollZ - fadeStart) / (fadeEnd - fadeStart)));
      setTitleOpacity(opacity);
    };

    window.addEventListener('wheel', handleWheel);
    return () => window.removeEventListener('wheel', handleWheel);
  }, [scrollZ]);

  return (
    <>
      <GraphAnimation />
      <div className="relative z-10 flex flex-col min-h-screen text-white">
        <header className="py-6 px-8 flex justify-between items-center transition-opacity duration-300" style={{ opacity: titleOpacity }}>
          <h1 className="text-3xl font-bold">AI Internship Finder</h1>
          <nav>
            <Link href="/login" className="text-lg hover:underline">
              Login
            </Link>
          </nav>
        </header>

        <main className="flex-grow flex flex-col items-center justify-center text-center px-4 transition-opacity duration-300" style={{ opacity: titleOpacity }}>
          <h2 className="text-5xl font-extrabold mb-4">Find Your Dream AI Internship</h2>
          <p className="text-xl mb-8 max-w-2xl">
            Our platform uses cutting-edge AI to analyze your resume and skills, matching you with the perfect internship opportunities from top companies.
          </p>
          <Link href="/signup" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition duration-300">
            Get Started for Free
          </Link>
        </main>

        <footer className="py-6 px-8 text-center text-gray-400 transition-opacity duration-300" style={{ opacity: titleOpacity }}>
          <p>&copy; 2024 AI Internship Finder. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;
