'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export function AdBlockerWarning() {
  const [adBlockerDetected, setAdBlockerDetected] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Multiple detection methods for better accuracy
    const detectAdBlocker = async () => {
      let isBlocked = false;

      // Method 1: Try to make a request to Google Analytics (commonly blocked)
      try {
        const testImg = new Image();
        testImg.src = 'https://www.google-analytics.com/analytics.js?' + Math.random();
        testImg.onerror = () => {
          isBlocked = true;
        };
      } catch (e) {
        isBlocked = true;
      }

      // Method 2: Check for common ad blocker patterns
      const testElement = document.createElement('div');
      testElement.innerHTML = '&nbsp;';
      testElement.className = 'adsbox';
      document.body.appendChild(testElement);
      
      setTimeout(() => {
        if (testElement.offsetHeight === 0) {
          isBlocked = true;
        }
        document.body.removeChild(testElement);
        
        // Method 3: Try to detect if Firestore requests might be blocked
        const firestoreTest = document.createElement('script');
        firestoreTest.src = 'https://www.gstatic.com/firebasejs/dummy.js';
        firestoreTest.onerror = () => {
          isBlocked = true;
        };
        document.head.appendChild(firestoreTest);
        
        setTimeout(() => {
          document.head.removeChild(firestoreTest);
          
          // Check localStorage for previous dismissal
          const wasDismissed = localStorage.getItem('adBlockerWarningDismissed');
          if (isBlocked && !wasDismissed) {
            setAdBlockerDetected(true);
          }
        }, 100);
      }, 100);
    };

    // Small delay to ensure DOM is ready
    setTimeout(detectAdBlocker, 1000);
  }, []);

  const handleDismiss = () => {
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
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-900/90 backdrop-blur-sm border-b border-red-700">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-300 flex-shrink-0" />
            <div>
              <h4 className="text-red-100 font-medium text-sm">Ad Blocker Detected</h4>
              <p className="text-red-200 text-xs">
                This app uses Firebase/Firestore which may be blocked by ad blockers. 
                Please disable your ad blocker or whitelist this site for full functionality.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-red-300 hover:text-red-100 p-1 rounded transition-colors flex-shrink-0"
            aria-label="Dismiss warning"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}