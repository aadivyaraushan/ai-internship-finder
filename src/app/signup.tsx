'use client';
import { useState } from 'react';
import './signup.css'

export default function Signup() {

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    let handleSubmit = (e: any) => {
        e.preventDefault();
        console.log(email, password);
    }
    
    return (
        <div className="signup-container">
            <h1 className="heading">Sign up</h1>
            <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
            <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
            <button onClick={handleSubmit}>Signup</button>
        </div>
    )
}

