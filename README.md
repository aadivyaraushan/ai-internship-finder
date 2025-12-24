# AI Internship Finder

An intelligent platform that uses AI to find personalized internship connections and networking opportunities based on your resume and career goals.

## 🚀 Features

### Real-time Connection Discovery
- **Streaming Results**: Connections appear immediately as they're discovered (no waiting for all results)
- **Live Progress Tracking**: See exactly which connection the AI is currently finding
- **Inline Progress Loader**: Side-by-side view of results and progress without blocking the interface

### AI-Powered Matching
- **Resume Analysis**: Automatic extraction and analysis of your background
- **Personalized Search**: AI finds connections based on shared experiences, companies, and schools
- **Interest Matching**: Optional personal interest matching for more authentic connections
- **Smart Outreach Messages**: AI-generated personalized messages for each connection

### Enhanced User Experience
- **Immediate Feedback**: UI updates instantly when you start a search
- **State Preservation**: Your preferences (Programs/People) are maintained across searches
- **Duplicate Prevention**: Smart deduplication ensures no duplicate connections
- **Responsive Design**: Works seamlessly on all device sizes

## 🛠 Technology Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Server-Sent Events
- **AI/ML**: Anthropic Claude, OpenAI GPT models
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **External APIs**: Web search, LinkedIn integration, email finding services

## 📋 Getting Started

### Prerequisites
- Node.js 18+ 
- npm/yarn/pnpm
- Firebase project with Firestore and Authentication enabled
- API keys for AI services (Anthropic Claude, OpenAI)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/ai-internship-finder.git
cd ai-internship-finder
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your API keys and Firebase config
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📚 Documentation

- **[System Overview](./docs/architecture/system-overview.md)** - High-level architecture and data flow
- **[Connection Finding Process](./docs/features/connection-finding.md)** - Detailed AI workflow and streaming implementation
- **[API Flow](./docs/architecture/api-flow.md)** - API endpoints and request/response patterns
- **[Database Schema](./docs/architecture/database-schema.md)** - Data structure and relationships

## 🎯 Recent Improvements

### Streaming & Real-time Updates
- ✅ **Granular Progress Tracking**: Step-by-step updates ("Finding 1st connection", "Finding 2nd connection", etc.)
- ✅ **Immediate Connection Display**: Connections appear as soon as they're found
- ✅ **Inline Progress Loader**: Non-blocking side-by-side layout during search
- ✅ **Duplicate Prevention**: Smart deduplication between streaming and final results

### UI/UX Enhancements
- ✅ **State Preservation**: Checkbox preferences maintained during search
- ✅ **Unique Keys**: Fixed React warnings with proper list item keys
- ✅ **Responsive Layout**: Dynamic layout adapts to search state
- ✅ **Header Overlap Fix**: Progress steps no longer overlap with header text

### Performance Optimizations
- ✅ **Reduced Perceived Latency**: Connections stream in real-time
- ✅ **Efficient Deduplication**: Prevents unnecessary UI re-renders
- ✅ **Smart State Management**: Optimized React state updates

## 🚀 Deployment

### Environment Variables Required
```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# AI Service Keys
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Other API Keys
TAVILY_API_KEY=
HUNTER_API_KEY=
```

### Deploy on Vercel
1. Push your code to GitHub
2. Connect your repository to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy automatically with every push

## 📖 Usage

1. **Upload Resume**: Upload your PDF resume for AI analysis
2. **Set Career Goal**: Describe your internship/career objectives
3. **Choose Preferences**: Select whether to find People connections, Program opportunities, or both
4. **Watch Real-time Results**: See connections appear immediately as the AI finds them
5. **Review Matches**: Each connection includes shared background points and personalized outreach messages
6. **Track Progress**: Use the built-in status tracking to manage your outreach efforts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- AI powered by [Anthropic Claude](https://www.anthropic.com/)
- UI components inspired by [shadcn/ui](https://ui.shadcn.com/)
- Real-time updates via Server-Sent Events
