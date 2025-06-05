'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Mail, Building, Users, BarChart3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { useAnalytics } from '@/hooks/useAnalytics';

export default function HomePage() {
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const router = useRouter();
  const { user, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    trackEvent('page_view', { page: 'home' });
  }, [trackEvent]);

  const handleGmailConnect = async () => {
    try {
      await signInWithGoogle();
      await trackEvent('gmail_connect_success', {
        userId: user?.uid,
        email: user?.email,
      });
      toast({
        title: 'Successfully connected Gmail',
        description: 'You can now send personalized cold emails',
      });
    } catch (error) {
      await trackEvent('gmail_connect_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.error('Failed to connect Gmail:', error);
      toast({
        title: 'Failed to connect Gmail',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const uploadedFile = event.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setResumeUploaded(true);
      await trackEvent('resume_upload', {
        fileType: uploadedFile.type,
        fileSize: uploadedFile.size,
        fileName: uploadedFile.name,
      });
    }
  };

  const handleGetStarted = () => {
    trackEvent('get_started_click', {
      userId: user?.uid,
      hasResume: resumeUploaded,
    });
    router.push('/search');
  };

  const canProceed = user && resumeUploaded;

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 p-4'>
      <div className='max-w-4xl mx-auto'>
        <div className='text-center mb-8'>
          <h1 className='text-4xl font-bold text-gray-800 mb-4'>NetworkPro</h1>
          <p className='text-xl text-gray-600'>
            Connect with industry leaders through shared experiences
          </p>
        </div>

        <div className='grid md:grid-cols-2 gap-6 mb-8'>
          {/* Gmail Connection */}
          <Card className='bg-white border-0 shadow-lg'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Mail className='h-5 w-5' />
                Connect Gmail Account
              </CardTitle>
              <CardDescription>
                Connect your Gmail to send personalized cold emails
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!user ? (
                <Button
                  onClick={handleGmailConnect}
                  className='w-full bg-white text-blue-700 hover:bg-blue-50'
                >
                  <Mail className='mr-2 h-4 w-4' />
                  Connect Gmail
                </Button>
              ) : (
                <div className='flex items-center gap-2 text-sky-700'>
                  <div className='w-2 h-2 bg-sky-500 rounded-full'></div>
                  Connected as {user.email}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resume Upload */}
          <Card className='bg-white border-0 shadow-lg'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Upload className='h-5 w-5' />
                Upload Resume
              </CardTitle>
              <CardDescription>
                Upload your resume to extract your background information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                <Label htmlFor='resume'>Resume (PDF, DOC, DOCX)</Label>
                <Input
                  id='resume'
                  type='file'
                  accept='.pdf,.doc,.docx'
                  onChange={handleFileUpload}
                />
                {resumeUploaded && (
                  <div className='flex items-center gap-2 text-green-600'>
                    <div className='w-2 h-2 bg-green-500 rounded-full'></div>
                    {file?.name} uploaded successfully
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Features Overview */}
        <div className='grid md:grid-cols-3 gap-6 mb-8'>
          <Card className='bg-white border-0 shadow-lg'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Building className='h-5 w-5' />
                Company Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-sm text-gray-600'>
                Search for companies and find key decision makers
              </p>
            </CardContent>
          </Card>

          <Card className='bg-white border-0 shadow-lg'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Users className='h-5 w-5' />
                Find Connections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-sm text-gray-600'>
                Discover shared experiences with company leaders
              </p>
            </CardContent>
          </Card>

          <Card className='bg-white border-0 shadow-lg'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <BarChart3 className='h-5 w-5' />
                Track Outreach
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-sm text-gray-600'>
                Monitor email responses and follow-ups
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Continue Button */}
        <div className='text-center'>
          <Button
            size='lg'
            disabled={!canProceed}
            onClick={handleGetStarted}
            className='px-8 bg-sky-500 hover:bg-sky-600 text-white'
          >
            Get Started
          </Button>
          {!canProceed && (
            <p className='text-sm text-gray-500 mt-2'>
              Please connect Gmail and upload your resume to continue
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
