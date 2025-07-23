const DataStore = require('./dataStore');
const OllamaClient = require('./ollamaClient');
const HomeAssistantClient = require('./homeAssistantClient');
const CONFIG = require('../config/defaultConfig');

class MessageGenerator {
  constructor(config = CONFIG) {
    this.dataStore = new DataStore(config.dataDirectory);
    this.ollama = new OllamaClient(config.ollama.host, config.ollama.port);
    this.homeAssistant = new HomeAssistantClient(
      config.homeAssistant.host,
      config.homeAssistant.port,
      config.homeAssistant.notifyWebhook,
      config.homeAssistant.acceptWebhook
    );
    this.config = config;
  }

  async hydrateSystemPrompt(promptTemplate) {
    const last7accepted = await this.dataStore.getLast7AcceptedMessages();
    const recentComments = await this.dataStore.getCommentsSinceLastAccepted();
    const userAComments = recentComments
      .filter(c => c.author === this.config.userA)
      .map(c => `Comment from ${this.config.userA}: ${c.text}`)
      .join('\n');
    const userBComments = recentComments
      .filter(c => c.author === this.config.userB)
      .map(c => `Comment from ${this.config.userB}: ${c.text}`)
      .join('\n');
    const last7acceptedText = last7accepted
      .map(m => `${m.date}: ${m.text}`)
      .join('\n');
    return promptTemplate
      .replace('{UserA}', this.config.userA)
      .replace('{UserB}', this.config.userB)
      .replace('{last7accepted}', last7acceptedText || 'No previous accepted messages')
      .replace('{UserAComments}', userAComments || '')
      .replace('{UserBComments}', userBComments || '');
  }

  async generate(special = false) {
    const promptTemplate = special ? this.config.systemPrompts.special : this.config.systemPrompts.default;
    const hydratedPrompt = await this.hydrateSystemPrompt(promptTemplate);
    console.log('Generating message with prompt length:', hydratedPrompt.length);
    const generatedText = await this.ollama.generate(hydratedPrompt, this.config.ollama.model);
    const message = await this.dataStore.storeMessage(generatedText, special);
    await this.homeAssistant.notify(generatedText);
    console.log('Generated and stored message:', message);
    return message;
  }

  async accept(text) {
    await this.dataStore.acceptMessage(text);
    await this.homeAssistant.accept(text);
    console.log('Accepted message:', text);
  }

  async comment(text, author) {
    const comment = await this.dataStore.storeComment(text, author);
    console.log('Stored comment:', comment);
    return comment;
  }
}

module.exports = MessageGenerator;
