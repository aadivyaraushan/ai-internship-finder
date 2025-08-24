'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { analytics } from '@/lib/analytics';

export function AdBlockerWarning() {
  const [adBlockerDetected, setAdBlockerDetected] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Multiple detection methods for better accuracy
    const detectAdBlocker = async () => {
      let detectionResults = {
        gaBlocked: false,
        elementBlocked: false,
        firebaseBlocked: false
      };

      // Method 1: Try to make a request to Google Analytics (commonly blocked)
      const testGoogleAnalytics = () => {
        return new Promise<boolean>((resolve) => {
          const testImg = new Image();
          testImg.onload = () => resolve(false);
          testImg.onerror = () => resolve(true);
          testImg.src = 'https://www.google-analytics.com/analytics.js?' + Math.random();
          // Timeout to avoid hanging
          setTimeout(() => resolve(false), 3000);
        });
      };

      // Method 2: Check for common ad blocker patterns
      const testElementBlocking = () => {
        return new Promise<boolean>((resolve) => {
          const testElement = document.createElement('div');
          testElement.innerHTML = '&nbsp;';
          testElement.className = 'adsbox';
          testElement.style.position = 'absolute';
          testElement.style.left = '-9999px';
          document.body.appendChild(testElement);

          setTimeout(() => {
            const isBlocked = testElement.offsetHeight === 0 || testElement.offsetWidth === 0;
            document.body.removeChild(testElement);
            resolve(isBlocked);
          }, 100);
        });
      };

      // Method 3: Try to detect if Firebase requests might be blocked
      const testFirebaseAccess = () => {
        return new Promise<boolean>((resolve) => {
          const firestoreTest = document.createElement('script');
          firestoreTest.onload = () => resolve(false);
          firestoreTest.onerror = () => resolve(true);
          firestoreTest.src = 'https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js';
          document.head.appendChild(firestoreTest);
          
          // Timeout and cleanup
          setTimeout(() => {
            document.head.removeChild(firestoreTest);
            resolve(false);
          }, 3000);
        });
      };

      // Run all tests
      try {
        detectionResults.gaBlocked = await testGoogleAnalytics();
        detectionResults.elementBlocked = await testElementBlocking();
        detectionResults.firebaseBlocked = await testFirebaseAccess();
      } catch (error) {
        console.log('Ad blocker detection error:', error);
        return;
      }

      // Only show warning if at least 2 out of 3 methods detect blocking
      const blockingCount = Object.values(detectionResults).filter(Boolean).length;
      const isBlocked = blockingCount >= 2;

      // Check localStorage for previous dismissal
      const wasDismissed = localStorage.getItem('adBlockerWarningDismissed');
      const dismissTime = wasDismissed ? parseInt(wasDismissed) : 0;
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      if (isBlocked && (!wasDismissed || dismissTime < oneHourAgo)) {
        analytics.trackAdBlockerDetected();
        setAdBlockerDetected(true);
      }
    };

    // Small delay to ensure DOM is ready
    setTimeout(detectAdBlocker, 1000);
  }, []);

  const handleDismiss = () => {
    analytics.trackAdBlockerWarningDismissed();
    setDismissed(true);
    setAdBlockerDetected(false);
    // Remember dismissal for 1 hour
    localStorage.setItem('adBlockerWarningDismissed', Date.now().toString());

    // Clear dismissal after 1 hour
    setTimeout(() => {
      localStorage.removeItem('adBlockerWarningDismissed');
    }, 60 * 60 * 1000);
  };

  if (!adBlockerDetected || dismissed) {
    return null;
  }

  return (
    <div className='fixed top-0 left-0 right-0 z-50 bg-red-900/90 backdrop-blur-sm border-b border-red-700'>
      <div className='max-w-7xl mx-auto px-4 py-3'>
        <div className='flex items-center justify-between gap-4'>
          <div className='flex items-center gap-3'>
            <AlertTriangle className='w-5 h-5 text-red-300 flex-shrink-0' />
            <div>
              <h4 className='text-red-100 font-medium text-sm'>
                Ad Blocker Detected
              </h4>
              <p className='text-red-200 text-xs'>
                This app uses Firebase/Firestore which may be blocked by ad
                blockers. Please disable your ad blocker or whitelist this site
                for it to work properly.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className='text-red-300 hover:text-red-100 p-1 rounded transition-colors flex-shrink-0'
            aria-label='Dismiss warning'
          >
            <X className='w-4 h-4' />
          </button>
        </div>
      </div>
    </div>
  );
}
