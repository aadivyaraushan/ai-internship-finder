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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Building, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';

export default function SearchPage() {
  const [company, setCompany] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();
  const { trackEvent } = useAnalytics();
  const { user } = useAuth();

  useEffect(() => {
    trackEvent('page_view', { page: 'search' });
  }, [trackEvent]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim()) return;

    setIsSearching(true);
    await trackEvent('company_search', {
      userId: user?.uid,
      searchQuery: company.trim(),
    });

    // Simulate search delay
    setTimeout(() => {
      router.push(`/connections?company=${encodeURIComponent(company.trim())}`);
    }, 2000);
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 p-4'>
      <div className='max-w-2xl mx-auto'>
        <div className='mb-6'>
          <Button
            variant='ghost'
            onClick={() => router.push('/')}
            className='mb-4 text-gray-700 hover:bg-white/50'
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back
          </Button>

          <div className='text-center mb-8'>
            <h1 className='text-3xl font-bold text-gray-800 mb-4'>
              Find Your Target Company
            </h1>
            <p className='text-lg text-gray-600'>
              Enter the company where you want to secure an internship
            </p>
          </div>
        </div>

        <Card className='bg-white border-0 shadow-lg'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Building className='h-5 w-5' />
              Company Search
            </CardTitle>
            <CardDescription>
              We'll find key decision makers and identify your shared
              connections
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='space-y-2'>
              <Label htmlFor='company'>Company Name</Label>
              <Input
                id='company'
                placeholder='e.g., Google, Microsoft, Apple'
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch(e)}
              />
            </div>

            <Button
              onClick={handleSearch}
              disabled={!company.trim() || isSearching}
              className='w-full bg-sky-600 hover:bg-sky-700 text-white'
              size='lg'
            >
              {isSearching ? (
                <>
                  <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2'></div>
                  Searching for connections...
                </>
              ) : (
                <>
                  <Search className='mr-2 h-4 w-4' />
                  Find Connections
                </>
              )}
            </Button>

            <div className='bg-sky-100 p-4 rounded-lg border border-sky-200'>
              <h3 className='font-semibold text-sky-800 mb-2'>
                What we'll find:
              </h3>
              <ul className='text-sm text-sky-700 space-y-1'>
                <li>• Alumni from your university working at the company</li>
                <li>• People with similar academic backgrounds</li>
                <li>• Shared extracurricular activities or competitions</li>
                <li>• Common professional experiences</li>
                <li>• Geographic connections</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
