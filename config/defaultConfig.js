// Default configuration for the app
module.exports = {
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
