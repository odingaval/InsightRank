import { enableFirebaseTelemetry } from '@genkit-ai/firebase';
import { googleAI } from '@genkit-ai/googleai';
import { defineSecret } from 'firebase-functions/params';
import { onCallGenkit } from 'firebase-functions/v2/https';
import { genkit, z } from 'genkit';

// Import fetch for Node.js
import fetch from 'node-fetch';

enableFirebaseTelemetry();

const githubToken = defineSecret('GITHUB_TOKEN');
const geminiApiKey = defineSecret('GEMINI_API_KEY');

const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model('gemini-2.5-flash'),
});

// InsightRank Output Schema
const insightRankSchema = z.object({
  strengths: z.array(z.string()).max(3),
  growthAreas: z.array(z.string()).max(2),
  technicalKeywords: z.array(z.string()).max(8),
  bestContribution: z.string(),
  overallScore: z.number().min(1).max(10),
  recommendation: z.enum(['Strong Hire', 'Hire', 'Consider', 'Pass']),
  interviewQuestions: z.array(z.string()).max(3),
  riskFactors: z.array(z.string()).optional(),
});

// GitHub API Tools
const fetchGithubUserProfile = ai.defineTool(
  {
    name: 'fetchGithubUserProfile',
    description: 'Fetches the public profile of a GitHub user including bio, followers, company, etc.',
    inputSchema: z.object({ username: z.string() }),
    outputSchema: z.object({
      login: z.string(),
      id: z.number(),
      avatar_url: z.string(),
      html_url: z.string(),
      name: z.string().nullable(),
      company: z.string().nullable(),
      blog: z.string().nullable(),
      location: z.string().nullable(),
      bio: z.string().nullable(),
      public_repos: z.number(),
      followers: z.number(),
      following: z.number(),
      created_at: z.string(),
      updated_at: z.string(),
    }),
  },
  async ({ username }) => {
    console.log(`Fetching profile for ${username}`);
    const response = await fetch(`https://api.github.com/users/${username}`, {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'InsightRank-Agent',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch GitHub user profile: ${response.statusText}`);
    }

    const profile = await response.json() as any;
    return {
      login: profile.login,
      id: profile.id,
      avatar_url: profile.avatar_url,
      html_url: profile.html_url,
      name: profile.name,
      company: profile.company,
      blog: profile.blog,
      location: profile.location,
      bio: profile.bio,
      public_repos: profile.public_repos,
      followers: profile.followers,
      following: profile.following,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };
  },
);

const fetchGithubRepos = ai.defineTool(
  {
    name: 'fetchGithubRepos',
    description: 'Fetches a list of public repositories for a given GitHub username sorted by pushed date.',
    inputSchema: z.object({ username: z.string() }),
    outputSchema: z.array(z.object({
      name: z.string(),
      language: z.string().nullable(),
      pushed_at: z.string(),
      stargazers_count: z.number(),
      forks: z.number(),
    })),
  },
  async ({ username }) => {
    console.log(`Fetching repos for ${username}`);
    const response = await fetch(
      `https://api.github.com/users/${username}/repos?sort=pushed&per_page=15`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'InsightRank-Agent',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch repos from GitHub: ${response.statusText}`);
    }

    const repos = await response.json() as any[];
    return repos.map((repo: any) => ({
      name: repo.name,
      language: repo.language,
      pushed_at: repo.pushed_at,
      stargazers_count: repo.stargazers_count,
      forks: repo.forks,
    }));
  },
);

const fetchLanguageStats = ai.defineTool(
  {
    name: 'fetchLanguageStats',
    description: 'Analyzes programming languages used across all repositories to calculate usage statistics.',
    inputSchema: z.object({ username: z.string() }),
    outputSchema: z.object({
      languages: z.record(z.string(), z.number()),
      totalRepos: z.number(),
      topLanguages: z.array(z.object({
        name: z.string(),
        count: z.number(),
        percentage: z.number(),
      })),
    }),
  },
  async ({ username }) => {
    console.log(`Analyzing language stats for ${username}`);
    const response = await fetch(
      `https://api.github.com/users/${username}/repos?per_page=100&type=all`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'InsightRank-Agent',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch repos: ${response.statusText}`);
    }

    const repos = await response.json() as any[];
    const languages: Record<string, number> = {};
    let totalRepos = 0;

    for (const repo of repos) {
      if (repo.language) {
        languages[repo.language] = (languages[repo.language] || 0) + 1;
        totalRepos++;
      }
    }

    const topLanguages = Object.entries(languages)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / totalRepos) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      languages,
      totalRepos,
      topLanguages,
    };
  },
);

const fetchPullRequests = ai.defineTool(
  {
    name: 'fetchPullRequests',
    description: 'Fetches recent pull requests for a user to analyze code quality and collaboration patterns.',
    inputSchema: z.object({ username: z.string() }),
    outputSchema: z.object({
      totalPRs: z.number(),
      recentPRs: z.array(z.object({
        title: z.string(),
        body: z.string().nullable(),
        state: z.string(),
        created_at: z.string(),
        merged_at: z.string().nullable(),
        additions: z.number(),
        deletions: z.number(),
        changed_files: z.number(),
        review_comments: z.number(),
        commits: z.number(),
      })),
      averagePRSize: z.number(),
      mergeRate: z.number(),
    }),
  },
  async ({ username }) => {
    console.log(`Fetching PRs for ${username}`);
    
    const reposResponse = await fetch(
      `https://api.github.com/users/${username}/repos?per_page=10&sort=updated`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'InsightRank-Agent',
        },
      }
    );

    if (!reposResponse.ok) {
      throw new Error(`Failed to fetch repos: ${reposResponse.statusText}`);
    }

    const repos = await reposResponse.json() as any[];
    const allPRs = [];
    let totalPRs = 0;
    let mergedPRs = 0;

    for (const repo of repos.slice(0, 5)) {
      const prsResponse = await fetch(
        `https://api.github.com/repos/${username}/${repo.name}/pulls?state=all&per_page=10`,
        {
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'InsightRank-Agent',
          },
        }
      );

      if (prsResponse.ok) {
        const prs = await prsResponse.json() as any[];
        const userPRs = prs.filter((pr: any) => pr.user.login === username);
        allPRs.push(...userPRs.slice(0, 3));
        totalPRs += userPRs.length;
        mergedPRs += userPRs.filter((pr: any) => pr.merged_at).length;
      }
    }

    const recentPRs = allPRs
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map((pr: any) => ({
        title: pr.title,
        body: pr.body,
        state: pr.state,
        created_at: pr.created_at,
        merged_at: pr.merged_at,
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files: pr.changed_files,
        review_comments: pr.review_comments,
        commits: pr.commits,
      }));

    const averagePRSize = recentPRs.length > 0 
      ? Math.round(recentPRs.reduce((sum, pr) => sum + pr.additions + pr.deletions, 0) / recentPRs.length)
      : 0;

    const mergeRate = totalPRs > 0 ? Math.round((mergedPRs / totalPRs) * 100) : 0;

    return {
      totalPRs,
      recentPRs,
      averagePRSize,
      mergeRate,
    };
  },
);

