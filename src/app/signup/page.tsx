'use client';
import "../signup.css";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, checkAuth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export default function Signup() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const checkAuthentication = async () => {
            const isAuthenticated = await checkAuth();
            if (isAuthenticated) {
                console.log("User is already logged in");
                router.push('/upload-resume');
            }
        };

        checkAuthentication();
    }, [router]);

    const getErrorMessage = (errorCode: string) => {
        switch (errorCode) {
            case 'auth/email-already-in-use':
                return 'An account with this email already exists.';
            case 'auth/invalid-email':
                return 'Invalid email address format.';
            case 'auth/operation-not-allowed':
                return 'Email/password accounts are not enabled. Please contact support.';
            case 'auth/weak-password':
                return 'Password should be at least 6 characters long.';
            case 'auth/network-request-failed':
                return 'Network error. Please check your connection.';
            default:
                return 'An error occurred. Please try again.';
        }
    }

    const handleSubmit = async(e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await createUserWithEmailAndPassword(auth, email, password);
            router.push('/upload-resume');
        } catch (err: any) {
            setError(getErrorMessage(err.code));
        } finally {
            setLoading(false);
        }
    }
    
    return (
        <div className="signup-container">
            <h1 className="heading">Sign up</h1>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleSubmit}>
                <input 
                    type="email" 
                    placeholder="Email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)} 
                    required
                />
                <input 
                    type="password" 
                    placeholder="Password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)} 
                    required
                />
                <button type="submit" disabled={loading}>
                    {loading ? 'Signing up...' : 'Sign up'}
                </button>
            </form>
            <p>Already have an account? <Link href="/login">Login</Link></p>
        </div>
    )
} 