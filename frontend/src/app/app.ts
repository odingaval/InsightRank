import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { injectMutation } from '@tanstack/angular-query-experimental';

export interface InsightRankResult {
  strengths: string[];
  growthAreas: string[];
  technicalKeywords: string[];
  bestContribution: string;
  overallScore: number;
  recommendation: 'Strong Hire' | 'Hire' | 'Consider' | 'Pass';
  interviewQuestions: string[];
  riskFactors?: string[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  functions = inject(Functions);
  username = '';
  assessmentResult: InsightRankResult | null = null;
  errorMessage = '';
  isAnalyzing = signal(false);

  analysisMutation = injectMutation(() => ({
    mutationFn: async (username: string) => {
      const callable = httpsCallable<{ username: string }, InsightRankResult>(
        this.functions,
        'insightRankFunction',
      );
      const result = await callable({ username });
      return result.data;
    },
    onSuccess: (data: InsightRankResult) => {
      this.assessmentResult = data;
      this.errorMessage = '';
      this.isAnalyzing.set(false);
    },
    onError: (error: any) => {
      console.error('Analysis failed:', error);
      this.errorMessage = 'Failed to analyze the developer. Please check the username and try again.';
      this.isAnalyzing.set(false);
    },
  }));

  analyzeDeveloper(): void {
    if (!this.username.trim()) return;
    
    this.isAnalyzing.set(true);
    this.assessmentResult = null;
    this.errorMessage = '';
    
    this.analysisMutation.mutate(this.username.trim());
  }

  getScoreColor(score: number): string {
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    if (score >= 4) return 'text-orange-400';
    return 'text-red-400';
  }

  getRecommendationColor(recommendation: string): string {
    switch (recommendation) {
      case 'Strong Hire':
        return 'text-green-400';
      case 'Hire':
        return 'text-green-300';
      case 'Consider':
        return 'text-yellow-400';
      case 'Pass':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  }

  downloadReport(): void {
    // Implementation for downloading the report
    console.log('Download report functionality');
  }

  shareReport(): void {
    // Implementation for sharing the report
    console.log('Share report functionality');
  }
}
