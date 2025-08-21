# AI Internship Finder - Documentation

Welcome to the comprehensive documentation for the AI Internship Finder application. This documentation provides detailed insights into the system architecture, data flows, and implementation details.

## 📁 Documentation Structure

### Architecture & System Design
- **[System Architecture](./architecture/system-overview.md)** - High-level system components and relationships
- **[API Documentation](./architecture/api-flow.md)** - API endpoints and request/response flows
- **[Database Schema](./architecture/database-schema.md)** - Firestore collections and document structures

### Core Features
- **[Connection Finding Process](./features/connection-finding.md)** - AI-driven connection discovery workflow
- **[Personalization Features](./features/personalization.md)** - Enhanced matching with shared interests
- **[Authentication Flow](./features/authentication.md)** - User authentication and session management

### Frontend
- **[Component Hierarchy](./frontend/components.md)** - React component structure and relationships
- **[Data Flow](./frontend/data-flow.md)** - How data moves through the frontend

### Development
- **[Setup Guide](./development/setup.md)** - Local development setup instructions
- **[API Reference](./development/api-reference.md)** - Detailed API endpoint documentation
- **[Contributing](./development/contributing.md)** - Guidelines for contributing to the project

## 🚀 Quick Start

1. **System Overview**: Start with [System Architecture](./architecture/system-overview.md) to understand the overall structure
2. **Core Features**: Review [Connection Finding Process](./features/connection-finding.md) to understand the main functionality
3. **Personalization**: Check [Personalization Features](./features/personalization.md) for the latest enhanced matching capabilities

## 🔧 Technology Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Server-Sent Events (SSE)
- **AI/ML**: Anthropic Claude, OpenAI GPT models, Web Search APIs
- **Database**: Firebase Firestore
- **Authentication**: Firebase Authentication
- **Deployment**: Vercel

## 📊 Key Features

### AI-Powered Connection Finding
- Advanced AI agents for discovering relevant professional connections
- Web search integration for real-time data
- Multi-step validation and filtering process

### Personalization Engine
- Shared professional interests matching
- Personal interests and hobbies alignment
- Enhanced outreach message generation

### Real-time Updates
- Server-Sent Events for live connection discovery
- Progress tracking during AI processing
- Instant status updates

### Smart Resume Analysis
- Automated resume parsing and analysis
- Structured data extraction
- Context-aware connection matching

## 🎯 Recent Updates

- ✅ **Personalization Features**: Added shared professional and personal interests matching
- ✅ **Enhanced Outreach**: AI-generated personalized outreach messages with shared interests
- ✅ **Improved UI**: Updated connection cards to display interest sections
- ✅ **Rate Limiting**: Added exponential backoff for AI API calls
- ✅ **Data Flow Optimization**: Fixed data preservation through the entire pipeline

## 📞 Support

For questions or issues, please refer to the relevant documentation sections or create an issue in the repository.

---

Last updated: August 2025