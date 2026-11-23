import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ site }) => {
  const origin = site?.origin || 'https://twn39.github.io';

  const body = [
    `# BitesBytes Lab — Search & AI Agent Indexing Policy`,
    `User-agent: *`,
    `Allow: /`,
    ``,
    `# Explicitly welcome AI Search & Coding Agent Crawlers`,
    `User-agent: GPTBot`,
    `Allow: /`,
    ``,
    `User-agent: OAI-SearchBot`,
    `Allow: /`,
    ``,
    `User-agent: ChatGPT-User`,
    `Allow: /`,
    ``,
    `User-agent: ClaudeBot`,
    `Allow: /`,
    ``,
    `User-agent: Claude-SearchBot`,
    `Allow: /`,
    ``,
    `User-agent: Claude-User`,
    `Allow: /`,
    ``,
    `User-agent: Claude-Web`,
    `Allow: /`,
    ``,
    `User-agent: PerplexityBot`,
    `Allow: /`,
    ``,
    `User-agent: Perplexity-User`,
    `Allow: /`,
    ``,
    `User-agent: Google-Extended`,
    `Allow: /`,
    ``,
    `User-agent: Applebot-Extended`,
    `Allow: /`,
    ``,
    `Sitemap: ${origin}/sitemap-index.xml`,
    ``,
    `# Structured LLM Context Endpoints (https://llmstxt.org)`,
    `# Concise directory: ${origin}/llms.txt`,
    `# Full Markdown corpus: ${origin}/llms-full.txt`,
    `# RSS Feed: ${origin}/rss.xml`,
    ``,
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
