import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

// Public config endpoint for client to fetch Supabase keys (do NOT commit secrets)
app.get('/config', (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY' });
  }
  res.json({ supabaseUrl, supabaseAnonKey });
});

// Import the API handler (ESM default export)
import handler from './api/agent.js';

// API route
app.post('/api/agent', handler);
app.options('/api/agent', handler);

// Serve static files from project root
app.use(express.static(__dirname));

// Fallback to index.html for other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
