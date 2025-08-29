// api/agent.js - SIMPLE WORKING VERSION
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    // Log incoming request
    console.log('🚀 Agent API called');
    console.log('Request body:', req.body);

    const { user_message } = req.body;

    if (!user_message) {
      return res.status(400).json({ error: 'user_message required' });
    }

    // Check environment variables
    const username = process.env.QRAPTOR_USERNAME;
    const password = process.env.QRAPTOR_PASSWORD;

    console.log('Env check:', {
      username: username ? 'EXISTS' : 'MISSING',
      password: password ? 'EXISTS' : 'MISSING'
    });

    if (!username || !password) {
      return res.status(500).json({ 
        error: 'Missing credentials',
        details: 'QRAPTOR_USERNAME or QRAPTOR_PASSWORD not set'
      });
    }

    // Create auth header
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    console.log('Auth header created, length:', auth.length);

    // Make request to QRaptor
    console.log('Calling QRaptor API...');
    
    const qraptorResponse = await fetch('https://appzkcrk3gkfiqe8.qraptor.ai/api/390/agent-controller/trigger-agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({
        agent_name: 'Legal_agent',
        user_message: user_message
      })
    });

    console.log('QRaptor response status:', qraptorResponse.status);

    // Get response text
    const responseText = await qraptorResponse.text();
    console.log('Response text length:', responseText.length);
    console.log('Response preview:', responseText.substring(0, 200));

    if (!qraptorResponse.ok) {
      console.error('QRaptor error:', responseText);
      return res.status(qraptorResponse.status).json({
        error: 'QRaptor API Error',
        status: qraptorResponse.status,
        details: responseText
      });
    }

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.log('JSON parse failed, treating as text');
      data = { raw_response: responseText };
    }

    console.log('✅ Success! Returning data');
    return res.status(200).json(data);

  } catch (error) {
    console.error('❌ Agent API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      stack: error.stack
    });
  }
}
