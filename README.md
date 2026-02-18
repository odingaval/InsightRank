# InsightRank 

**AI-Powered Developer Assessment Tool**

InsightRank is a focused, AI-powered tool designed to instantly transform any public developer profile (e.g., GitHub) into a comprehensive, structured technical evaluation. Built with the Google Genkit framework, it automates the time-consuming process of technical screening, providing recruiters, hiring managers, and investors with immediate, deep insight into a developer's quality of work, focus areas, and potential team fit.

##  Business Value: Speed and Depth in Developer Screening

InsightRank serves as an **AI Recruiter's Co-Pilot**, offering immediate, objective analysis:

- **For Technical Recruiters**: Instantly qualify or disqualify candidates by replacing hours of manual code sniffing with a 30-second AI summary
- **For Hiring Managers**: Provides objective, structured talking points for interviews, focusing on specific contributions highlighted by the AI
- **For Investors**: Quickly assess technical teams and individual contributors' capabilities

###  Unique Selling Point (USP)

Traditional screeners use metrics (lines of code). **InsightRank uses AI-powered qualitative judgment** to assess the impact and quality of those contributions, not just the volume.

##  Core Feature: The Instant Profile Review Flow

The entire application is dedicated to one, powerful smart workflow—the on-demand analysis of any single profile.

| Flow Step | Action / Genkit Implementation | Insight Provided |
|-----------|------------------------------|------------------|
| 1. Data Extraction | Custom Genkit Tool: Calls the GitHub API to fetch raw metrics, commit messages, and the top 10 recent Pull Requests (PRs) | Objective data (velocity, PR size, review time) |
| 2. Contextual Grounding | Genkit Indexing/Retrieval: The flow grounds the analysis by retrieving best-practice documents or internal quality guidelines | Ensures the review is based on context and quality standards, not just raw LLM output |
| 3. AI Analysis & Structuring | Genkit generate with Structured Output (Zod Schema): The raw data is passed to the Gemini LLM. The LLM is forced to output a JSON object adhering to a strict schema | The final, human-readable, and highly structured technical review, ready for interview prep |
| 4. Delivery | An instant web view or simple JSON API response containing the full AI-generated review | Immediate utility for the end-user (recruiter) |

##  Technical Architecture

### Tech Stack
- **Framework**: Google Genkit (TypeScript SDK)
- **LLM**: Gemini (via @genkit-ai/google-genai)
- **Data Sources**: External GitHub API (simulated as a custom Genkit Tool)
- **Schemas**: Zod for guaranteed structured, JSON output from the LLM
- **Frontend**: Angular with Tailwind CSS
- **Backend**: Firebase Functions
- **Development**: Nx Workspace

### Key Genkit Components Used
- **Genkit Flows**: Defining the entire screening process as a single, observable, multi-step pipeline
- **Tools**: Demonstrating how to use an external API (GitHub) as a secure function call within the flow
- **Structured Output**: Guarantees that the human-readable analysis is always predictable and machine-parsable
- **Observability**: The Genkit Developer UI is central to debugging and proving the flow's logic and latency

##  Example Output Structure

The AI Review is a single, structured object that focuses on constructive evaluation:

```json
{
  "strengths": [
    "Consistent commit frequency",
    "High-quality test coverage in core modules",
    "Clear and descriptive commit messages"
  ],
  "growthAreas": [
    "PR descriptions are often vague; need more context for reviewers",
    "Could benefit from more documentation in complex modules"
  ],
  "technicalKeywords": [
    "TypeScript", "Refactoring", "Microservices", "Observability"
  ],
  "bestContribution": "A direct summary of the most impactful recent work",
  "overallScore": 8,
  "recommendation": "Strong Hire",
  "interviewQuestions": [
    "Tell me about your approach to the complex refactoring of the AuthService module",
    "How do you ensure code quality in distributed systems?",
    "What's your strategy for handling technical debt?"
  ]
}
```

