---
name: doc-coauthoring
description: "Guide users through collaborative document creation with a structured workflow. Use when the user wants to write documentation, proposals, technical specs, decision docs, PR/FAQs, blog posts, or any structured content. Trigger when user mentions 'write a doc,' 'draft a proposal,' 'create a spec,' 'write up,' 'PRD,' 'design doc,' 'decision doc,' 'RFC,' 'PR/FAQ,' 'help me write,' or 'turn this into a document.'"
metadata:
  version: "1.0"
---

# Doc Co-Authoring Workflow

Guide users through three stages of collaborative document creation: Context Gathering, Refinement & Structure, and Reader Testing.

## When to Offer This Workflow

Offer when the user is starting a substantial writing task. Explain the three stages:
1. **Context Gathering** — user provides all relevant context while you ask clarifying questions
2. **Refinement & Structure** — iteratively build each section through brainstorming and editing
3. **Reader Testing** — test the doc against likely reader questions to catch blind spots

Ask if they want the structured workflow or prefer to work freeform.

## Stage 1: Context Gathering

**Goal:** Close the gap between what the user knows and what you know.

### Initial Questions
1. What type of document is this? (spec, decision doc, proposal, PR/FAQ, blog post)
2. Who's the primary audience?
3. What's the desired impact when someone reads this?
4. Is there a template or specific format to follow?
5. Any constraints or context to know?

Tell them they can answer in shorthand or dump information however works best.

### If the user provides files
Use `read_local_file` to load any documents, transcripts, or reference materials they mention. If they provide a transcript or meeting notes, extract the key context before asking clarifying questions.

### Info Dumping
Encourage the user to dump all context they have:
- Background on the project/problem
- Related discussions or documents
- Why alternative approaches aren't being used
- Organizational context (team dynamics, stakeholder concerns)
- Timeline pressures or constraints
- Technical dependencies

Tell them not to worry about organizing it — just get it all out.

### Clarifying Questions
When the user signals they've done their initial dump, ask 5-10 numbered clarifying questions based on gaps. Tell them they can use shorthand to answer (e.g., "1: yes, 2: no because backwards compat, 3: not sure yet").

**Exit condition:** Sufficient context when you can ask about edge cases and trade-offs without needing basics explained.

**Transition:** Ask if there's more context to provide, or if it's time to start drafting.

## Stage 2: Refinement & Structure

**Goal:** Build the document section by section through brainstorming, curation, and iterative refinement.

### Agree on Structure
If the user doesn't know what sections they need, suggest 3-5 sections appropriate for the doc type. Ask if the structure works or needs adjustment.

Suggest starting with whichever section has the most unknowns. Summary sections are best left for last.

### For Each Section

**Step 1: Clarifying Questions**
Ask 5-10 specific questions about what should be included in this section.

**Step 2: Brainstorming**
Generate 5-20 numbered options for what to include, depending on complexity. Look for:
- Context the user shared that might have been forgotten
- Angles or considerations not yet mentioned

**Step 3: Curation**
Ask which points to keep, remove, or combine. Examples:
- "Keep 1,4,7,9"
- "Remove 3 (duplicates 1)"
- "Combine 11 and 12"

**Step 4: Gap Check**
Ask if anything important is missing for this section.

**Step 5: Drafting**
Write the section based on their selections. After drafting, ask them to read through and indicate what to change.

Tell the user: instead of rewriting sections themselves, describe what to change. This helps you learn their style for future sections. For example: "Remove the X bullet — already covered by Y" or "Make the third paragraph more concise."

**Step 6: Iterate**
Make surgical edits based on feedback. Continue until the user is satisfied. After 3 iterations with no substantial changes, ask if anything can be removed without losing important information.

### Near Completion
When 80%+ of sections are done, re-read the entire document and check for:
- Flow and consistency across sections
- Redundancy or contradictions
- Generic filler that doesn't carry weight
- Whether every sentence earns its place

## Stage 3: Reader Testing

**Goal:** Test the document against likely reader questions to catch blind spots.

### Step 1: Predict Reader Questions
Generate 5-10 questions that readers would realistically ask when encountering this document. What would they search for? What would they ask a colleague?

### Step 2: Self-Test
For each question, answer it using only the document content. Be honest about where the doc is unclear, assumes too much context, or doesn't actually answer the question.

### Step 3: Additional Checks
Review the document for:
- Ambiguity or unclear language
- Knowledge the doc assumes readers already have
- Internal contradictions or inconsistencies
- Claims without supporting evidence

### Step 4: Fix Gaps
Report what failed and loop back to Stage 2 refinement for problematic sections.

**Exit condition:** All predicted reader questions are answered clearly by the document.

## Final Review

When reader testing passes:
1. Recommend the user do a final read-through — they own this document
2. Suggest double-checking facts, links, and technical details
3. Ask if it achieves the impact they wanted

If the user wants the document exported, use `execute_code` to generate it as .docx, .md, or .pptx via the appropriate library, then `save_file_locally` to deliver it.

## Tips

- Be direct and procedural — don't sell the approach, just execute it
- If the user wants to skip a stage, let them
- Don't let context gaps accumulate — address them as they come up
- Quality over speed — each iteration should make meaningful improvements
