'use client';

import { TextHoverEffect } from "@/components/ui/TextHover";
import { CornerDownLeft, Search } from "lucide-react";
import { useEffect, useState } from "react";

export default function WaitlistPage() {
    const [searchGoal, setSearchGoal] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            waitlist();
        }
    };

    const waitlist = async () => {
        console.log('waitlist entered!')
    }

    const [showEmail, setShowEmail] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowEmail(true);
        }, 800);
        return () => clearTimeout(timer);
    }, [])

    return (
        <div className="h-screen relative flex flex-col items-center justify-center bg-neutral-900 margin px-8 ">
            <TextHoverEffect text="WAITLIST" />
            <div className='absolute w-screen px-64'>
                <div className={`relative transition-opacity duration-300 transform ${showEmail ? 'opacity-100' : 'opacity-0'}`}>
                    <input
                        type='text'
                        value={searchGoal}
                        onChange={(e) => setSearchGoal(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder='email@gmail.com...'
                        className='w-full px-6 py-4 bg-[#1a1a1a] border border-gray-700 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-lg'
                    />
                    <button
                        onClick={waitlist}
                        className='absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white p-3 rounded-xl transition-colors'
                    >
                        <CornerDownLeft className='h-5 w-5'/>
                    </button>
                </div>
            </div>
        </div>
    )
}