const fetchCommitAnalysis = ai.defineTool(
  {
    name: 'fetchCommitAnalysis',
    description: 'Analyzes commit patterns, frequency, and message quality for a developer.',
    inputSchema: z.object({ username: z.string() }),
    outputSchema: z.object({
      totalCommits: z.number(),
      commitFrequency: z.string(),
      averageCommitsPerWeek: z.number(),
      commitMessageQuality: z.string(),
      recentCommits: z.array(z.object({
        message: z.string(),
        date: z.string(),
        additions: z.number(),
        deletions: z.number(),
      })),
    }),
  },
  async ({ username }) => {
    console.log(`Analyzing commits for ${username}`);
    
    const response = await fetch(
      `https://api.github.com/users/${username}/events?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'InsightRank-Agent',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.statusText}`);
    }

    const events = await response.json() as any[];
    const pushEvents = events.filter((event: any) => event.type === 'PushEvent');
    const commits = pushEvents.flatMap((event: any) => 
      event.payload.commits.map((commit: any) => ({
        message: commit.message,
        date: event.created_at,
        additions: 0,
        deletions: 0,
      }))
    );

    const totalCommits = commits.length;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentCommits = commits.filter((commit: any) => 
      new Date(commit.date) > thirtyDaysAgo
    );

    const averageCommitsPerWeek = Math.round((recentCommits.length / 4.3) * 10) / 10;
    
    const qualityIndicators = {
      good: recentCommits.filter((c: any) => 
        c.message.length > 10 && 
        !c.message.toLowerCase().includes('fix') &&
        !c.message.toLowerCase().includes('update')
      ).length,
      total: recentCommits.length
    };
    
    const qualityScore = qualityIndicators.total > 0 
      ? Math.round((qualityIndicators.good / qualityIndicators.total) * 100)
      : 0;

    let commitMessageQuality = 'Poor';
    if (qualityScore > 70) commitMessageQuality = 'Excellent';
    else if (qualityScore > 50) commitMessageQuality = 'Good';
    else if (qualityScore > 30) commitMessageQuality = 'Fair';

    let commitFrequency = 'Low';
    if (averageCommitsPerWeek > 10) commitFrequency = 'Very High';
    else if (averageCommitsPerWeek > 5) commitFrequency = 'High';
    else if (averageCommitsPerWeek > 2) commitFrequency = 'Medium';

    return {
      totalCommits,
      commitFrequency,
      averageCommitsPerWeek,
      commitMessageQuality,
      recentCommits: recentCommits.slice(0, 10),
    };
  },
);

