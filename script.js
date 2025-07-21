#!/usr/bin/env node

const fsSync = require('fs');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Static Configuration
const DEFAULT_CONFIG = {
  userA: "Alice",
  userB: "Bob",
  dataDirectory: "./data",
  homeAssistant: {
    host: "localhost",
    port: 8123
  },
  ollama: {
    host: "localhost",
    port: 11434,
    model: "deepseek-r1:14b"
  },
  systemPrompts: {
    default: `You are a helpful assistant. Users: {UserA} and {UserB}.

Recent accepted messages:
{last7accepted}

User comments since last accepted message:
{UserAComments}
{UserBComments}

Generate a helpful and contextually appropriate message.`,
    
    special: `You are a creative assistant with special capabilities. Users: {UserA} and {UserB}.

Recent accepted messages:
{last7accepted}

User comments since last accepted message:
{UserAComments}
{UserBComments}

Generate a creative and special message that goes beyond normal responses.`
  }
};

const CONFIG = fsSync.existsSync('./config.json')
  ? { ...DEFAULT_CONFIG, ...JSON.parse(fsSync.readFileSync('./config.json', 'utf8')) }
  : DEFAULT_CONFIG;

class LockManager {
  constructor(lockFile) {
    this.lockFile = lockFile;
    this.lockId = crypto.randomUUID();
  }

  async acquire() {
    try {
      await fs.writeFile(this.lockFile, this.lockId, { flag: 'wx' });
      return true;
    } catch (error) {
      if (error.code === 'EEXIST') {
        console.error('Error: Another instance is already running (lock file exists)');
        process.exit(1);
      }
      throw error;
    }
  }

  async release() {
    try {
      const currentLock = await fs.readFile(this.lockFile, 'utf8');
      if (currentLock === this.lockId) {
        await fs.unlink(this.lockFile);
      }
    } catch (error) {
      // Lock file might not exist or might have been taken by another process
      if (error.code !== 'ENOENT') {
        console.warn('Warning: Could not release lock:', error.message);
      }
    }
  }

  async forceRelease() {
    try {
      await fs.unlink(this.lockFile);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Warning: Could not force release lock:', error.message);
      }
    }
  }
}

class DataStore {
  constructor(dataDirectory) {
    this.dataDirectory = dataDirectory;
    this.messagesDir = path.join(dataDirectory, 'messages');
    this.commentsDir = path.join(dataDirectory, 'comments');
  }

  async initialize() {
    await fs.mkdir(this.messagesDir, { recursive: true });
    await fs.mkdir(this.commentsDir, { recursive: true });
  }

