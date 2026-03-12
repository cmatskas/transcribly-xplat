const {
  BedrockAgentCoreClient,
  StartBrowserSessionCommand,
  UpdateBrowserStreamCommand,
  StopBrowserSessionCommand,
} = require('@aws-sdk/client-bedrock-agentcore');
const crypto = require('crypto');

/**
 * Manages AgentCore Browser sessions.
 * Provides high-level navigate/extract operations over the managed Chrome browser.
 */
class BrowserManager {
  constructor(clientConfig) {
    this.client = new BedrockAgentCoreClient(clientConfig);
    this.sessionId = null;
    this.browserIdentifier = 'aws.browser.v1';
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
    this.streams = response.streams;
    return this.sessionId;
  }

  /**
   * Navigate to a URL and extract page content.
   * Uses UpdateBrowserStream to send automation commands.
   */
  async navigate(url) {
    if (!this.sessionId) throw new Error('No active browser session');

    const response = await this.client.send(
      new UpdateBrowserStreamCommand({
        browserIdentifier: this.browserIdentifier,
        sessionId: this.sessionId,
        clientToken: this._token(),
        streamUpdate: {
          automationStreamUpdate: {
            commandInput: {
              action: 'NAVIGATE',
              url,
            },
          },
        },
      })
    );

    return response;
  }

  /**
   * Get the current page content (text extraction).
   */
  async getPageContent() {
    if (!this.sessionId) throw new Error('No active browser session');

    const response = await this.client.send(
      new UpdateBrowserStreamCommand({
        browserIdentifier: this.browserIdentifier,
        sessionId: this.sessionId,
        clientToken: this._token(),
        streamUpdate: {
          automationStreamUpdate: {
            commandInput: {
              action: 'GET_CONTENT',
            },
          },
        },
      })
    );

    return response;
  }

  /**
   * Click an element on the page.
   */
  async click(selector) {
    if (!this.sessionId) throw new Error('No active browser session');

    return this.client.send(
      new UpdateBrowserStreamCommand({
        browserIdentifier: this.browserIdentifier,
        sessionId: this.sessionId,
        clientToken: this._token(),
        streamUpdate: {
          automationStreamUpdate: {
            commandInput: {
              action: 'CLICK',
              selector,
            },
          },
        },
      })
    );
  }

  /**
   * Type text into an element.
   */
  async type(selector, text) {
    if (!this.sessionId) throw new Error('No active browser session');

    return this.client.send(
      new UpdateBrowserStreamCommand({
        browserIdentifier: this.browserIdentifier,
        sessionId: this.sessionId,
        clientToken: this._token(),
        streamUpdate: {
          automationStreamUpdate: {
            commandInput: {
              action: 'TYPE',
              selector,
              text,
            },
          },
        },
      })
    );
  }

  async stopSession() {
    if (!this.sessionId) return;

    try {
      await this.client.send(
        new StopBrowserSessionCommand({
          browserIdentifier: this.browserIdentifier,
          sessionId: this.sessionId,
        })
      );
    } finally {
      this.sessionId = null;
      this.streams = null;
    }
  }

  _token() {
    return crypto.randomUUID();
  }
}

module.exports = BrowserManager;