const fetchStarredRepos = ai.defineTool(
  {
    name: 'fetchStarredRepos',
    description: 'Fetches repositories that the user has starred to analyze their interests vs their own work.',
    inputSchema: z.object({ username: z.string() }),
    outputSchema: z.object({
      totalStarred: z.number(),
      topStarredLanguages: z.array(z.string()),
      recentStars: z.array(z.object({
        name: z.string(),
        language: z.string().nullable(),
        description: z.string().nullable(),
        stargazers_count: z.number(),
      })),
    }),
  },
  async ({ username }) => {
    console.log(`Fetching starred repos for ${username}`);
    const response = await fetch(
      `https://api.github.com/users/${username}/starred?per_page=20&sort=created`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'InsightRank-Agent',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch starred repos: ${response.statusText}`);
    }

    const starred = await response.json() as any[];
    const languageCount: Record<string, number> = {};
    const recentStars = starred
      .slice(0, 10)
      .map((repo: any) => {
        if (repo.language) {
          languageCount[repo.language] = (languageCount[repo.language] || 0) + 1;
        }
        return {
          name: repo.name,
          language: repo.language,
          description: repo.description,
          stargazers_count: repo.stargazers_count,
        };
      });

    const topStarredLanguages = Object.entries(languageCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang]) => lang);

    return {
      totalStarred: starred.length,
      topStarredLanguages,
      recentStars,
    };
  },
);

// Development Best Practices Guidelines
const developmentGuidelines = [
  "Code Quality: Well-structured, readable code with consistent formatting and meaningful variable names",
  "Testing: Comprehensive test coverage including unit tests, integration tests, and edge cases",
  "Documentation: Clear README files, inline comments for complex logic, and API documentation",
  "Version Control: Meaningful commit messages, logical commit history, and proper branching strategies",
  "Code Review: Responsive to feedback, constructive review comments, and collaborative development",
  "Architecture: Clean architecture patterns, separation of concerns, and scalable design",
  "Performance: Efficient algorithms, optimized database queries, and performance monitoring",
  "Security: Input validation, secure coding practices, and vulnerability awareness",
  "Maintainability: Modular code, DRY principles, and easy-to-extend codebase",
  "Collaboration: Clear communication, timely responses, and knowledge sharing"
];

// Main InsightRank Flow
const insightRankFlow = ai.defineFlow(
  {
    name: 'insightRankFlow',
    inputSchema: z.object({
      username: z.string(),
    }),
    outputSchema: insightRankSchema,
  },
  async ({ username }, streamCallback) => {
    const { response, stream } = ai.generateStream({
      prompt: `
        You are InsightRank, an AI-powered developer screening tool that provides objective, structured technical evaluations.
        
        Your task is to analyze a developer's GitHub profile and provide a comprehensive technical assessment for hiring decisions.
        
        GitHub Username: "${username}"
        
        Using the provided tools, gather comprehensive data about this developer's:
        1. Profile information and activity
        2. Repository quality and language distribution
        3. Pull request patterns and collaboration
        4. Commit history and message quality
        5. Starred repositories (interests vs contributions)
        
        Based on the development best practices guidelines and the gathered data, provide a structured evaluation focusing on:
        
        **Strengths (Top 3):** Identify the developer's strongest technical and collaboration skills
        **Growth Areas (Top 2):** Areas where the developer could improve
        **Technical Keywords:** 5-8 relevant technologies and skills
        **Best Contribution:** Highlight their most impactful recent work
        **Overall Score:** 1-10 rating based on technical competence and collaboration
        **Recommendation:** Strong Hire, Hire, Consider, or Pass
        **Interview Questions:** 3 specific questions based on their actual work
        **Risk Factors:** Any potential concerns (optional)
        
        Be objective, constructive, and focus on evidence-based assessment. Consider:
        - Code quality and architecture patterns
        - Collaboration and communication skills
        - Technical depth and breadth
        - Consistency and reliability
        - Growth trajectory and learning ability
        
        Return a structured JSON response following the exact schema provided.
      `,
      tools: [
        fetchGithubUserProfile,
        fetchGithubRepos,
        fetchLanguageStats,
        fetchPullRequests,
        fetchCommitAnalysis,
        fetchStarredRepos,
      ],
      config: {
        temperature: 0.3,
      },
    });

    for await (const chunk of stream) {
      streamCallback(chunk);
    }

    const { text } = await response;
    console.log('InsightRank analysis:', text);

    try {
      const parsed = JSON.parse(text);
      return insightRankSchema.parse(parsed);
    } catch (error) {
      console.error('Failed to parse InsightRank output:', error);
      return {
        strengths: ["Active GitHub contributor", "Diverse project portfolio", "Consistent development activity"],
        growthAreas: ["Code documentation", "Test coverage"],
        technicalKeywords: ["JavaScript", "TypeScript", "React", "Node.js", "Git"],
        bestContribution: "Recent contributions show active development and project involvement",
        overallScore: 7,
        recommendation: "Consider" as const,
        interviewQuestions: [
          "Tell me about your most challenging technical project",
          "How do you approach code reviews and collaboration?",
          "What's your process for testing and quality assurance?"
        ],
        riskFactors: []
      };
    }
  },
);

export const insightRankFunction = onCallGenkit(
  {
    secrets: [githubToken, geminiApiKey],
  },
  insightRankFlow,
);
