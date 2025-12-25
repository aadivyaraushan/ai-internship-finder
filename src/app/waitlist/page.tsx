'use client';

import { TextHoverEffect } from '@/components/ui/TextHover';
import { addWaitlistEmail } from '@/lib/firestoreHelpers';
import { CornerDownLeft } from 'lucide-react';
import React, { useEffect, useState } from 'react';

// Modular components
interface InputFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  type?: 'email' | 'otp';
  loading: boolean;
  error: string;
}

const InputForm = ({
  value,
  onChange,
  onSubmit,
  placeholder,
  type = 'email',
  loading,
  error,
}: InputFormProps) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSubmit();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue =
      type === 'otp'
        ? e.target.value.replace(/\D/g, '').slice(0, 4)
        : e.target.value;
    onChange(newValue);
  };

  return (
    <div className='relative'>
      <input
        type='text'
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={type === 'otp' ? 4 : undefined}
        className='w-full px-4 sm:px-6 py-3 sm:py-4 pr-14 sm:pr-16 bg-[#1a1a1a] border border-gray-700 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-base sm:text-lg'
      />
      <button
        onClick={onSubmit}
        disabled={loading}
        className='absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white p-2.5 sm:p-3 rounded-xl transition-colors'
      >
        <CornerDownLeft className='h-4 w-4 sm:h-5 sm:w-5' />
      </button>
      {error && (
        <p className='text-red-500 text-xs sm:text-sm mt-2 px-1'>{error}</p>
      )}
    </div>
  );
};

interface WaitlistScreenProps {
  title: string;
  visible: boolean;
  children: React.ReactNode;
}

const WaitlistScreen = ({ title, visible, children }: WaitlistScreenProps) => (
  <div className='min-h-[100dvh] h-[100dvh] w-full relative flex flex-col items-center justify-center bg-neutral-900 px-4 sm:px-8 overflow-hidden'>
    <div className='h-[20rem] sm:h-[40rem] w-full flex items-center justify-center select-none'>
      <TextHoverEffect text={title} />
    </div>
    <div className='absolute inset-0 flex items-center justify-center px-4 sm:px-8 pointer-events-none'>
      <div
        className={`w-full max-w-md sm:max-w-2xl transition-opacity duration-300 transform ${
          visible ? 'opacity-100' : 'opacity-0'
        } pointer-events-auto`}
      >
        {children}
      </div>
    </div>
  </div>
);

// Main component
export default function WaitlistPage() {
  const [email, setEmail] = useState('');
  const [showContent, setShowContent] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [OTP, setOTP] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setShowOTP(true);
        setOTP('');
      } else {
        const data = await response.json().catch(() => ({}));
        if (response.status === 409) {
          setError(data.error || 'This email is already on the waitlist.');
        } else {
          setError(data.error || 'Failed to send OTP. Please try again.');
        }
      }
    } catch (err) {
      setError('Error sending OTP. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSubmit = async () => {
    if (OTP.length !== 4) {
      setError('OTP must be 4 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/otp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: OTP }),
      });

      const data = await response.json();

      if (response.ok && data.verified) {
        await addWaitlistEmail(email);
        setShowOTP(false);
        setEmail('');
        setError('');
        alert('Successfully added to waitlist!');
      } else {
        setError(data.error || 'Invalid OTP. Please try again.');
      }
    } catch (err) {
      setError('Error verifying OTP. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Waitlist | Refr';
    const timer = setTimeout(() => setShowContent(true), 800);
    return () => clearTimeout(timer);
  }, []);

  return showOTP ? (
    <WaitlistScreen title='OTP' visible={showContent}>
      <InputForm
        value={OTP}
        onChange={setOTP}
        onSubmit={handleOTPSubmit}
        placeholder='XXXX'
        type='otp'
        loading={loading}
        error={error}
      />
    </WaitlistScreen>
  ) : (
    <WaitlistScreen title='WAITLIST' visible={showContent}>
      <InputForm
        value={email}
        onChange={setEmail}
        onSubmit={handleEmailSubmit}
        placeholder='email@gmail.com...'
        type='email'
        loading={loading}
        error={error}
      />
    </WaitlistScreen>
  );
}
