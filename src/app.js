const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const DEFAULT_CONFIG = require('../config/defaultConfig');
const LockManager = require('./lockManager');
const MessageGenerator = require('./messageGenerator');

let CONFIG = fsSync.existsSync('./config.json')
  ? { ...DEFAULT_CONFIG, ...JSON.parse(fsSync.readFileSync('./config.json', 'utf8')) }
  : DEFAULT_CONFIG;

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const generator = new MessageGenerator(CONFIG);

async function withLock(operation) {
  const lockFile = path.join(CONFIG.dataDirectory, '.lock');
  const lockManager = new LockManager(lockFile);
  try {
    await lockManager.acquire();
    await generator.dataStore.initialize();
    return await operation();
  } catch (error) {
    await lockManager.forceRelease();
    throw error;
  } finally {
    await lockManager.release();
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API Routes
app.get('/api/messages/unaccepted', async (req, res) => {
  try {
    const messages = await withLock(async () => {
      return await generator.dataStore.getUnacceptedMessages();
    });
    res.json(messages);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/api/config', (req, res) => {
  res.json(CONFIG);
});

app.post('/api/config', async (req, res) => {
  try {
    const newConfig = { ...DEFAULT_CONFIG, ...req.body };
    await fs.writeFile('./config.json', JSON.stringify(newConfig, null, 2));
    CONFIG = newConfig;
    res.json({ success: true });
    setTimeout(() => { process.exit(0); }, 1000);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/generate', async (req, res) => {
  try {
    const { special = false } = req.body;
    const message = await withLock(async () => {
      return await generator.generate(special);
    });
    res.json(message);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/accept', async (req, res) => {
  try {
    const { text } = req.body;
    await withLock(async () => {
      await generator.accept(text);
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/comment', async (req, res) => {
  try {
    const { text, author } = req.body;
    const comment = await withLock(async () => {
      return await generator.comment(text, author);
    });
    res.json(comment);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

module.exports = app;
