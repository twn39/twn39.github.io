import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ site }) => {
  const origin = site?.origin || 'https://espresso-lab.github.io';

  const body = [
    `# Espresso Engineering Lab — Search & AI Agent Indexing Policy`,
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
    `User-agent: Claude-Web`,
    `Allow: /`,
    ``,
    `User-agent: PerplexityBot`,
    `Allow: /`,
    ``,
    `User-agent: Google-Extended`,
    `Allow: /`,
    ``,
    `User-agent: Applebot-Extended`,
    `Allow: /`,
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
