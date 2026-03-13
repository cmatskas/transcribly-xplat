/**
 * Diagnostic: AgentCore Memory — create memory, save event, list events, retrieve records, cleanup.
 *
 * Usage: AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_REGION=us-east-1 node tests/diag-memory.js
 */

const {
  BedrockAgentCoreClient,
  CreateEventCommand,
  ListEventsCommand,
  RetrieveMemoryRecordsCommand,
} = require('@aws-sdk/client-bedrock-agentcore');

const {
  BedrockAgentCoreControlClient,
  CreateMemoryCommand,
  GetMemoryCommand,
  DeleteMemoryCommand,
  ListMemoriesCommand,
} = require('@aws-sdk/client-bedrock-agentcore-control');

const region = process.env.AWS_REGION || 'us-east-1';
const config = {
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  },
};

const data = new BedrockAgentCoreClient(config);
const control = new BedrockAgentCoreControlClient(config);

const TEST_NAME = `diagmemory${Date.now()}`;
const ACTOR = 'test-user';
const SESSION = `test-session-${Date.now()}`;

let memoryId = null;

async function run() {
  try {
    // 1. Create memory
    console.log('1. Creating memory resource...');
    const createRes = await control.send(new CreateMemoryCommand({
      name: TEST_NAME,
      description: 'Diagnostic test memory',
      strategies: [{ semanticMemoryStrategy: { name: 'Facts', namespaces: ['/test/'] } }],
      eventExpiryDuration: 7,
    }));
    memoryId = createRes.memory.id;
    console.log(`   ✅ Created: ${memoryId} (status: ${createRes.memory.status})`);

    // 2. Wait for ACTIVE
    console.log('2. Waiting for ACTIVE...');
    for (let i = 0; i < 60; i++) {
      const getRes = await control.send(new GetMemoryCommand({ memoryId }));
      const st = getRes.memory.status;
      if (st === 'ACTIVE') {
        console.log('   ✅ Memory is ACTIVE');
        break;
      }
      if (st === 'FAILED') throw new Error('Memory creation FAILED');
      if (i % 10 === 0) console.log(`   ... status: ${st}`);
      await new Promise(r => setTimeout(r, 5000));
    }

    // 3. Create event
    console.log('3. Creating event...');
    await data.send(new CreateEventCommand({
      memoryId,
      actorId: ACTOR,
      sessionId: SESSION,
      eventTimestamp: new Date(),
      payload: [
        { conversational: { content: { text: 'I prefer dark mode and concise answers' }, role: 'USER' } },
        { conversational: { content: { text: 'Noted! I will use dark mode and keep responses concise.' }, role: 'ASSISTANT' } },
      ],
    }));
    console.log('   ✅ Event created');

    // 4. List events
    console.log('4. Listing events...');
    const listRes = await data.send(new ListEventsCommand({
      memoryId,
      actorId: ACTOR,
      sessionId: SESSION,
      maxResults: 10,
      includePayloads: true,
    }));
    console.log(`   ✅ Found ${(listRes.events || []).length} event(s)`);

    // 5. Retrieve memory records (may be empty if extraction hasn't run)
    console.log('5. Retrieving memory records...');
    try {
      const retrieveRes = await data.send(new RetrieveMemoryRecordsCommand({
        memoryId,
        namespace: '/test/',
        searchCriteria: { searchQuery: 'dark mode preferences', topK: 5 },
      }));
      console.log(`   ✅ Retrieved ${(retrieveRes.memoryRecordSummaries || []).length} record(s) (may be 0 before extraction)`);
    } catch (err) {
      console.log(`   ⚠️  Retrieve: ${err.message} (expected if no extraction yet)`);
    }

    console.log('\n✅ All memory diagnostics passed!');

  } finally {
    // Cleanup
    if (memoryId) {
      console.log('\nCleaning up...');
      try {
        await control.send(new DeleteMemoryCommand({ memoryId }));
        console.log(`   Deleted ${memoryId}`);
      } catch (err) {
        console.log(`   Cleanup warning: ${err.message}`);
      }
    }
  }
}

run().catch(err => {
  console.error('\n❌ Diagnostic failed:', err.message);
  process.exit(1);
});
