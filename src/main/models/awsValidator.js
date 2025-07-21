const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
const { BedrockClient, ListFoundationModelsCommand } = require('@aws-sdk/client-bedrock');
const { TranscribeClient, ListTranscriptionJobsCommand } = require('@aws-sdk/client-transcribe');

class AWSValidator {
  constructor(credentials) {
    this.credentials = credentials;
  }

  async validateCredentials() {
    const results = {
      valid: false,
      identity: null,
      permissions: {
        bedrock: false,
        transcribe: false
      },
      errors: []
    };

    try {
      // Test basic AWS credentials with STS
      const stsClient = new STSClient({
        region: this.credentials.region,
        credentials: {
          accessKeyId: this.credentials.accessKeyId,
          secretAccessKey: this.credentials.secretAccessKey,
          sessionToken: this.credentials.sessionToken
        }
      });

      const identityCommand = new GetCallerIdentityCommand({});
      const identity = await stsClient.send(identityCommand);
      
      results.identity = {
        userId: identity.UserId,
        account: identity.Account,
        arn: identity.Arn
      };
      results.valid = true;

      // Test Bedrock permissions
      try {
        const bedrockClient = new BedrockClient({
          region: this.credentials.region,
          credentials: {
            accessKeyId: this.credentials.accessKeyId,
            secretAccessKey: this.credentials.secretAccessKey,
            sessionToken: this.credentials.sessionToken
          }
        });

        const bedrockCommand = new ListFoundationModelsCommand({});
        await bedrockClient.send(bedrockCommand);
        results.permissions.bedrock = true;
      } catch (error) {
        results.errors.push(`Bedrock access denied: ${error.message}`);
      }

      // Test Transcribe permissions
      try {
        const transcribeClient = new TranscribeClient({
          region: this.credentials.region,
          credentials: {
            accessKeyId: this.credentials.accessKeyId,
            secretAccessKey: this.credentials.secretAccessKey,
            sessionToken: this.credentials.sessionToken
          }
        });

        const transcribeCommand = new ListTranscriptionJobsCommand({ MaxResults: 1 });
        await transcribeClient.send(transcribeCommand);
        results.permissions.transcribe = true;
      } catch (error) {
        results.errors.push(`Transcribe access denied: ${error.message}`);
      }

    } catch (error) {
      results.errors.push(`Invalid AWS credentials: ${error.message}`);
    }

    return results;
  }

  static getRequiredPermissions() {
    return {
      bedrock: [
        'bedrock:ListFoundationModels',
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream'
      ],
      transcribe: [
        'transcribe:StartTranscriptionJob',
        'transcribe:GetTranscriptionJob',
        'transcribe:ListTranscriptionJobs'
      ],
      s3: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject'
      ]
    };
  }
}

module.exports = AWSValidator;