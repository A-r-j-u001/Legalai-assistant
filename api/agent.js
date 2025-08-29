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

    // Step 1: Get OAuth token first
    console.log('Getting OAuth token...');
    
    const tokenResponse = await fetch('https://portal.qraptor.ai/auth1/realms/appzkcrk3gkfiqe8/protocol/openid-connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'grant_type': 'password',
        'client_id': 'public',
        'username': username,
        'password': password
      })
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error('Token error:', tokenError);
      return res.status(401).json({
        error: 'Authentication failed',
        details: tokenError
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('✅ Token obtained');

    // Step 2: Use token for agent call
    console.log('Calling QRaptor API with token...');
    
    const qraptorResponse = await fetch('https://appzkcrk3gkfiqe8.qraptor.ai/api/390/agent-controller/trigger-agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
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
