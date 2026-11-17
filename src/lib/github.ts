import fallbackProfile from '../data/github-profile.json';

export interface ContributionDay {
  date: string;
  count: number;
  level: number;
  weekday: number;
}

export interface GitHubUserProfile {
  fetchedAt: string;
  login: string;
  name: string;
  bio: string;
  location: string;
  url: string;
  avatarUrl: string;
  followers: number;
  publicRepos: number;
  totalStars: number;
  totalContributions: number;
  weeks: ContributionDay[][];
}

export function getGitHubUserProfile(_login = 'twn39'): GitHubUserProfile {
  return fallbackProfile as GitHubUserProfile;
}
