// api/agent.js - IMPROVED VERSION WITH BETTER ERROR HANDLING
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      details: 'Only POST requests are supported' 
    });
  }

  try {
    console.log('🚀 Legal Agent API called');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const { user_message } = req.body;

    if (!user_message || typeof user_message !== 'string' || user_message.trim() === '') {
      return res.status(400).json({ 
        error: 'Invalid request',
        details: 'user_message is required and must be a non-empty string' 
      });
    }

    // Check environment variables
    const username = process.env.QRAPTOR_USERNAME;
    const password = process.env.QRAPTOR_PASSWORD;

    console.log('Environment check:', {
      username: username ? `EXISTS (${username.length} chars)` : 'MISSING',
      password: password ? `EXISTS (${password.length} chars)` : 'MISSING',
      nodeEnv: process.env.NODE_ENV || 'not set'
    });

    if (!username || !password) {
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'QRaptor credentials not properly configured. Please contact administrator.'
      });
    }

    // Step 1: Get OAuth token with improved error handling
    console.log('🔑 Attempting to get OAuth token...');
    
    const tokenRequestBody = new URLSearchParams({
      'grant_type': 'password',
      'client_id': 'public',
      'username': username.trim(),
      'password': password.trim()
    });

    console.log('Token request body:', tokenRequestBody.toString());

    const tokenResponse = await fetch('https://portal.qraptor.ai/auth1/realms/appzkcrk3gkfiqe8/protocol/openid-connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'LegalAI-Assistant/1.0'
      },
      body: tokenRequestBody
    });

    console.log('Token response status:', tokenResponse.status);
    console.log('Token response headers:', Object.fromEntries(tokenResponse.headers.entries()));

    const tokenResponseText = await tokenResponse.text();
    console.log('Token response text:', tokenResponseText);

    if (!tokenResponse.ok) {
      console.error('❌ Token request failed:', tokenResponseText);
      
      let errorDetails;
      try {
        const tokenError = JSON.parse(tokenResponseText);
        errorDetails = tokenError.error_description || tokenError.error || tokenResponseText;
      } catch {
        errorDetails = tokenResponseText;
      }

      return res.status(401).json({
        error: 'Authentication failed',
        details: `Invalid client or invalid client credentials: ${errorDetails}`,
        hint: 'Please verify your QRaptor username and password in the environment variables'
      });
    }

    let tokenData;
    try {
      tokenData = JSON.parse(tokenResponseText);
    } catch (parseError) {
      console.error('❌ Token response parse error:', parseError);
      return res.status(500).json({
        error: 'Authentication response error',
        details: 'Unable to parse authentication response'
      });
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      console.error('❌ No access token in response:', tokenData);
      return res.status(500).json({
        error: 'Authentication error',
        details: 'No access token received from authentication server'
      });
    }

    console.log('✅ OAuth token obtained successfully');

    // Step 2: Call QRaptor agent with the token
    console.log('🤖 Calling QRaptor Legal Agent...');
    
    const agentRequestBody = {
      agent_name: 'Legal_agent',
      user_message: user_message.trim()
    };

    console.log('Agent request body:', JSON.stringify(agentRequestBody, null, 2));

    const qraptorResponse = await fetch('https://appzkcrk3gkfiqe8.qraptor.ai/api/390/agent-controller/trigger-agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'User-Agent': 'LegalAI-Assistant/1.0'
      },
      body: JSON.stringify(agentRequestBody)
    });

    console.log('QRaptor response status:', qraptorResponse.status);
    console.log('QRaptor response headers:', Object.fromEntries(qraptorResponse.headers.entries()));

    const qraptorResponseText = await qraptorResponse.text();
    console.log('QRaptor response length:', qraptorResponseText.length);
    console.log('QRaptor response preview:', qraptorResponseText.substring(0, 500));

    if (!qraptorResponse.ok) {
      console.error('❌ QRaptor API error:', qraptorResponseText);
      
      let errorDetails;
      try {
        const qraptorError = JSON.parse(qraptorResponseText);
        errorDetails = qraptorError.message || qraptorError.error || qraptorResponseText;
      } catch {
        errorDetails = qraptorResponseText;
      }

      return res.status(qraptorResponse.status).json({
        error: 'Legal Agent Error',
        status: qraptorResponse.status,
        details: errorDetails
      });
    }

    // Parse the successful response
    let responseData;
    try {
      responseData = JSON.parse(qraptorResponseText);
      console.log('✅ QRaptor response parsed successfully');
    } catch (parseError) {
      console.log('⚠️ QRaptor response is not JSON, treating as text');
      responseData = { 
        raw_response: qraptorResponseText,
        response_type: 'text'
      };
    }

    console.log('Final response data:', JSON.stringify(responseData, null, 2));
    
    return res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ Unexpected error in agent API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      type: error.name,
      timestamp: new Date().toISOString()
    });
  }
}