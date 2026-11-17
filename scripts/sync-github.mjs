#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GITHUB_LOGIN = process.env.GITHUB_USERNAME || 'twn39';

const GRAPHQL_QUERY = `
query($login: String!) {
  user(login: $login) {
    login
    name
    bio
    location
    url
    avatarUrl
    followers {
      totalCount
    }
    repositories(privacy: PUBLIC, ownerAffiliations: OWNER, first: 100, orderBy: {field: STARGAZERS, direction: DESC}) {
      totalCount
      nodes {
        stargazerCount
      }
    }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
            contributionLevel
            weekday
          }
        }
      }
    }
  }
}
`;

const LEVEL_MAP = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

function main() {
  const raw = execFileSync(
    'gh',
    ['api', 'graphql', '-F', `login=${GITHUB_LOGIN}`, '-f', `query=${GRAPHQL_QUERY}`],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const parsed = JSON.parse(raw);
  const user = parsed?.data?.user;
  if (!user) {
    throw new Error(`Failed to fetch GitHub user '${GITHUB_LOGIN}' via gh CLI`);
  }

  const totalStars = (user.repositories?.nodes || []).reduce(
    (sum, repo) => sum + (repo.stargazerCount || 0),
    0
  );

  const calendar = user.contributionsCollection.contributionCalendar;
  const payload = {
    fetchedAt: new Date().toISOString(),
    login: user.login,
    name: user.name || user.login,
    bio: user.bio || '',
    location: user.location || '',
    url: user.url || `https://github.com/${user.login}`,
    avatarUrl: user.avatarUrl || '',
    followers: user.followers?.totalCount || 0,
    publicRepos: user.repositories?.totalCount || 0,
    totalStars,
    totalContributions: calendar.totalContributions,
    weeks: calendar.weeks.map((week) =>
      week.contributionDays.map((day) => ({
        date: day.date,
        count: day.contributionCount,
        level: LEVEL_MAP[day.contributionLevel] ?? 0,
        weekday: day.weekday,
      }))
    ),
  };

  const outPath = resolve(__dirname, '../src/data/github-profile.json');
  writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(
    `[sync-github] Synced @${payload.login} (${payload.name}): ${payload.totalContributions} contributions, ${payload.publicRepos} public repos, ★ ${payload.totalStars}`
  );
}

main();
