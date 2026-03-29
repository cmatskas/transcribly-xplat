/**
 * Pipeline templates — built-in agent pipeline configurations.
 * Each template defines a sequence of agents with model, skills, tools, and system prompts.
 */

const MODELS = {
  opus: 'us.anthropic.claude-opus-4-6-v1',
  sonnet: 'us.anthropic.claude-sonnet-4-6-v1',
  nova: 'us.amazon.nova-pro-v1:0',
};

const TEMPLATES = {
  article: {
    id: 'article',
    name: 'Article / Blog Post',
    description: 'Research, outline, write, edit, and format a professional article',
    icon: 'bi-newspaper',
    agents: [
      { id: 'researcher', label: 'Researcher', model: MODELS.sonnet, skills: ['research-first', 'customer-research'], tools: ['web'],
        prompt: 'You are a research specialist. Given the user\'s topic, conduct thorough research using the web tool. Find authoritative sources, key statistics, expert opinions, and recent developments. Output a structured research brief with sections: Key Findings, Supporting Data, Source URLs, and Suggested Angles.' },
      { id: 'planner', label: 'Outliner', model: MODELS.sonnet, skills: ['task-planner', 'analysis-framework'], tools: [], reviewPoint: true,
        prompt: 'You are a content strategist. Using the research brief, create a detailed article outline: 3 title options, hook/intro strategy, section structure with key points, conclusion approach, and target word count per section.' },
      { id: 'quality-gate-1', label: 'Quality Check', model: MODELS.opus, tools: [], isQualityGate: true, maxRetries: 2, skills: ['copy-editing'],
        prompt: 'Evaluate the outline. Check: (1) addresses the brief completely, (2) logical structure, (3) no gaps in argument flow, (4) appropriate depth. If ALL pass: respond with "PASS" then the outline unchanged. If ANY fail: respond with "REVISE:" then specific feedback.' },
      { id: 'writer', label: 'Writer', model: MODELS.opus, skills: ['copywriting', 'marketing-psychology', 'doc-coauthoring'], tools: ['execute_code'],
        prompt: 'You are an expert writer. Follow the outline precisely. Write the full article matching the specified tone and audience. Use research to support claims with specific data. Maintain natural, engaging flow. Do not use AI-typical phrases or filler. Use execute_code if you need to process data or generate charts.' },
      { id: 'editor', label: 'Editor', model: MODELS.sonnet, skills: ['copy-editing', 'analysis-framework', 'marketing-psychology'], tools: [],
        prompt: 'You are a professional editor. Apply the Eight Sweeps framework from your copy-editing skill, starting with Sweep 0 (de-slop). Review for: clarity, grammar, tone consistency, logical structure, redundancy, and factual accuracy against the research. Make direct improvements. Output the complete improved version.' },
      { id: 'quality-gate-2', label: 'Final Check', model: MODELS.opus, tools: [], isQualityGate: true, maxRetries: 2, skills: ['copy-editing'],
        prompt: 'Evaluate the edited article using the de-slop checklist from your copy-editing skill. Check: (1) addresses the brief, (2) free of all 22 AI slop patterns, (3) specific not generic, (4) right length/depth. If ALL pass: respond with "PASS" then the article unchanged. If ANY fail: respond with "REVISE:" then specific feedback referencing which patterns were found.' },
      { id: 'formatter', label: 'Formatter', model: MODELS.nova, skills: ['docx'], tools: ['execute_code', 'save_file_locally'],
        prompt: 'Format the final article as a professional Word document (.docx) with: title, heading hierarchy, styled paragraphs, and page numbers. Use execute_code to run python-docx code, save to /tmp/, then use save_file_locally to deliver it to the user.' },
    ],
    edges: [['researcher','planner'],['planner','quality-gate-1'],['quality-gate-1','writer'],['writer','editor'],['editor','quality-gate-2'],['quality-gate-2','formatter']],
  },

  keynote: {
    id: 'keynote',
    name: 'Keynote / Presentation',
    description: 'Research, outline, write speaker notes, and create a slide deck',
    icon: 'bi-easel',
    agents: [
      { id: 'researcher', label: 'Researcher', model: MODELS.sonnet, skills: ['research-first'], tools: ['web'],
        prompt: 'You are a presentation research specialist. Use the web tool to find compelling data points, statistics, quotes, case studies, and visual concepts for slides. Output: key statistics, memorable quotes, story angles, and visual metaphors.' },
      { id: 'planner', label: 'Slide Planner', model: MODELS.sonnet, skills: ['task-planner', 'analysis-framework'], tools: [], reviewPoint: true,
        prompt: 'Create a slide-by-slide plan: title slide, content slides with key message + supporting points, transitions, and closing. Include speaker note guidelines and visual suggestions per slide.' },
      { id: 'quality-gate-1', label: 'Quality Check', model: MODELS.opus, tools: [], isQualityGate: true, maxRetries: 2, skills: ['copy-editing'],
        prompt: 'Evaluate the slide plan. Check: (1) clear narrative arc, (2) slides are scannable not text-heavy, (3) logical flow, (4) appropriate slide count. If ALL pass: "PASS" then plan unchanged. If ANY fail: "REVISE:" then feedback.' },
      { id: 'writer', label: 'Content Writer', model: MODELS.opus, skills: ['copywriting', 'marketing-psychology', 'doc-coauthoring'], tools: ['execute_code'],
        prompt: 'For each slide write: the title, 3-5 concise bullet points (short impactful phrases, not sentences), and detailed speaker notes (conversational, with timing cues and transitions). Keep slide text minimal.' },
      { id: 'editor', label: 'Editor', model: MODELS.sonnet, skills: ['copy-editing', 'analysis-framework', 'marketing-psychology'], tools: [],
        prompt: 'Apply the Eight Sweeps framework starting with Sweep 0 (de-slop). Calibrate to creative/inspirational register — preserve vivid imagery and rhetorical devices, strip only dead giveaway AI patterns. Review for: message clarity, consistent tone, logical flow, appropriate detail level, and compelling speaker notes. Output the complete improved version.' },
      { id: 'quality-gate-2', label: 'Final Check', model: MODELS.opus, tools: [], isQualityGate: true, maxRetries: 2, skills: ['copy-editing'],
        prompt: 'Evaluate using the de-slop checklist at creative/inspirational register. Check: (1) addresses brief, (2) no Tier 1 AI vocabulary, (3) slides scannable, (4) speaker notes conversational. Preserve intentional rhetorical devices. If ALL pass: "PASS" then content unchanged. If ANY fail: "REVISE:" then feedback referencing specific patterns.' },
      { id: 'formatter', label: 'Slide Creator', model: MODELS.nova, skills: ['pptx'], tools: ['execute_code', 'save_file_locally'],
        prompt: 'Create a professional PowerPoint (.pptx) from the final slides and notes. Use execute_code to run python-pptx code with clean modern layout, consistent fonts, proper slide masters, speaker notes. Save to /tmp/ then use save_file_locally to deliver it.' },
    ],
    edges: [['researcher','planner'],['planner','quality-gate-1'],['quality-gate-1','writer'],['writer','editor'],['editor','quality-gate-2'],['quality-gate-2','formatter']],
  },

  speech: {
    id: 'speech',
    name: 'Speech / Talk',
    description: 'Research, outline, write, and polish a speech with timing notes',
    icon: 'bi-mic',
    agents: [
      { id: 'researcher', label: 'Researcher', model: MODELS.sonnet, skills: ['research-first'], tools: ['web'],
        prompt: 'Use the web tool to find compelling stories, anecdotes, data points, and quotes suitable for spoken delivery. Focus on emotional resonance and memorability. Output: key stories, supporting data, memorable quotes, audience engagement hooks.' },
      { id: 'planner', label: 'Speech Architect', model: MODELS.sonnet, skills: ['task-planner', 'analysis-framework'], tools: [], reviewPoint: true,
        prompt: 'Design the speech structure: opening hook, 3-4 main points with evidence, transitions, callbacks to opening, memorable closing. Include timing estimates per section. Specify where to use pauses, humor, or audience interaction.' },
      { id: 'quality-gate-1', label: 'Quality Check', model: MODELS.opus, tools: [], isQualityGate: true, maxRetries: 2, skills: ['copy-editing'],
        prompt: 'Evaluate the speech outline. Check: (1) strong opening hook, (2) clear argument flow, (3) timing adds up to target duration, (4) memorable closing. If ALL pass: "PASS" then outline unchanged. If ANY fail: "REVISE:" then feedback.' },
      { id: 'writer', label: 'Speechwriter', model: MODELS.opus, skills: ['copywriting', 'doc-coauthoring', 'marketing-psychology'], tools: [],
        prompt: 'Write the full speech as spoken aloud. Conversational language, short sentences, rhetorical devices, natural rhythm. Include [PAUSE], [LOOK AT AUDIENCE], [GESTURE] stage directions. Include [~2 min] timing marks at section boundaries. Write for the ear, not the eye.' },
      { id: 'editor', label: 'Editor', model: MODELS.sonnet, skills: ['copy-editing', 'analysis-framework', 'marketing-psychology'], tools: [],
        prompt: 'Apply the Eight Sweeps at inspirational register — preserve rhetorical devices, vivid imagery, and emotional language. Strip only dead giveaway AI patterns. Edit for: speakability (no tongue-twisters), pacing (vary sentence length), clarity, emotional arc, and timing fit. Output the complete polished speech.' },
      { id: 'quality-gate-2', label: 'Final Check', model: MODELS.opus, tools: [], isQualityGate: true, maxRetries: 2, skills: ['copy-editing'],
        prompt: 'Evaluate using the de-slop checklist at inspirational register. Check: (1) sounds natural spoken aloud, (2) no Tier 1 AI vocabulary, (3) emotional arc works, (4) fits target duration. Preserve intentional rhetorical craft. If ALL pass: "PASS" then speech unchanged. If ANY fail: "REVISE:" then feedback.' },
    ],
    edges: [['researcher','planner'],['planner','quality-gate-1'],['quality-gate-1','writer'],['writer','editor'],['editor','quality-gate-2']],
  },
};

function getTemplate(id) { return TEMPLATES[id] || null; }

function getAllTemplates() {
  return Object.values(TEMPLATES).map(({ id, name, description, icon, agents }) => ({
    id, name, description, icon, agentCount: agents.length,
  }));
}

module.exports = { getTemplate, getAllTemplates, MODELS };
