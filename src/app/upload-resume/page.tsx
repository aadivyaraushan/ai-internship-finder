'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { checkAuth } from '@/lib/firebase';
import { useEffect } from 'react';
import Cookies from 'js-cookie';

export default function UploadResume() {
  const [file, setFile] = useState<File | null>(null);
  const [goals, setGoals] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();

  useEffect(() => {
    console.log('Checking auth', checkAuth());
    if (!checkAuth()) {
      router.push('/signup');
    }
  }, [router]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    onDrop: (acceptedFiles: File[]) => {
      setFile(acceptedFiles[0]);
      setError(''); // Clear any previous errors
    },
  });

  const handleSubmit = async () => {
    // TODO: Implement submission logic
    console.log('File:', file);
    console.log('Goals:', goals);
    
    if (!file) {
      setError('Please upload a resume file');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);

      // Send to resume analysis endpoint
      const response = await fetch('/api/resume-analysis', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to analyze resume');
      }

      const data = await response.json();

      // just so i dont waste my creds on openai
      // const data = JSON.parse(`{"education":[{"school_name":"University of Illinois Urbana-Champaign (UIUC)","clubs":[],"awards":[],"gpa":null,"notable_coursework":["Bachelor of Science in Computer Science"]},{"school_name":"GEMS Modern Academy","clubs":[],"awards":["ICSE Grade 10 World Topper: Computer Science & Chemistry, 2023"],"gpa":null,"notable_coursework":["International Baccalaureate (IB) Diploma Programme","Higher Level Subjects: Physics, Mathematics Analyses and Approaches, Computer Science","Standard Level Subjects: Economics, English Language and Literature, Spanish AB Initio","ICSE Grade 10: Average of 98.4%","Digital SAT Score: 1560 (780 English, 780 Math)"]}],"skills":["JavaScript","Python","HTML","CSS","Solidity","React.js","Tailwind CSS","Git","AWS","Docker","Node.js","Truffle","Google Analytics","Adobe Premiere Pro","Adobe Photoshop","Adobe Illustrator","GIMP","DaVinci Resolve","Artificial Intelligence","Machine Learning","Generative AI","GPT models","Blockchain","Quantum Computation","Data Analysis","Gamification","Lean Startup Methodology","Design Thinking","English (Native)","Hindi (Fluent)","Spanish (Basic)","Product Management","Team Leadership","Public Speaking","Research","Mentoring","Event Organization","Problem Set Design","Statistical Analysis","Wilcoxon rank-sum test"],"personal_projects":[{"project_name":"LessonGPT","description":"AI product to generate lesson plans to simplify teachers’ workload, integrating learning psychology, curriculum requirements, and automated test question creation.","responsibilities":["Founder and Lead Developer","Developed app at UAE’s 1st government-sponsored generative AI hackathon","Wrote 2,000+ lines of code","Presented at GITEX and Hemaya International Center","Managed user adoption and feedback"],"recognition":"Finalist in GEMS Global Innovation Challenge (top 8/300+ projects or top 30/11,000 students); Featured on Gulf News; Presented at GITEX and Dubai Police HQ","skills":["JavaScript","React.js","AI","Learning Psychology","Product Development","Public Speaking"]},{"project_name":"Project Streamline","description":"Advanced biometric system to replace ID cards in schools.","responsibilities":["Co-Founder and CTO","Developed biometric system","Presented at iCAN Global Summit, GITEX Global, and Intersec Conference"],"recognition":"Presented at iCAN Global Summit (UAE representative), GITEX Global, Intersec Conference","skills":["Biometrics","Product Development","Public Speaking","Team Leadership"]},{"project_name":"SupplyBlock","description":"Proof-of-concept global Blockchain-based supply chain management platform.","responsibilities":["Founder and Lead Developer","Mastered blockchain fundamentals via Udemy","Developed and tested application (10,000 lines of code)","Applied Lean startup methodology"],"recognition":"Recognized by Fortune 500 companies for Lean startup methodology","skills":["Solidity","Truffle","React.js","AWS","IPFS","JavaScript","Blockchain","Lean Startup Methodology"]},{"project_name":"Nocrastination","description":"Productivity videogame for teens with ADHD and attentional challenges.","responsibilities":["Founder and CEO","Applied design thinking (Google Sprint method)","Led a team of 5","Pitched to 100+ stakeholders"],"recognition":"Top 15 projects out of 60+ in entrepreneurship and innovation program","skills":["Design Thinking","Team Leadership","Product Development","Pitching"]},{"project_name":"AutoCorrect (AI for Automated Exam Correction)","description":"Novel AI algorithm utilizing OpenAI's GPTs to assess IB responses and reduce grading time.","responsibilities":["Developed AI algorithm","Evaluated 60+ IB questions","Wrote research paper for IB Extended Essay"],"recognition":null,"skills":["AI","OpenAI GPT","Python","Research"]},{"project_name":"Quantum Computation & Information Research","description":"Research into quantum superposition, entanglement, Shor’s algorithm, and quantum noise correction under Cambridge Future Scholar Programme.","responsibilities":["Admitted to Cambridge Future Scholar Programme","Awarded CCIR STEM merit scholarship","Supervised by Dr. Sergii Strelchuk","Conducted quantum computation research"],"recognition":"CCIR Spotlight Scholar; CCIR STEM merit scholarship","skills":["Quantum Computation","Research","Theoretical Physics"]},{"project_name":"Gamification & Adolescent Productivity","description":"Cross-sectional field study on how gamification affects adolescents’ productivity.","responsibilities":["Led field study","Collaborated with Mindspark","Analyzed data with Python and Wilcoxon rank-sum test","Published in International Journal of Novel Research and Development"],"recognition":"Published in top 5% international journal (IJNRD, impact factor 8.76)","skills":["Research","Data Analysis","Python","Statistical Analysis","Gamification"]}],"workex":[{"workplace":"LessonGPT","notable_projects":["LessonGPT"],"role":"Founder & Lead Developer","reference_email":null,"is_alumni":false},{"workplace":"Project Streamline","notable_projects":["Project Streamline"],"role":"Co-Founder & CTO","reference_email":null,"is_alumni":true},{"workplace":"Comprich","notable_projects":[],"role":"Web Developer (Internship)","reference_email":null,"is_alumni":true},{"workplace":"SupplyBlock","notable_projects":["SupplyBlock"],"role":"Founder & Lead Developer","reference_email":null,"is_alumni":true},{"workplace":"Nocrastination","notable_projects":["Nocrastination"],"role":"Founder & CEO","reference_email":null,"is_alumni":true}],"linkedin":"https://www.linkedin.com/in/aadivya-raushan-245264240/","per_web":"https://github.com/aadivyaraushan"}`);
      console.log('Resume analysis data:', data);

      // Store resume data in localStorage instead of cookie
      // const resumeData = JSON.stringify(data);
      // console.log('Data being stored:', resumeData);
      // localStorage.setItem('resumeAnalysis', resumeData);
      // console.log('Data after storing:', localStorage.getItem('resumeAnalysis')); // Verify data was stored

      // Redirect to the next page with just the goal
      router.push(`/top-goals?goal=${encodeURIComponent(goals)}`);
    } catch (err: any) {
      setError(err.message || 'Failed to process resume');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4'>
      <div className='bg-[#1a1a1a] p-8 rounded-2xl w-full max-w-xl'>
        <h1 className='text-2xl font-semibold text-white mb-1'>
          Upload your resume
        </h1>
        <p className='text-gray-400 text-sm mb-6'>
          Help us get to know you better by sharing your resume
        </p>

        {error && (
          <div className='mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm'>
            {error}
          </div>
        )}

        <div
          {...getRootProps()}
          className={`border-2 border-dashed border-gray-600 rounded-lg p-8 mb-6 text-center cursor-pointer
            ${
              isDragActive
                ? 'border-blue-500 bg-blue-500/10'
                : 'hover:border-gray-500 hover:bg-gray-800/30'
            }`}
        >
          <input {...getInputProps()} />
          <div className='flex flex-col items-center gap-2'>
            <svg
              className='w-8 h-8 text-gray-400'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12'
              />
            </svg>
            <div className='text-gray-300'>
              {file ? file.name : 'Drag your resume here or click to upload'}
            </div>
            <div className='text-gray-500 text-sm'>
              Acceptable file types: PDF, DOCX (5MB max)
            </div>
          </div>
        </div>

        <div className='mb-6'>
          <label htmlFor='goals' className='block text-white mb-2'>
            Please tell us your goals
          </label>
          <textarea
            id='goals'
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder='For example: if you wish to pivot into tech, or if you want to find an internship. Any information helps.'
            className='w-full h-24 px-3 py-2 text-gray-300 bg-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>

        <div className='flex justify-between gap-4'>
          <button
            className='px-4 py-2 bg-[#2a2a2a] text-white rounded-lg hover:bg-[#3a3a3a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            onClick={() => console.log('Save as draft')}
            disabled={loading}
          >
            Save as Draft
          </button>
          <button
            className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
