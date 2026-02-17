const port = process.env.PORT || 3000;
// These are now user-configurable through settings, kept as fallbacks
const transcriptionLanguage = 'en-US';
const defaultTheme = 'auto';
const region = 'us-east-1';
const bucketName = 'transcriptionfiles2';
const outputBucketName = 'cmtranscriptionresults';

const bedrockModels = [
    {
        id: "Nova Pro",
        inferenceProfileId: "us.amazon.nova-pro-v1:0"
    },
    {
        id: "Claude 4.5 Sonnet",
        inferenceProfileId: "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
    },
    {
        id: "Claude 4.6 Opus",
        inferenceProfileId: "us.anthropic.claude-opus-4-6-v1"
    },
    {
        id: "DeepSeek R1",
        inferenceProfileId: "us.deepseek.r1-v1:0"
    }
];

const defaultPrompts = [
    {
        id: 'Summarize Text',
        prompt: 'Analyze and summarize the following text, highlighting the key points and main themes.'
    },
    {
        id: 'Analyze Sentiment',
        prompt: 'Analyze the sentiment of the following text, identifying emotional tone, key attitudes, and overall sentiment.'
    },
    {
        id: 'Extract Key Points',
        prompt: 'Extract and list the key points, important insights, and main takeaways from the following text.'
    },
    {
        id: 'Generate Action Items',
        prompt: 'Identify and list actionable items, tasks, and next steps from the following text.'
    },
    {
        id: 'Custom Prompt',
        prompt: ''
    }
];

module.exports = {
    port,
    transcriptionLanguage,
    defaultTheme,
    bucketName,
    outputBucketName,
    region,
    bedrockModels,
    defaultPrompts
};
