class HomeAssistantClient {
  constructor(host, port) {
    this.baseUrl = `http://${host}:${port}`;
  }

  async notify(message, title = 'New Message Generated') {
    try {
      const response = await fetch(`${this.baseUrl}/webhook/example_webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, message })
      });
      if (!response.ok) {
        console.warn(`Home Assistant notification failed: ${response.statusText}`);
      }
    } catch (error) {
      console.warn(`Home Assistant notification error: ${error.message}`);
    }
  }
}

module.exports = HomeAssistantClient;
