# Telegram Chat Exporter

Export Telegram chat history (`result.json`) to a formatted `.docx` file.

## Purpose

The main purpose of this tool is to document raw mental states from Telegram chats and generate a formatted document to share with a therapist.

## Setup

```bash
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

For development with auto-reload:
```bash
npm run dev
```

## How it works

- **Frontend** (`index.html`) — Parses the JSON file client-side using a Web Worker (non-blocking), renders messages with virtual/paginated scrolling, and lets you filter + select messages to export.
- **Backend** (`server.js`) — Receives the selected messages via `POST /export`, generates the `.docx` using the `docx` npm package, and streams the file back as a download.

The `docx` library runs entirely on the server — no CDN dependency, no browser compatibility issues.

### Note on Serving `index.html`
The frontend is served from the root directory via Express. The server uses `app.use(express.static(__dirname))` to serve static files from the project root, and falls back to serving `index.html` for any unmatched routes with `res.sendFile(path.join(__dirname, 'index.html'))`.

If `index.html` is placed in a `public/` subdirectory (as shown in the project structure below), update the server code to serve from that directory:
```javascript
app.use(express.static(path.join(__dirname, 'public')));

// Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
```
This ensures proper static file serving and avoids exposing non-static files like `server.js`.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3000`  | Port to listen on |

## Project structure

```
tg-exporter/
├── server.js          # Express server + docx generation
├── package.json
└── public/
    └── index.html     # Frontend (served statically)
```
