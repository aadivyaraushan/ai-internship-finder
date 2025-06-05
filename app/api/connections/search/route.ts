import { NextResponse } from 'next/server';

const mockConnections = [
  {
    id: '1',
    name: 'Sarah Chen',
    title: 'Senior Software Engineer',
    avatar: '/placeholder.svg?height=40&width=40',
    connections: [
      'Stanford University (2018)',
      'ACM Programming Contest (2017)',
      'San Francisco Bay Area',
    ],
    department: 'Engineering',
    yearsAtCompany: 3,
  },
  {
    id: '2',
    name: 'Michael Rodriguez',
    title: 'Product Manager',
    avatar: '/placeholder.svg?height=40&width=40',
    connections: [
      'Stanford University (2016)',
      'Phi Beta Kappa',
      'Former McKinsey Consultant',
    ],
    department: 'Product',
    yearsAtCompany: 2,
  },
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { company, userBackground } = body;

    // Validate inputs
    if (!company) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    // find people online who are higher up in the company and share resume connnections
    // and add them to the connections that are output
    

    

    return NextResponse.json({
      success: true,
      connections: mockConnections,
      company,
    });
  } catch (error) {
    console.error('Connections Search Error:', error);
    return NextResponse.json(
      { error: 'Failed to search connections' },
      { status: 500 }
    );
  }
}
