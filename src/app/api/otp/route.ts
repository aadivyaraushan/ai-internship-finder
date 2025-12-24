import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { Resend } from 'resend'
import { html } from "./helpers/email"
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import '@/lib/firebase-admin'; // Initialize Firebase Admin first

// Initialize Firebase (firebase-admin.ts already initializes it, but we need db)
const apps = getApps();
if (!apps.length) {
  // This shouldn't happen if firebase-admin.ts is imported elsewhere
  // But keep for safety - let the error show if env vars are missing
  throw new Error('Firebase Admin not initialized');
}

const db = getFirestore();

import sha256 from "sha256";

const OTP_EXPIRY_MINUTES = 10;

// Generate a numeric OTP to avoid any punctuation characters
const generateOtp = (length = 4) => Array.from({ length }, () => randomInt(0, 10)).join("");

type ConnectionRequest = {
    email: string;
}

export async function POST(request: NextRequest) {
    const body: ConnectionRequest = await request.json();

    const {email} = body;

    // Prevent duplicate waitlist entries
    const waitlistRef = db.collection('waitlist').doc(email.trim().toLowerCase());
    const existingWaitlist = await waitlistRef.get();
    if (existingWaitlist.exists) {
        return NextResponse.json({error: 'Email already on waitlist'}, {status: 409});
    }

    const pin = generateOtp(4);
    console.log(pin);
    const html_format = html("" + pin);

    const resend = new Resend(process.env.RESEND_API_KEY);

    resend.emails.send({
        from: "RefrAI <otp@refrai.com>",
        to: [email],
        subject: "Your Refr OTP",
        html: html_format,
    });

    // Store OTP server-side with expiration
    const otpRef = db.collection('otps').doc(email);
    await otpRef.set({
        pin_hash: sha256(pin),
        created_at: new Date(),
        attempts: 0,
        expires_at: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
    }, { merge: true });

    return NextResponse.json({status: 'OTP sent'}, {status: 200});
}

type VerifyRequest = {
    email: string;
    otp: string;
}

export async function PUT(request: NextRequest) {
    const body: VerifyRequest = await request.json();
    const {email, otp} = body;

    try {
        const otpRef = db.collection('otps').doc(email);
        const otpDoc = await otpRef.get();
        
        // Check if OTP document exists
        if (!otpDoc.exists) {
            return NextResponse.json({error: 'OTP expired or not found'}, {status: 401});
        }

        const otpData = otpDoc.data();

        // Check expiration
        if (otpData.expires_at.toDate() < new Date()) {
            return NextResponse.json({error: 'OTP expired'}, {status: 401});
        }

        // Check attempt limit
        if (otpData.attempts >= 3) {
            return NextResponse.json({error: 'Too many failed attempts'}, {status: 429});
        }

        // Verify OTP
        if (sha256(otp) === otpData.pin_hash) {
            // Delete OTP document
            await otpRef.delete();
            
            return NextResponse.json({success: true, verified: true}, {status: 200});
        }

        // Increment failed attempts
        await otpRef.update({
            attempts: otpData.attempts + 1
        });

        return NextResponse.json({error: 'Invalid OTP'}, {status: 401});
    } catch (error) {
        console.error('OTP verification error:', error);
        return NextResponse.json({error: 'Verification failed'}, {status: 500});
    }
}