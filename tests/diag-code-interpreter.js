/**
 * Diagnostic script for AgentCore Code Interpreter connectivity.
 * Tests: credentials, permissions, session lifecycle, code execution.
 */
const { BedrockAgentCoreClient, StartCodeInterpreterSessionCommand, InvokeCodeInterpreterCommand, StopCodeInterpreterSessionCommand } = require('@aws-sdk/client-bedrock-agentcore');

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

async function run() {
  console.log(`\n=== AgentCore Code Interpreter Diagnostics ===`);
  console.log(`Region: ${region}`);
  console.log(`AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '***' + process.env.AWS_ACCESS_KEY_ID.slice(-4) : 'NOT SET'}`);
  console.log(`AWS_SESSION_TOKEN: ${process.env.AWS_SESSION_TOKEN ? 'SET' : 'NOT SET'}\n`);

  const client = new BedrockAgentCoreClient({ region });
  let sessionId = null;

  // Test 1: Start session
  console.log('1. Starting Code Interpreter session...');
  try {
    const resp = await client.send(new StartCodeInterpreterSessionCommand({
      codeInterpreterIdentifier: 'aws.codeinterpreter.v1',
      name: `diag-${Date.now()}`,
      sessionTimeoutSeconds: 300,
    }));
    sessionId = resp.sessionId;
    console.log(`   ✅ Session started: ${sessionId}\n`);
  } catch (err) {
    console.log(`   ❌ FAILED: ${err.name}: ${err.message}`);
    if (err.name === 'AccessDeniedException') {
      console.log('   → Missing IAM permissions. Required actions:');
      console.log('     bedrock-agentcore:StartCodeInterpreterSession');
      console.log('     bedrock-agentcore:InvokeCodeInterpreter');
      console.log('     bedrock-agentcore:StopCodeInterpreterSession');
    }
    if (err.name === 'UnrecognizedClientException' || err.message.includes('security token')) {
      console.log('   → Credentials issue. Check AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN');
    }
    console.log(`   Full error: ${JSON.stringify({ name: err.name, code: err.$metadata?.httpStatusCode }, null, 2)}`);
    return;
  }

  // Test 2: Execute simple code
  console.log('2. Executing test code: print("hello")...');
  try {
    const resp = await client.send(new InvokeCodeInterpreterCommand({
      codeInterpreterIdentifier: 'aws.codeinterpreter.v1',
      sessionId,
      name: 'executeCode',
      arguments: { language: 'python', code: 'print("hello from sandbox")' },
    }));
    const results = [];
    for await (const event of resp.stream) {
      if (event.result?.content) {
        for (const item of event.result.content) {
          results.push(item);
        }
      }
    }
    console.log(`   ✅ Output:`, results.map(r => r.text || r.error || JSON.stringify(r)).join('\n   '));
    console.log();
  } catch (err) {
    console.log(`   ❌ FAILED: ${err.name}: ${err.message}\n`);
  }

  // Test 3: pip install
  console.log('3. Testing pip install (python-docx)...');
  try {
    const resp = await client.send(new InvokeCodeInterpreterCommand({
      codeInterpreterIdentifier: 'aws.codeinterpreter.v1',
      sessionId,
      name: 'executeCode',
      arguments: { language: 'python', code: 'import subprocess; r = subprocess.run(["pip", "install", "-q", "python-docx"], capture_output=True, text=True); print(r.stdout[-200:] if r.stdout else "no output"); print(r.stderr[-200:] if r.stderr else "")' },
    }));
    for await (const event of resp.stream) {
      if (event.result?.content) {
        for (const item of event.result.content) {
          console.log(`   ${item.type === 'error' ? '❌' : '✅'} ${item.text || item.error || ''}`);
        }
      }
    }
    console.log();
  } catch (err) {
    console.log(`   ❌ FAILED: ${err.name}: ${err.message}\n`);
  }

  // Test 4: Stop session
  console.log('4. Stopping session...');
  try {
    await client.send(new StopCodeInterpreterSessionCommand({
      codeInterpreterIdentifier: 'aws.codeinterpreter.v1',
      sessionId,
    }));
    console.log('   ✅ Session stopped\n');
  } catch (err) {
    console.log(`   ❌ FAILED: ${err.name}: ${err.message}\n`);
  }

  console.log('=== Diagnostics complete ===\n');
}

run().catch(err => console.error('Fatal:', err));
