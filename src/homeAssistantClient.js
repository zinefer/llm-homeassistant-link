class HomeAssistantClient {
  constructor(host, port, notifyWebhook = 'notify_webhook', acceptWebhook = 'accept_webhook') {
    this.baseUrl = `http://${host}:${port}`;
    this.notifyWebhook = notifyWebhook;
    this.acceptWebhook = acceptWebhook;
  }

  async notify(text) {
    await this._sendWebhook(this.notifyWebhook, text);
  }

  async accept(text) {
    await this._sendWebhook(this.acceptWebhook, text);
  }

  async _sendWebhook(webhookName, text) {
    try {
      const response = await fetch(`${this.baseUrl}/api/webhook/${webhookName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text })
      });
      if (!response.ok) {
        console.warn(`Home Assistant webhook '${webhookName}' failed: ${response.statusText}`);
      }
    } catch (error) {
      console.warn(`Home Assistant webhook '${webhookName}' error: ${error.message}`);
    }
  }
}

module.exports = HomeAssistantClient;
