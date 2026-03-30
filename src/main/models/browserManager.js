const {
  BedrockAgentCoreClient,
  StartBrowserSessionCommand,
  StopBrowserSessionCommand,
} = require('@aws-sdk/client-bedrock-agentcore');
const { SignatureV4 } = require('@smithy/signature-v4');
const { Sha256 } = require('@aws-crypto/sha256-js');
const { chromium } = require('playwright-core');
const log = require('electron-log/main');

/**
 * Manages AgentCore Browser sessions via Playwright CDP.
 * The Chrome browser runs remotely on AWS — playwright-core is just a thin CDP client.
 * WebSocket auth uses SigV4-signed headers.
 */
class BrowserManager {
  constructor(clientConfig) {
    this.client = new BedrockAgentCoreClient(clientConfig);
    this.clientConfig = clientConfig;
    this.sessionId = null;
    this.browserIdentifier = 'aws.browser.v1';
    this.browser = null;
    this.page = null;
  }

  async startSession(timeoutSeconds = 900) {
    if (this.sessionId) return this.sessionId;

    const response = await this.client.send(
      new StartBrowserSessionCommand({
        browserIdentifier: this.browserIdentifier,
        name: `transcribely-browser-${Date.now()}`,
        sessionTimeoutSeconds: timeoutSeconds,
        viewPort: { width: 1280, height: 900 },
      })
    );

    this.sessionId = response.sessionId;
    const wsEndpoint = response.streams?.automationStream?.streamEndpoint;
    if (!wsEndpoint) throw new Error('No automation stream endpoint returned');
    log.info(`[browser] Session started: ${this.sessionId}`);

    // Generate SigV4-signed headers for WebSocket CDP connection
    const headers = await this._signWebSocketHeaders(wsEndpoint);

    // Connect to remote Chrome via CDP with signed headers
    this.browser = await chromium.connectOverCDP(wsEndpoint, { headers });
    // Create a fresh context with HTTPS error handling for sandbox certs
    const context = await this.browser.newContext({ ignoreHTTPSErrors: true });
    this.page = await context.newPage();

    return this.sessionId;
  }

  async navigate(url) {
    if (!this.page) throw new Error('No active browser session');
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    return { url, title: await this.page.title() };
  }

  async getPageContent() {
    if (!this.page) throw new Error('No active browser session');
    return await this.page.evaluate(() => document.body.innerText);
  }

  async stopSession() {
    const sid = this.sessionId;
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      this.page = null;
    }
    if (this.sessionId) {
      try {
        await this.client.send(
          new StopBrowserSessionCommand({
            browserIdentifier: this.browserIdentifier,
            sessionId: this.sessionId,
          })
        );
      } finally {
        this.sessionId = null;
      }
    }
    log.info(`[browser] Session stopped: ${sid}`);
  }

  /**
   * Sign the WebSocket URL with SigV4 headers for authentication.
   * Mirrors the Python SDK's generate_ws_headers() approach.
   */
  async _signWebSocketHeaders(wsUrl) {
    const url = new URL(wsUrl.replace('wss://', 'https://'));
    const region = this.clientConfig.region;

    // Resolve credentials — from config if available, otherwise from SDK default chain
    let credentials = this.clientConfig.credentials;
    if (!credentials || !credentials.accessKeyId) {
      const { fromNodeProviderChain } = require('@aws-sdk/credential-providers');
      credentials = await fromNodeProviderChain()();
    } else if (typeof credentials === 'function') {
      credentials = await credentials();
    }

    const signer = new SignatureV4({
      service: 'bedrock-agentcore',
      region,
      credentials,
      sha256: Sha256,
    });

    const request = {
      method: 'GET',
      protocol: 'https:',
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        host: url.hostname,
      },
    };

    const signed = await signer.sign(request);

    return {
      ...signed.headers,
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
      'Sec-WebSocket-Version': '13',
    };
  }
}

module.exports = BrowserManager;
