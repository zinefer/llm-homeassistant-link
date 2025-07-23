const fs = require('fs').promises;
const crypto = require('crypto');

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
        throw new Error('Another instance is already running (lock file exists)');
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

module.exports = LockManager;
