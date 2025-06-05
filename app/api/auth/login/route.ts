import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate inputs
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Mock successful login
    const mockUser = {
      id: 'user_123',
      email,
      name: 'Test User',
      avatar: '/placeholder.svg',
    };

    return NextResponse.json({
      user: mockUser,
      token: 'mock_jwt_token',
    });
  } catch (error) {
    console.error('Login Error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
