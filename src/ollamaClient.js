class OllamaClient {
  constructor(host, port) {
    this.baseUrl = `http://${host}:${port}`;
  }

  async generate(prompt, model = 'deepseek-r1:14b') {
    const startTime = Date.now();
    const maxWaitTime = 3 * 60 * 60 * 1000; // 3 hours
    const retryInterval = 30000; // 30 seconds
    while (Date.now() - startTime < maxWaitTime) {
      try {
        console.log(`Attempting to connect to Ollama at ${this.baseUrl}...`);
        const response = await fetch(`${this.baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt, stream: false })
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        let parsed = data.response.replace(/<think>.*?<\/think>/gs, '').trim();
        // Remove any prefix dates like YYYY-MM-DD (optionally followed by a colon or dash and whitespace)
        parsed = parsed.replace(/^\s*\d{4}-\d{2}-\d{2}(?:\s*[:-])?\s*/g, '');
        // Remove outer bolding (**) and/or quotes if present
        parsed = parsed.replace(/^(["']|\*\*)+|(["']|\*\*)+$/g, '');
        parsed = parsed.trim();
        console.log('Successfully generated response from Ollama');
        return parsed;
      } catch (error) {
        const elapsedTime = Date.now() - startTime;
        const elapsedMinutes = Math.floor(elapsedTime / 60000);
        const remainingTime = Math.floor((maxWaitTime - elapsedTime) / 60000);
        console.error(`Ollama connection failed (${elapsedMinutes}m elapsed, ${remainingTime}m remaining): ${error.message}`);
        if (Date.now() - startTime >= maxWaitTime) {
          throw new Error(`Ollama service unavailable after 3 hours of retrying. Last error: ${error.message}`);
        }
        console.log(`Waiting ${retryInterval/1000} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryInterval));
      }
    }
  }
}

module.exports = OllamaClient;
