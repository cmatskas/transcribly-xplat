---
name: web-browse
description: "Search the web and extract content from websites. Use when the user asks to look up information, research a topic, read a webpage, check documentation, or find current data online."
metadata:
  provider: agentcore-browser
  version: "1.0"
---

# Web Browsing

You have one tool for all web access: `web`

## Usage

Pass either a `url` or a `query` (or both):

- `{ query: "python-docx latest version" }` → searches Google, returns results
- `{ url: "https://pypi.org/project/python-docx/" }` → navigates directly, returns page content
- Search first, then browse specific URLs from the results for deeper content

## Research workflow

For deep research tasks:
1. Call `web` with a `query` to search Google
2. Read the search results — identify the most relevant URLs
3. Call `web` with each relevant `url` to read the full content
4. Check social media and community sources for additional perspectives:
   - **Reddit**: Search `site:reddit.com <topic>` for discussions, opinions, and real-world experiences
   - **X/Twitter**: Browse `https://x.com/search?q=<topic>` for recent takes and announcements
   - **LinkedIn**: Search `site:linkedin.com <topic>` for professional insights and industry perspectives
   - **Bluesky**: Browse `https://bsky.app/search?q=<topic>` for emerging discussions
5. Synthesize findings across all sources — articles, social media, and community threads

## Tips
- Content is returned as text — images and interactive elements are not captured
- Large pages are truncated (15K chars for direct URLs, 10K for search results)
- The browser session persists across multiple calls — no need to restart between pages