  getMonthlyFileName(date, type) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const dir = type === 'message' ? this.messagesDir : this.commentsDir;
    return path.join(dir, `${year}-${month}.ndjson`);
  }

  async appendToFile(fileName, data) {
    const line = JSON.stringify(data) + '\n';
    await fs.appendFile(fileName, line, 'utf8');
  }

  async readNDJSONFile(fileName) {
    try {
      const content = await fs.readFile(fileName, 'utf8');
      return content.trim().split('\n')
        .filter(line => line.length > 0)
        .map(line => JSON.parse(line));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async getAllMessages() {
    const files = await fs.readdir(this.messagesDir).catch(() => []);
    const messages = [];
    
    for (const file of files.filter(f => f.endsWith('.ndjson'))) {
      const filePath = path.join(this.messagesDir, file);
      const fileMessages = await this.readNDJSONFile(filePath);
      messages.push(...fileMessages);
    }
    
    return messages.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  async getAllComments() {
    const files = await fs.readdir(this.commentsDir).catch(() => []);
    const comments = [];
    
    for (const file of files.filter(f => f.endsWith('.ndjson'))) {
      const filePath = path.join(this.commentsDir, file);
      const fileComments = await this.readNDJSONFile(filePath);
      comments.push(...fileComments);
    }
    
    return comments.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  async storeMessage(text, special = false) {
    const date = new Date().toISOString().split('T')[0];
    const message = {
      date,
      text,
      accepted: false,
      special
    };
    
    const fileName = this.getMonthlyFileName(new Date(), 'message');
    await this.appendToFile(fileName, message);
    return message;
  }

  async acceptMessage(text, special = false) {
    const date = new Date().toISOString().split('T')[0];
    const messages = await this.getAllMessages();
    
    // Find existing message or create new one
    const existingIndex = messages.findIndex(m => m.date === date && m.text === text);
    
    if (existingIndex >= 0) {
      // Update existing message
      messages[existingIndex].accepted = true;
      await this.rewriteMessagesFiles(messages);
    } else {
      // Create new accepted message
      const message = {
        date,
        text,
        accepted: true,
        special
      };
      const fileName = this.getMonthlyFileName(new Date(), 'message');
      await this.appendToFile(fileName, message);
    }
  }

  async rewriteMessagesFiles(messages) {
    // Group messages by month
    const messagesByMonth = {};
    for (const message of messages) {
      const date = new Date(message.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!messagesByMonth[key]) {
        messagesByMonth[key] = [];
      }
      messagesByMonth[key].push(message);
    }
    
    // Rewrite each month's file
    for (const [monthKey, monthMessages] of Object.entries(messagesByMonth)) {
      const fileName = path.join(this.messagesDir, `${monthKey}.ndjson`);
      const content = monthMessages.map(m => JSON.stringify(m)).join('\n') + '\n';
      await fs.writeFile(fileName, content, 'utf8');
    }
  }

  async storeComment(text, author) {
    const date = new Date().toISOString().split('T')[0];
    const comment = {
      date,
      text,
      author
    };
    
    const fileName = this.getMonthlyFileName(new Date(), 'comment');
    await this.appendToFile(fileName, comment);
    return comment;
  }

  async getLastAcceptedMessage() {
    const messages = await this.getAllMessages();
    const accepted = messages.filter(m => m.accepted);
    return accepted.length > 0 ? accepted[accepted.length - 1] : null;
  }

  async getLast7AcceptedMessages() {
    const messages = await this.getAllMessages();
    const accepted = messages.filter(m => m.accepted);
    return accepted.slice(-7);
  }

  async getCommentsSinceLastAccepted() {
    const lastAccepted = await this.getLastAcceptedMessage();
    const comments = await this.getAllComments();
    
    if (!lastAccepted) {
      return comments;
    }
    
    const lastAcceptedDate = new Date(lastAccepted.date);
    return comments.filter(c => new Date(c.date) > lastAcceptedDate);
  }
}

class OllamaClient {
  constructor(host, port) {
    this.baseUrl = `http://${host}:${port}`;
  }

  async generate(prompt, model = 'deepseek-r1:14b') {
    const startTime = Date.now();
    const maxWaitTime = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
    const retryInterval = 30000; // 30 seconds between retries

    while (Date.now() - startTime < maxWaitTime) {
      try {
        console.log(`Attempting to connect to Ollama at ${this.baseUrl}...`);
        
        const response = await fetch(`${this.baseUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            prompt,
            stream: false
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Remove all <think></think> tags and trim whitespace
        const parsed = data.response.replace(/<think>.*?<\/think>/gs, '').trim();

        // TODO: Remove any dates in the format YYYY-MM-DD
        // TODO: Remove bolding if the entire message is bolded

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

class HomeAssistantClient {
  constructor(host, port) {
    this.baseUrl = `http://${host}:${port}`;
  }

  async notify(message, title = 'New Message Generated') {
    try {
      const response = await fetch(`${this.baseUrl}/api/services/notify/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
        },
        body: JSON.stringify({
          title,
          message
        })
      });

      if (!response.ok) {
        console.warn(`Home Assistant notification failed: ${response.statusText}`);
      }
    } catch (error) {
      console.warn(`Home Assistant notification error: ${error.message}`);
    }
  }
}

class MessageGenerator {
  constructor() {
    this.dataStore = new DataStore(CONFIG.dataDirectory);
    this.ollama = new OllamaClient(CONFIG.ollama.host, CONFIG.ollama.port);
    this.homeAssistant = new HomeAssistantClient(CONFIG.homeAssistant.host, CONFIG.homeAssistant.port);
  }

  async hydrateSystemPrompt(promptTemplate) {
    const last7accepted = await this.dataStore.getLast7AcceptedMessages();
    const recentComments = await this.dataStore.getCommentsSinceLastAccepted();
    
    const userAComments = recentComments
      .filter(c => c.author === CONFIG.userA)
      .map(c => `Comment from ${CONFIG.userA}: ${c.text}`)
      .join('\n');
    
    const userBComments = recentComments
      .filter(c => c.author === CONFIG.userB)
      .map(c => `Comment from ${CONFIG.userB}: ${c.text}`)
      .join('\n');
    
    const last7acceptedText = last7accepted
      .map(m => `${m.date}: ${m.text}`)
      .join('\n');

    return promptTemplate
      .replace('{UserA}', CONFIG.userA)
      .replace('{UserB}', CONFIG.userB)
      .replace('{last7accepted}', last7acceptedText || 'No previous accepted messages')
      .replace('{UserAComments}', userAComments || '')
      .replace('{UserBComments}', userBComments || '');
  }

  async generate(special = false) {
    const promptTemplate = special ? CONFIG.systemPrompts.special : CONFIG.systemPrompts.default;
    const hydratedPrompt = await this.hydrateSystemPrompt(promptTemplate);
    
    console.log('Generating message with prompt length:', hydratedPrompt.length);
    console.log('Prompt:', hydratedPrompt);
    const generatedText = await this.ollama.generate(hydratedPrompt, CONFIG.ollama.model);
    
    const message = await this.dataStore.storeMessage(generatedText, special);
    await this.homeAssistant.notify(generatedText, 'New Generated Message');
    
    console.log('Generated and stored message:', message);
    return message;
  }

  async accept(text) {
    await this.dataStore.acceptMessage(text);
    console.log('Accepted message:', text);
  }

  async comment(text, author) {
    const comment = await this.dataStore.storeComment(text, author);
    console.log('Stored comment:', comment);
    return comment;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node script.js <action> [arguments]');
    console.error('Actions: generate, generate:special, accept <text>, comment <text> <author>');
    process.exit(1);
  }

  const action = args[0];
  const lockFile = path.join(CONFIG.dataDirectory, '.lock');
  const lockManager = new LockManager(lockFile);
  
  try {
    await lockManager.acquire();
    console.log('Lock acquired');
    
    const generator = new MessageGenerator();
    await generator.dataStore.initialize();
    
    switch (action) {
      case 'generate':
        await generator.generate(false);
        break;
        
      case 'generate:special':
        await generator.generate(true);
        break;
        
      case 'accept':
        if (args.length < 2) {
          console.error('Accept action requires text argument');
          process.exit(1);
        }
        await generator.accept(args[1]);
        break;
        
      case 'comment':
        if (args.length < 3) {
          console.error('Comment action requires text and author arguments');
          process.exit(1);
        }
        await generator.comment(args[1], args[2]);
        break;
        
      default:
        console.error('Unknown action:', action);
        process.exit(1);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    // Force release the lock on any error
    await lockManager.forceRelease();
    console.log('Lock force-released due to error');
    process.exit(1);
  } finally {
    await lockManager.release();
    console.log('Lock released');
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { MessageGenerator, DataStore, LockManager };