##  Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm
- Firebase CLI
- GitHub Personal Access Token
- Google AI Studio API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd insightrank-standalone
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up API Keys**
   
   **GitHub Token:**
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Generate a new token with `repo` and `user` scopes
   - Copy the token (starts with `ghp_`)

   **Gemini API Key:**
   - Go to [Google AI Studio](https://aistudio.google.com/)
   - Sign in and create a new API key
   - Copy the API key

4. **Configure Firebase**
   
   Update `/home/t480s/insightrank-standalone/firebase.json` with your actual API keys:
   ```json
   {
     "emulators": {
       "functions": {
         "port": 5001,
         "env": {
           "GITHUB_TOKEN": "your_actual_github_token_here",
           "GEMINI_API_KEY": "your_actual_gemini_key_here"
         }
       }
     }
   }
   ```

### Development

1. **Start the backend (Firebase Functions)**
   ```bash
   pnpm nx run backend:serve
   ```

2. **Start the frontend (Angular)**
   ```bash
   pnpm nx serve frontend --port 4200
   ```

3. **Access the application**
   - Frontend: http://localhost:4200
   - Firebase Emulator UI: http://localhost:4000

### Usage

1. **Open the application** at http://localhost:4200
2. **Enter a GitHub username** (e.g., `torvalds`, `gaearon`, `sindresorhus`)
3. **Click "Analyze Developer"**
4. **View the structured assessment** with:
   - Overall Score (1-10)
   - Recommendation (Strong Hire, Hire, Consider, Pass)
   - Top 3 Strengths
   - Key Growth Areas
   - Technical Keywords
   - Best Contribution Highlight
   - Interview Questions

##  Development

### Project Structure

```
insightrank-standalone/
├── apps/
│   ├── backend/           # Firebase Functions (Genkit backend)
│   └── frontend/          # Angular frontend
├── dist/                  # Built applications
├── firebase.json          # Firebase configuration
└── package.json           # Workspace dependencies
```

### Available Commands

```bash
# Build backend
pnpm nx build backend

# Build frontend
pnpm nx build frontend

# Serve backend (Firebase Functions)
pnpm nx run backend:serve

# Serve frontend
pnpm nx serve frontend

# Run tests
pnpm nx test

# Lint code
pnpm nx lint
```

##  Configuration

### Environment Variables

The application requires the following environment variables:

- `GITHUB_TOKEN`: Your GitHub Personal Access Token
- `GEMINI_API_KEY`: Your Google AI Studio API Key

These are configured in `firebase.json` for local development.

### Firebase Configuration

The Firebase configuration includes:
- Functions emulator on port 5001
- Environment variables for API keys
- Single project mode for local development

##  Troubleshooting

### Common Issues

1. **"Failed to analyze the developer"**
   - Check that your GitHub token is valid and has the correct permissions
   - Verify your Gemini API key is correct
   - Ensure both backend and frontend are running

2. **"Unauthorized" errors**
   - Verify your GitHub token is properly set in `firebase.json`
   - Check that the token has `repo` and `user` scopes

3. **Frontend not loading**
   - Ensure the frontend server is running on port 4200
   - Check for any build errors in the terminal

4. **Backend not responding**
   - Verify Firebase Functions emulator is running
   - Check the Firebase emulator UI at http://localhost:4000

### Debug Mode

To run with debug logging:
```bash
# Backend with debug
firebase emulators:start --only functions --debug

# Frontend with verbose output
pnpm nx serve frontend --verbose
```

##  Performance

- **Analysis Time**: Typically 15-30 seconds per developer
- **API Rate Limits**: Respects GitHub API rate limits
- **Concurrent Requests**: Supports multiple simultaneous analyses
- **Caching**: Results are not cached (each analysis is fresh)

##  Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

##  License

This project is licensed under the MIT License - see the LICENSE file for details.

##  Acknowledgments

- Built with [Google Genkit](https://firebase.google.com/docs/genkit)
- Powered by [Gemini AI](https://ai.google.dev/)
- Frontend built with [Angular](https://angular.io/)
- Backend hosted on [Firebase Functions](https://firebase.google.com/docs/functions)

---

**InsightRank** - Transforming developer screening with AI-powered insights 🚀
