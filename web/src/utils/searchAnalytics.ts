// Search Analytics Utility
// Provides basic tracking for search mode usage and query types

export interface SearchAnalyticsEvent {
  mode: "legacy" | "advanced";
  queryType: string;
  resultCount: number;
  avgScore: number;
  timestamp: string;
  query: string;
  hasDocuments: boolean;
  hasSlack: boolean;
}

class SearchAnalytics {
  private events: SearchAnalyticsEvent[] = [];
  private maxEvents = 100; // Keep last 100 events in memory

  trackSearch(event: SearchAnalyticsEvent) {
    this.events.push(event);
    
    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Store in localStorage for persistence
    try {
      localStorage.setItem('searchAnalytics', JSON.stringify(this.events));
    } catch (error) {
      console.warn('Failed to store search analytics:', error);
    }

    // Log for debugging (in development)
    if (import.meta.env.DEV) {
      console.log('Search Analytics:', event);
    }
  }

  getRecentSearches(limit = 10): SearchAnalyticsEvent[] {
    return this.events.slice(-limit);
  }

  getSearchStats() {
    if (this.events.length === 0) return null;

    const advancedSearches = this.events.filter(e => e.mode === "advanced").length;
    const legacySearches = this.events.filter(e => e.mode === "legacy").length;
    const avgResultCount = this.events.reduce((sum, e) => sum + e.resultCount, 0) / this.events.length;
    const avgScore = this.events.reduce((sum, e) => sum + e.avgScore, 0) / this.events.length;

    return {
      totalSearches: this.events.length,
      advancedSearches,
      legacySearches,
      avgResultCount: Math.round(avgResultCount),
      avgScore: Math.round(avgScore * 100) / 100,
      advancedUsagePercent: Math.round((advancedSearches / this.events.length) * 100)
    };
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem('searchAnalytics');
      if (stored) {
        this.events = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load search analytics:', error);
      this.events = [];
    }
  }

  clearAnalytics() {
    this.events = [];
    try {
      localStorage.removeItem('searchAnalytics');
    } catch (error) {
      console.warn('Failed to clear search analytics:', error);
    }
  }
}

// Export singleton instance
export const searchAnalytics = new SearchAnalytics();

// Initialize from storage
searchAnalytics.loadFromStorage();

// Helper function to classify query type
export function classifyQuery(query: string): string {
  const lowerQuery = query.toLowerCase();

  if (/\b(how to|implement|build|create|setup|configure)\b/.test(lowerQuery)) {
    return 'Implementation Question';
  }

  if (/\b(discuss|conversation|talk|said|mentioned|decided)\b/.test(lowerQuery)) {
    return 'Discussion Question';
  }

  if (/\b(yesterday|today|last week|recently|latest|recent)\b/.test(lowerQuery)) {
    return 'Temporal Query';
  }

  if (/\b(error|bug|issue|problem|fix)\b/.test(lowerQuery)) {
    return 'Troubleshooting';
  }

  if (/\b(what|who|when|where|why)\b/.test(lowerQuery)) {
    return 'Information Query';
  }

  return 'General Query';
}

// Helper to track search performance
export function trackSearchUsage(
  mode: "legacy" | "advanced", 
  query: string, 
  results: any[], 
  avgScore: number
) {
  const queryType = classifyQuery(query);
  const hasDocuments = results.some(r => r.source === "document" || !r.channel_id);
  const hasSlack = results.some(r => r.source === "slack" || r.channel_id);

  searchAnalytics.trackSearch({
    mode,
    queryType,
    resultCount: results.length,
    avgScore,
    timestamp: new Date().toISOString(),
    query: query.substring(0, 100), // Store first 100 chars for privacy
    hasDocuments,
    hasSlack
  });
}