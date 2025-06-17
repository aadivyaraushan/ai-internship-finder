'use client'

import { useRouter } from "next/navigation";

export default function LandingPage() {
    const router = useRouter();

    return (
        <div className="relative flex size-full min-h-screen flex-col bg-[#111418] dark group/design-root overflow-x-hidden"
            style={{ fontFamily: '"Spline Sans", "Noto Sans", sans-serif' }}>
            <div className="layout-container flex h-full grow flex-col">
                <header
                    className="flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#283039] px-10 py-3">
                    <div className="flex items-center gap-4 text-white">
                        <div className="size-4">
                            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M24 45.8096C19.6865 45.8096 15.4698 44.5305 11.8832 42.134C8.29667 39.7376 5.50128 36.3314 3.85056 32.3462C2.19985 28.361 1.76794 23.9758 2.60947 19.7452C3.451 15.5145 5.52816 11.6284 8.57829 8.5783C11.6284 5.52817 15.5145 3.45101 19.7452 2.60948C23.9758 1.76795 28.361 2.19986 32.3462 3.85057C36.3314 5.50129 39.7376 8.29668 42.134 11.8833C44.5305 15.4698 45.8096 19.6865 45.8096 24L24 24L24 45.8096Z"
                                    fill="currentColor"></path>
                            </svg>
                        </div>
                        <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">Refr 🍵</h2>
                    </div>
                    <div className="flex flex-1 justify-end gap-8">
                        <div className="flex items-center gap-9">
                            <a className="text-white text-sm font-medium leading-normal" href="#">How it Works</a>
                            <a className="text-white text-sm font-medium leading-normal" href="#">Features</a>
                            <a className="text-white text-sm font-medium leading-normal" href="#">Support</a>
                        </div>
                        <div className="flex gap-2">
                            <button
                                className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 bg-[#2a88ed] text-white text-sm font-bold leading-normal tracking-[0.015em]"
                                onClick={() => {
                                    router.push('/signup');
                                }}>
                                <span className="truncate">Register</span>
                            </button>
                            <button
                                className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 bg-[#283039] text-white text-sm font-bold leading-normal tracking-[0.015em]" 
                                onClick={() => {
                                    router.push('/login');
                                }}>
                                <span className="truncate">Sign in</span>
                            </button>
                        </div>
                    </div>
                </header>
                <div className="px-40 flex flex-1 justify-center py-5">
                    <div className="layout-content-container flex flex-col max-w-[960px] flex-1">
                        <div className="@container">
                            <div className="@[480px]:p-4">
                                <div className="flex min-h-[480px] flex-col gap-6 bg-cover bg-center bg-no-repeat @[480px]:gap-8 @[480px]:rounded-xl items-start justify-end px-4 pb-10 @[480px]:px-10"
                                    style={{ backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.4) 100%), url("https://lh3.googleusercontent.com/aida-public/AB6AXuBsFQUe8YRo2cA0Wue2lJ6T85B9sJckRhiYnvi8ATcPWL4VVUZfJkBvfi4S_CSPkaR7FcJ3Sj9ReZRMS7IwL4YMSRbWdXmABtv5J0pftCyirf-NWMEqbAq24ID4BNQGE2VNz1qMhVjARYbmTFktWrdrxxeczL970Oek7U0cbWQXVURDjoQ2zqe1Fjqji2gfPNDaFMy1rfwoT9fB905j951cp8lqM78f0DlWYiP2SEkEU1bjSqYR1kCR5jOCD9VHk1UAPC_yyiHzNK0")' }}>
                                    <div className="flex flex-col gap-2 text-left">
                                        <h1
                                            className="text-white text-4xl font-black leading-tight tracking-[-0.033em] @[480px]:text-5xl @[480px]:font-black @[480px]:leading-tight @[480px]:tracking-[-0.033em]">
                                            Discover Connections You Never Expected
                                        </h1>
                                        <h2
                                            className="text-white text-sm font-normal leading-normal @[480px]:text-base @[480px]:font-normal @[480px]:leading-normal">
                                            Refr uses advanced AI to match you with people you might not have met but share
                                            deep interests. Expand your network and find meaningful connections.
                                        </h2>
                                    </div>
                                    <button
                                        className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 @[480px]:h-12 @[480px]:px-5 bg-[#2a88ed] text-white text-sm font-bold leading-normal tracking-[0.015em] @[480px]:text-base @[480px]:font-bold @[480px]:leading-normal @[480px]:tracking-[0.015em]">
                                        <span className="truncate">Get Started</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-10 px-4 py-10 @container">
                            <div className="flex flex-col gap-4">
                                <h1
                                    className="text-white tracking-light text-[32px] font-bold leading-tight @[480px]:text-4xl @[480px]:font-black @[480px]:leading-tight @[480px]:tracking-[-0.033em] max-w-[720px]">
                                    Refr Features
                                </h1>
                                <p className="text-white text-base font-normal leading-normal max-w-[720px]">
                                    Refr offers a unique approach to networking, focusing on quality connections based on
                                    shared interests and AI-driven insights.
                                </p>
                            </div>
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(158px,1fr))] gap-3 p-0">
                                <div className="flex flex-1 gap-3 rounded-lg border border-[#3b4754] bg-[#1c2127] p-4 flex-col">
                                    <div className="text-white" data-icon="Users" data-size="24px" data-weight="regular">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px"
                                            fill="currentColor" viewBox="0 0 256 256">
                                            <path
                                                d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z">
                                            </path>
                                        </svg>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <h2 className="text-white text-base font-bold leading-tight">AI-Powered Matching</h2>
                                        <p className="text-[#9daab9] text-sm font-normal leading-normal">
                                            Our AI algorithms analyze your interests and preferences to suggest potential
                                            connections you might not find otherwise.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-1 gap-3 rounded-lg border border-[#3b4754] bg-[#1c2127] p-4 flex-col">
                                    <div className="text-white" data-icon="Heart" data-size="24px" data-weight="regular">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px"
                                            fill="currentColor" viewBox="0 0 256 256">
                                            <path
                                                d="M178,32c-20.65,0-38.73,8.88-50,23.89C116.73,40.88,98.65,32,78,32A62.07,62.07,0,0,0,16,94c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,220.66,240,164,240,94A62.07,62.07,0,0,0,178,32ZM128,206.8C109.74,196.16,32,147.69,32,94A46.06,46.06,0,0,1,78,48c19.45,0,35.78,10.36,42.6,27a8,8,0,0,0,14.8,0c6.82-16.67,23.15-27,42.6-27a46.06,46.06,0,0,1,46,46C224,147.61,146.24,196.15,128,206.8Z">
                                            </path>
                                        </svg>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <h2 className="text-white text-base font-bold leading-tight">Discover Hidden Connections
                                        </h2>
                                        <p className="text-[#9daab9] text-sm font-normal leading-normal">
                                            Connect with individuals who share your passions but are outside your usual
                                            circles, expanding your horizons.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-1 gap-3 rounded-lg border border-[#3b4754] bg-[#1c2127] p-4 flex-col">
                                    <div className="text-white" data-icon="Robot" data-size="24px" data-weight="regular">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px"
                                            fill="currentColor" viewBox="0 0 256 256">
                                            <path
                                                d="M200,48H136V16a8,8,0,0,0-16,0V48H56A32,32,0,0,0,24,80V192a32,32,0,0,0,32,32H200a32,32,0,0,0,32-32V80A32,32,0,0,0,200,48Zm16,144a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V80A16,16,0,0,1,56,64H200a16,16,0,0,1,16,16Zm-52-56H92a28,28,0,0,0,0,56h72a28,28,0,0,0,0-56Zm-28,16v24H120V152ZM80,164a12,12,0,0,1,12-12h12v24H92A12,12,0,0,1,80,164Zm84,12H152V152h12a12,12,0,0,1,0,24ZM72,108a12,12,0,1,1,12,12A12,12,0,0,1,72,108Zm88,0a12,12,0,1,1,12,12A12,12,0,0,1,160,108Z">
                                            </path>
                                        </svg>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <h2 className="text-white text-base font-bold leading-tight">Meaningful Interactions
                                        </h2>
                                        <p className="text-[#9daab9] text-sm font-normal leading-normal">
                                            Engage in conversations that matter, building relationships based on genuine
                                            shared interests and mutual respect.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-10 px-4 py-10 @container">
                            <div className="flex flex-col gap-4">
                                <h1
                                    className="text-white tracking-light text-[32px] font-bold leading-tight @[480px]:text-4xl @[480px]:font-black @[480px]:leading-tight @[480px]:tracking-[-0.033em] max-w-[720px]">
                                    How Refr Works
                                </h1>
                                <p className="text-white text-base font-normal leading-normal max-w-[720px]">
                                    Refr simplifies the process of finding and connecting with like-minded individuals,
                                    ensuring every interaction is valuable.
                                </p>
                            </div>
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(158px,1fr))] gap-3">
                                <div className="flex flex-col gap-3 pb-3">
                                    <div className="w-full bg-center bg-no-repeat aspect-video bg-cover rounded-xl"
                                        style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAsEDnFz8Agzq7lF2EaueDke_Boff3nmzo1OdI6z9QTrQEiEEFdhQICIGvrxnvcI6_2xNXuckzeRzfgse54oXLu5PiAZaHrE-TVs2Yti98mHRrNAGYwEtt0wzTD3EMM2HO6ooEwoU4-Qcyf1fR1xwjuhax8IvbR_Y4RcnAabNXODRN_wpAnddiM5RZtV72SqVCt1aEbRH9EWCCZdK9144aQ-pWl9X7RljZCmxLdIpQJRGq6LIhDSUh7sB8BRDa4aaOmR9ZBzDVm7Wg")' }}>
                                    </div>
                                    <div>
                                        <p className="text-white text-base font-medium leading-normal">Profile Analysis</p>
                                        <p className="text-[#9daab9] text-sm font-normal leading-normal">
                                            We analyze your profile, interests, and activity to understand your preferences
                                            and identify potential connections.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3 pb-3">
                                    <div className="w-full bg-center bg-no-repeat aspect-video bg-cover rounded-xl"
                                        style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAI3J1XsDFd_JUKQ5dixpSWweYzWgQRabpBsIHkkbOGHXNoA7EqhoUv6AeiyDWWhaCU1h0i4CW8skq2HYAEr49ZEejNx5AbB-9DhlvLMYK99FbIJs2P-w6yLsgkJGIWIE8mRNWA5JMqZc2ziWRqN3XqBg-eOQvaZcpz84-ktVDZJEBVAOj2WJjlTjhGcqPHh3rZenjGK_lyn48-JqF314pNmAY3vVhLoawZYgpoUNwkJJkSM8xmWeSmUwMzLGB0grBiMSdLG4o7XpY")' }}>
                                    </div>
                                    <div>
                                        <p className="text-white text-base font-medium leading-normal">Intelligent Matching</p>
                                        <p className="text-[#9daab9] text-sm font-normal leading-normal">
                                            Our AI matches you with individuals who share your passions, ensuring a higher
                                            likelihood of meaningful interactions.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3 pb-3">
                                    <div className="w-full bg-center bg-no-repeat aspect-video bg-cover rounded-xl"
                                        style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAQFJmOpTBYw1glivi9IVHLOIhYyStpQ1eW1ZfeBdZbwKXPch8dfQ0VWG10t3iYzwoVL8Xa-YNco_aM37PRPWhDyTnG5c-7JxGGoUtmmM5XnoRd9ohnT4211Df7MGc3bm1brRmKF03hhMCoTdk29DFV2zqjEGu2cY1YXTBd3n84m5cMPxG3e9sSxsp-H2-AxkxLfbB_nPTlp2IlucBQYd0AhRTqC5iNBOAGdpkiLm6anFp2453CZmDlD8VwJu1NoYxr8v2wFWzr1a8")' }}>
                                    </div>
                                    <div>
                                        <p className="text-white text-base font-medium leading-normal">Seamless Communication
                                        </p>
                                        <p className="text-[#9daab9] text-sm font-normal leading-normal">
                                            Refr provides tools for easy and effective communication, helping you build
                                            relationships effortlessly.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <footer className="flex justify-center">
                    <div className="flex max-w-[960px] flex-1 flex-col">
                        <footer className="flex flex-col gap-6 px-5 py-10 text-center @container">
                            <div
                                className="flex flex-wrap items-center justify-center gap-6 @[480px]:flex-row @[480px]:justify-around">
                                <a className="text-[#9daab9] text-base font-normal leading-normal min-w-40" href="#">How it
                                    Works</a>
                                <a className="text-[#9daab9] text-base font-normal leading-normal min-w-40"
                                    href="#">Features</a>
                                <a className="text-[#9daab9] text-base font-normal leading-normal min-w-40" href="#">Pricing</a>
                                <a className="text-[#9daab9] text-base font-normal leading-normal min-w-40" href="#">Support</a>
                                <a className="text-[#9daab9] text-base font-normal leading-normal min-w-40" href="#">Contact
                                    Sales</a>
                            </div>
                            <p className="text-[#9daab9] text-base font-normal leading-normal">© 2023 Refr. All rights reserved.
                            </p>
                        </footer>
                    </div>
                </footer>
            </div>
        </div>
    );
}