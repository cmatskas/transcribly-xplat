const port = process.env.PORT || 3000;
const maxFileSize = 100 * 1024 * 1024;
const allowedFormats = ['mp4', 'mov', 'avi'];
const transcriptionLanguage = 'en-US';
const defaultTheme = 'light';
const maxTranscriptLength = 1000;
const refreshInterval = 5000;
const bucketName = 'transcriptionfiles2';
const outputBucketName = 'cmtranscriptionresults';
const region = 'us-east-1';
const timeout = 30000;
const retryAttempts = 3;
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
    maxFileSize,
    allowedFormats,
    transcriptionLanguage,
    defaultTheme,
    maxTranscriptLength,
    refreshInterval,
    bucketName,
    outputBucketName,
    region,
    timeout,
    retryAttempts,
    bedrockModels,
    defaultPrompts
};