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
        inferenceArn: "arn:aws:bedrock:us-east-1:544610684157:inference-profile/us.amazon.nova-pro-v1:0"
    },
    {
        id: "Claude 3.7 Sonnet",
        inferenceArn: "arn:aws:bedrock:us-east-1:544610684157:inference-profile/us.anthropic.claude-3-7-sonnet-20250219-v1:0"
    },
    {
        id: "Claude 4.0 Sonnet",
        inferenceArn: "arn:aws:bedrock:us-east-1:544610684157:inference-profile/us.anthropic.claude-sonnet-4-20250514-v1:0"
    },
    {
        id: "DeepSeek R1",
        inferenceArn: "arn:aws:bedrock:us-east-1:544610684157:inference-profile/us.deepseek.r1-v1:0"
    },

];
const defaultPrompts = [
    {
        id: 'Summarize Text',
        prompt: 'Use this transcript to analyze the text'
    },
    {
        id: 'Analyze Sentiment',
        prompt: 'Use this transcript to analyze the sentiment'
    },
    {
        id: 'Extract key points',
        prompt: 'Use this transcript to extract the key points'
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