# llm-homeassistant-link

A Node.js server to link LLMs with Home Assistant via API and message generation.

## Features
- REST API for message generation, acceptance, and comments
- Configurable via `config.json`
- Locking for safe concurrent access
- Static frontend in `public/`

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```

## Development
- Use `npm run dev` for auto-reload with nodemon
- Lint code with `npm run lint`

## API Endpoints
- `GET /api/messages/unaccepted` — List unaccepted messages
- `POST /api/generate` — Generate a new message
- `POST /api/accept` — Accept a message
- `POST /api/comment` — Add a comment
- `GET/POST /api/config` — Get or update config

## Project Structure
- `src/` — Main server and logic
- `public/` — Static frontend
- `config/` — Default config
- `data/` — Data storage

## License
MIT
