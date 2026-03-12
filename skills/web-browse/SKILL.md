---
name: web-browse
description: "Search the web and extract content from websites. Use when the user asks to look up information, research a topic, read a webpage, check documentation, or find current data online."
metadata:
  provider: agentcore-browser
  version: "1.0"
---

# Web Browsing

You have two tools for web access:

## web_search
Search Google and get results with titles, URLs, and snippets. Use this when the user wants to find information on a topic.

Example: user asks "what's the latest version of python-docx?" → call `web_search` with query "python-docx latest version pypi"

## browse_web
Navigate to a specific URL and extract the page content as text. Use this when:
- You have a specific URL to read
- You want to follow up on a search result
- The user provides a link

Example: user says "read this page: https://example.com/docs" → call `browse_web` with that URL

## Tips
- Search first, then browse specific results for details
- For documentation lookups, search for the topic then browse the official docs URL
- Content is returned as text — images and interactive elements are not captured
- Page content is truncated at 15,000 characters for large pages
