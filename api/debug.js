// api/debug.js - Environment Variables Check
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const debug = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV,
      },
      qraptor_config: {
        username: process.env.QRAPTOR_USERNAME ? '✅ Set' : '❌ Missing',
        password: process.env.QRAPTOR_PASSWORD ? '✅ Set' : '❌ Missing',
        username_preview: process.env.QRAPTOR_USERNAME ? 
          process.env.QRAPTOR_USERNAME.substring(0, 3) + '***' : 'Not found',
      },
      test_auth_string: process.env.QRAPTOR_USERNAME && process.env.QRAPTOR_PASSWORD ?
        Buffer.from(`${process.env.QRAPTOR_USERNAME}:${process.env.QRAPTOR_PASSWORD}`).toString('base64').substring(0, 10) + '...' :
        'Cannot generate - missing credentials'
    };

    return res.status(200).json(debug);

  } catch (error) {
    return res.status(500).json({
      error: 'Debug failed',
      details: error.message
    });
  }
}