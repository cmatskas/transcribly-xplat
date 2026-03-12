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
4. Synthesize findings across multiple sources

## Tips
- Content is returned as text — images and interactive elements are not captured
- Large pages are truncated (15K chars for direct URLs, 10K for search results)
- The browser session persists across multiple calls — no need to restart between pages
