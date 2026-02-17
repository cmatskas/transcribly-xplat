#!/usr/bin/env node

/**
 * Validation script to check if Bedrock testing prerequisites are met
 * Run this before executing the Bedrock integration tests
 */

const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const { bedrockModels, defaultPrompts, region } = require('../../config.js');

async function validateSetup() {
  console.log('🔍 Validating Bedrock Test Setup...\n');
  
  let allChecksPass = true;
  
  // Check 1: Credentials file exists
  console.log('1. Checking AWS credentials...');
  const credentialsPath = path.join(os.homedir(), '.transcribely', 'credentials.json');
  try {
    const credData = await fs.readFile(credentialsPath, 'utf8');
    const credentials = JSON.parse(credData);
    
    if (credentials.accessKeyId && credentials.secretAccessKey) {
      console.log('   ✅ Credentials file found and valid');
      console.log(`   📍 Location: ${credentialsPath}`);
      console.log(`   🔑 Access Key: ${credentials.accessKeyId.substring(0, 8)}...`);
    } else {
      console.log('   ❌ Credentials file exists but missing required fields');
      allChecksPass = false;
    }
  } catch (error) {
    console.log('   ❌ Credentials file not found or invalid');
    console.log(`   📍 Expected location: ${credentialsPath}`);
    console.log('   💡 Configure credentials in the Transcribely app first');
    allChecksPass = false;
  }
  
  // Check 2: AWS SDK dependencies
  console.log('\n2. Checking AWS SDK dependencies...');
  try {
    require('@aws-sdk/client-bedrock-runtime');
    require('@aws-sdk/client-bedrock-agent-runtime');
    console.log('   ✅ AWS SDK packages installed');
  } catch (error) {
    console.log('   ❌ AWS SDK packages not found');
    console.log('   💡 Run: npm install');
    allChecksPass = false;
  }
  
  // Check 3: Jest installed
  console.log('\n3. Checking Jest test framework...');
  try {
    require('jest');
    console.log('   ✅ Jest installed');
  } catch (error) {
    console.log('   ❌ Jest not found');
    console.log('   💡 Run: npm install');
    allChecksPass = false;
  }
  
  // Check 4: Config validation
  console.log('\n4. Validating configuration...');
  console.log(`   ✅ Region: ${region}`);
  console.log(`   ✅ Models configured: ${bedrockModels.length}`);
  bedrockModels.forEach(model => {
    console.log(`      - ${model.id} (${model.inferenceProfileId})`);
  });
  console.log(`   ✅ Prompts configured: ${defaultPrompts.filter(p => p.id !== 'Custom Prompt').length}`);
  defaultPrompts.filter(p => p.id !== 'Custom Prompt').forEach(prompt => {
    console.log(`      - ${prompt.id}`);
  });
  
  // Check 5: Test file exists
  console.log('\n5. Checking test files...');
  const testFilePath = path.join(__dirname, 'bedrock-llm.test.js');
  try {
    await fs.access(testFilePath);
    console.log('   ✅ Test file found');
    console.log(`   📄 ${testFilePath}`);
  } catch (error) {
    console.log('   ❌ Test file not found');
    allChecksPass = false;
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  if (allChecksPass) {
    console.log('✅ All checks passed! Ready to run Bedrock tests.');
    console.log('\nNext steps:');
    console.log('  • Quick test:  npm run test:bedrock-quick');
    console.log('  • Full suite:  npm run test:bedrock');
    console.log('\n⚠️  Remember: These tests make real API calls and incur AWS costs');
  } else {
    console.log('❌ Some checks failed. Please fix the issues above before running tests.');
    console.log('\nCommon fixes:');
    console.log('  • Install dependencies: npm install');
    console.log('  • Configure AWS credentials in the Transcribely app');
    console.log('  • Ensure you have Bedrock model access in AWS Console');
    process.exit(1);
  }
  console.log('='.repeat(60) + '\n');
}

// Run validation
validateSetup().catch(error => {
  console.error('\n❌ Validation failed:', error.message);
  process.exit(1);
});
