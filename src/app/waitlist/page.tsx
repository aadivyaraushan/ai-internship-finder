'use client';

import { TextHoverEffect } from "@/components/ui/TextHover";
import { addWaitlistEmail } from "@/lib/firestoreHelpers";
import { CornerDownLeft } from "lucide-react";
import React, { useEffect, useState } from "react";

export default function WaitlistPage() {
    const [email, setEmail] = useState('');
    const [showEmail, setShowEmail] = useState(false);
    const [showOTP, setShowOTP] = useState(false);
    const [OTP, setOTP] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            waitlist(email);
        }
    };

    const handleKeyDownOTP = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            otp_check();
        }
    };

    const waitlist = async (email: string) => {
        setLoading(true);
        setError('');
        
        try {
            const response = await fetch('/api/otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email })
            });
            
            if (response.ok) {
                setShowOTP(true);
                setOTP('');
            } else {
                const data = await response.json().catch(() => ({}));
                // Handle duplicate waitlist email (409)
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

    const otp_check = async () => {
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
                body: JSON.stringify({ email, otp: OTP })
            });

            const data = await response.json();

            if (response.ok && data.verified) {
                // OTP verified successfully, add to waitlist
                await addWaitlistEmail(email);
                // Show success message
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
        // Set page title
        document.title = 'Waitlist | Refr';
        
        const timer = setTimeout(() => {
            setShowEmail(true);
        }, 800);
        return () => clearTimeout(timer);
    }, []);

    return (
        (!showOTP ? 
        <div className="h-screen relative flex flex-col items-center justify-center bg-neutral-900 margin px-8 ">
            <TextHoverEffect text="WAITLIST" />
            <div className='absolute w-screen px-64'>
                <div className={`relative transition-opacity duration-300 transform ${showEmail ? 'opacity-100' : 'opacity-0'}`}>
                    <input
                        type='text'
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder='email@gmail.com...'
                        className='w-full px-6 py-4 bg-[#1a1a1a] border border-gray-700 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-lg'
                    />
                    <button
                        onClick={() => waitlist(email)}
                        disabled={loading}
                        className='absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white p-3 rounded-xl transition-colors'
                    >
                        <CornerDownLeft className='h-5 w-5'/>
                    </button>
                    {error && <p className='text-red-500 text-sm mt-2'>{error}</p>}
                </div>
            </div>
        </div>
        :
        <div className="h-screen relative flex flex-col items-center justify-center bg-neutral-900 margin px-8 ">
            <TextHoverEffect text="OTP" />
            <div className='absolute w-screen px-64'>
                <div className={`relative transition-opacity duration-300 transform ${showEmail ? 'opacity-100' : 'opacity-0'}`}>
                    <input
                        type='text'
                        value={OTP}
                        onChange={(e) => setOTP(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        onKeyDown={handleKeyDownOTP}
                        placeholder='XXXX'
                        maxLength={4}
                        className='w-full px-6 py-4 bg-[#1a1a1a] border border-gray-700 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-lg'
                    />
                    <button
                        onClick={() => otp_check()}
                        disabled={loading}
                        className='absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white p-3 rounded-xl transition-colors'
                    >
                        <CornerDownLeft className='h-5 w-5'/>
                    </button>
                    {error && <p className='text-red-500 text-sm mt-2'>{error}</p>}
                </div>
            </div>
        </div>  
    
    )
        
    )
}