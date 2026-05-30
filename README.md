# Voice Bot — 100x AI Engineer Interview

## Deployment on Railway / Render / Vercel (Node)

### Environment Variables
Set this in your deployment dashboard:
```
OPENAI_API_KEY=your_key_here
```

### Railway (Recommended — easiest)
1. Push this folder to a GitHub repo
2. Go to railway.app → New Project → Deploy from GitHub
3. Add env var: `OPENAI_API_KEY`
4. It auto-detects Node.js and runs `npm start`

### Render
1. New Web Service → connect GitHub repo
2. Build command: `npm install`
3. Start command: `node server.js`
4. Add env var: `OPENAI_API_KEY`

### Local Dev
```bash
npm install
# Add your API key to .env
npm start
# Open http://localhost:3000
```
