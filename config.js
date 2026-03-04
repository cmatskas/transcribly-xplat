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
        id: "Claude 4.6 Sonnet",
        inferenceProfileId: "us.anthropic.claude-sonnet-4-6"
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

module.exports = {
    port,
    transcriptionLanguage,
    defaultTheme,
    bucketName,
    outputBucketName,
    region,
    bedrockModels
};
