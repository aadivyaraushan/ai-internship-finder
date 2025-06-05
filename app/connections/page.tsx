'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft,
  Mail,
  GraduationCap,
  Trophy,
  MapPin,
  Building,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';

interface Connection {
  id: string;
  name: string;
  title: string;
  avatar: string;
  connections: string[];
  department: string;
  yearsAtCompany: number;
}

const mockConnections: Connection[] = [
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
  {
    id: '3',
    name: 'Emily Johnson',
    title: 'Engineering Manager',
    avatar: '/placeholder.svg?height=40&width=40',
    connections: [
      'Stanford Computer Science',
      'Google Summer of Code (2015)',
      'Women in Tech Leadership',
    ],
    department: 'Engineering',
    yearsAtCompany: 5,
  },
  {
    id: '4',
    name: 'David Kim',
    title: 'VP of Engineering',
    avatar: '/placeholder.svg?height=40&width=40',
    connections: [
      'Stanford University (2012)',
      'Korean-American Engineers Association',
      'Former Startup Founder',
    ],
    department: 'Engineering',
    yearsAtCompany: 4,
  },
];

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailsSent, setEmailsSent] = useState<Set<string>>(new Set());
  const router = useRouter();
  const searchParams = useSearchParams();
  const company = searchParams.get('company') || 'Target Company';
  const { trackEvent } = useAnalytics();
  const { user } = useAuth();

  useEffect(() => {
    trackEvent('page_view', {
      page: 'connections',
      company: company,
    });

    // Simulate loading connections
    setTimeout(() => {
      setConnections(mockConnections);
      setLoading(false);
    }, 1500);
  }, [trackEvent, company]);

  const handleSendEmail = async (connectionId: string) => {
    setEmailsSent((prev) => new Set([...prev, connectionId]));
    await trackEvent('send_email', {
      userId: user?.uid,
      connectionId,
      company: company,
    });
    // In a real app, this would trigger the email sending process
  };

  const getConnectionIcon = (connection: string) => {
    if (
      connection.includes('University') ||
      connection.includes('Computer Science')
    ) {
      return <GraduationCap className='h-4 w-4' />;
    }
    if (
      connection.includes('Contest') ||
      connection.includes('Competition') ||
      connection.includes('Code')
    ) {
      return <Trophy className='h-4 w-4' />;
    }
    if (connection.includes('Area') || connection.includes('Francisco')) {
      return <MapPin className='h-4 w-4' />;
    }
    return <Building className='h-4 w-4' />;
  };

  if (loading) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 p-4'>
        <div className='max-w-4xl mx-auto'>
          <div className='text-center py-20'>
            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4'></div>
            <h2 className='text-xl font-semibold text-gray-800'>
              Finding your connections at {company}...
            </h2>
            <p className='text-sky-100 mt-2 text-gray-600'>
              Analyzing shared experiences and backgrounds
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 p-4'>
      <div className='max-w-4xl mx-auto'>
        <div className='mb-6'>
          <Button
            variant='ghost'
            onClick={() => router.push('/search')}
            className='mb-4 text-gray-700 hover:bg-white/50'
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back to Search
          </Button>

          <div className='flex justify-between items-center mb-6'>
            <div>
              <h1 className='text-3xl font-bold text-gray-800'>
                Connections at {company}
              </h1>
              <p className='text-lg text-gray-600'>
                Found {connections.length} people with shared connections
              </p>
            </div>
            <Button
              onClick={() => router.push('/dashboard')}
              className='bg-sky-600 hover:bg-sky-700 text-white'
            >
              View Dashboard
            </Button>
          </div>
        </div>

        <div className='grid gap-6'>
          {connections.map((connection) => (
            <Card
              key={connection.id}
              className='hover:shadow-xl transition-all duration-300 bg-white border-0 shadow-lg hover:scale-[1.02]'
            >
              <CardHeader>
                <div className='flex items-start justify-between'>
                  <div className='flex items-center gap-4'>
                    <Avatar className='h-12 w-12'>
                      <AvatarImage
                        src={connection.avatar || '/placeholder.svg'}
                        alt={connection.name}
                      />
                      <AvatarFallback>
                        {connection.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className='text-xl'>
                        {connection.name}
                      </CardTitle>
                      <CardDescription className='text-base'>
                        {connection.title}
                      </CardDescription>
                      <div className='flex items-center gap-4 mt-1 text-sm text-gray-500'>
                        <span>{connection.department}</span>
                        <span>•</span>
                        <span>
                          {connection.yearsAtCompany} years at {company}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleSendEmail(connection.id)}
                    disabled={emailsSent.has(connection.id)}
                    className='shrink-0 bg-sky-600 hover:bg-sky-700 text-white'
                  >
                    {emailsSent.has(connection.id) ? (
                      'Email Sent'
                    ) : (
                      <>
                        <Mail className='mr-2 h-4 w-4' />
                        Send Cold Email
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div>
                  <h4 className='font-semibold mb-3 text-gray-700'>
                    Shared Connections:
                  </h4>
                  <div className='flex flex-wrap gap-2'>
                    {connection.connections.map((conn, index) => (
                      <Badge
                        key={index}
                        variant='secondary'
                        className='flex items-center gap-1'
                      >
                        {getConnectionIcon(conn)}
                        {conn}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {connections.length === 0 && (
          <Card>
            <CardContent className='text-center py-12'>
              <h3 className='text-xl font-semibold text-gray-700 mb-2'>
                No connections found
              </h3>
              <p className='text-gray-500'>
                Try searching for a different company or update your resume with
                more details.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
