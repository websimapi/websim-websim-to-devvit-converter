export function generateDevvitJson(appName, entryHtml = "index.html") {
  return JSON.stringify({
    "$schema": "https://developers.reddit.com/schema/config-file.v1.json",
    "name": appName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    "post": {
      "dir": "web",
      "entrypoints": {
        "default": {
          "entry": entryHtml,
          "height": "tall"
        }
      }
    },
    "server": {
      "entry": "src/server/index.js"
    },
    "permissions": {
      "reddit": {
        "enable": true,
        "asUser": ["SUBMIT_POST"]
      },
      "redis": true,
      "realtime": true
    }
  }, null, 2);
}

export function generatePackageJson(appName) {
  return JSON.stringify({
    "name": appName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    "version": "0.0.1",
    "main": "src/server/index.js",
    "scripts": {
      "dev": "devvit playtest r/test",
      "build": "devvit build",
      "launch": "devvit upload"
    },
    "dependencies": {
      "@devvit/web": "latest",
      "@devvit/sdk": "latest",
      "@devvit/redis": "latest",
      "express": "^4.18.2"
    },
    "devDependencies": {
      "@types/node": "latest"
    }
  }, null, 2);
}

export function generateServerIndex() {
  return `import express from 'express';
import { createServer, getServerPort, context, reddit, realtime } from '@devvit/web/server';
import { redis } from '@devvit/redis';

const app = express();
app.use(express.json());

// API Endpoints for the game
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', subreddit: context.subredditName });
});

app.get('/api/state', async (req, res) => {
  const { postId, userId } = context;
  const stateStr = await redis.get(\`state:\${postId}:\${userId}\`);
  res.json(stateStr ? JSON.parse(stateStr) : { score: 0 });
});

app.post('/api/save', async (req, res) => {
  const { postId, userId } = context;
  const state = req.body;
  await redis.set(\`state:\${postId}:\${userId}\`, JSON.stringify(state));
  res.json({ success: true });
});

const server = createServer(app);
server.listen(getServerPort());
`;
}

export function generateReadme(appName) {
  return `# ${appName} (WebSim Export)

This project was automatically generated from a WebSim project for the Reddit Developer Platform (Devvit).

## Getting Started

1. **Install Dependencies**
   \`\`\`bash
   npm install
   \`\`\`

2. **Login to Reddit**
   \`\`\`bash
   devvit login
   \`\`\`

3. **Run Locally**
   \`\`\`bash
   npm run dev
   \`\`\`

## Project Structure

- \`web/\`: Contains the original WebSim frontend assets.
- \`src/server/index.js\`: Node.js server to handle API requests and state.
- \`devvit.json\`: Main configuration for Reddit permissions and entry points.

## Redis and State
The server template includes basic Redis handlers for saving game state. You can find these in \`src/server/index.js\`.
`;
}

