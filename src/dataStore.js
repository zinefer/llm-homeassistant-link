const fs = require('fs').promises;
const path = require('path');

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
    const existingIndex = messages.findIndex(m => m.date === date && m.text === text);
    if (existingIndex >= 0) {
      messages[existingIndex].accepted = true;
      await this.rewriteMessagesFiles(messages);
    } else {
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
    const messagesByMonth = {};
    for (const message of messages) {
      const date = new Date(message.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!messagesByMonth[key]) {
        messagesByMonth[key] = [];
      }
      messagesByMonth[key].push(message);
    }
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

  async getUnacceptedMessages() {
    const messages = await this.getAllMessages();
    const lastAccepted = await this.getLastAcceptedMessage();
    if (!lastAccepted) {
      return messages;
    }
    const lastAcceptedDate = new Date(lastAccepted.date);
    return messages.filter(m => new Date(m.date) > lastAcceptedDate);
  }
}

module.exports = DataStore;
