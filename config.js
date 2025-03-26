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
const bedrockInferenceProfileArn = 'arn:aws:bedrock:us-east-1:544610684157:inference-profile/us.anthropic.claude-3-7-sonnet-20250219-v1:0';

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
    bedrockInferenceProfileArn
};