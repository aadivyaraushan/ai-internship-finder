'use client';

import { TextHoverEffect } from "@/components/ui/TextHover";
import { addWaitlistEmail } from "@/lib/firestoreHelpers";
import { CornerDownLeft, Search } from "lucide-react";
import React, { useEffect, useState } from "react";
import sha256 from "sha256";

export default function WaitlistPage() {
    const [email, setEmail] = useState('');
    const [showEmail, setShowEmail] = useState(false);
    const [showOTP, setShowOTP] = useState(false);

    const [OTP, setOTP] = useState('');
    const [otpHash, setOtpHash] = useState('');



    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            waitlist(email);
        }
    };

    const handleKeyDownOTP = (e: React.KeyboardEvent) => {
        if (e.key == 'Enter')
        {
            otp_check()
        }
    };

    const waitlist = async (email: string) => {
        // console.log('waitlist entered!', email);

        const response = await fetch('/api/otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email
            })
        })
        if (response.ok)
        {
            setShowOTP(true);
            const body = await response.clone().json();

            setOtpHash(body.pin);
            console.log(body.pin);
        }


    }

    const otp_check = () => {
        if (sha256(OTP) == otpHash)
        {
            // we gotta add email to waitlist
            console.log(otpHash);
            addWaitlistEmail(email);
        }
    }


    useEffect(() => {
        // Set page title
        document.title = 'Waitlist | Refr';
        
        const timer = setTimeout(() => {
            setShowEmail(true);
        }, 800);
        return () => clearTimeout(timer);
    }, [])

    

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
                        className='absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white p-3 rounded-xl transition-colors'
                    >
                        <CornerDownLeft className='h-5 w-5'/>
                    </button>
                </div>
            </div>
        </div>
        :
        <div className="h-screen relative flex flex-col items-center justify-center bg-neutral-900 margin px-8 ">
            <TextHoverEffect text="OTP" />
            <div className='absolute w-screen px-64'>
                <div className={`relative transition-opacity duration-300 transform ${showEmail ? 'opacity-100' : 'opacity-0'}`}>
                    <input
                        type='number'
                        value={OTP}
                        onChange={(e) => setOTP(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder='XXXX'
                        className='w-full px-6 py-4 bg-[#1a1a1a] border border-gray-700 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-lg'
                    />
                    <button
                        onClick={() => otp_check()}
                        className='absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white p-3 rounded-xl transition-colors'
                    >
                        <CornerDownLeft className='h-5 w-5'/>
                    </button>
                </div>
            </div>
        </div>  
    
    )
        
    )
}