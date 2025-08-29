// api/debug.js - Debug endpoint to test configuration
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const username = process.env.QRAPTOR_USERNAME;
    const password = process.env.QRAPTOR_PASSWORD;

    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV || 'not set',
        hasUsername: !!username,
        hasPassword: !!password,
        usernameLength: username ? username.length : 0,
        passwordLength: password ? password.length : 0,
        usernamePreview: username ? `${username.substring(0, 3)}***` : 'not set'
      },
      endpoints: {
        authUrl: 'https://portal.qraptor.ai/auth1/realms/appzkcrk3gkfiqe8/protocol/openid-connect/token',
        agentUrl: 'https://appzkcrk3gkfiqe8.qraptor.ai/api/390/agent-controller/trigger-agent'
      },
      vercelDeployment: {
        region: process.env.VERCEL_REGION || 'not set',
        env: process.env.VERCEL_ENV || 'not set',
        deploymentUrl: process.env.VERCEL_URL || 'not set'
      }
    };

    // Test basic connectivity (don't send credentials in debug mode)
    if (req.method === 'POST' && req.body?.test_auth) {
      console.log('🧪 Testing QRaptor authentication...');
      
      try {
        const authTestResponse = await fetch('https://portal.qraptor.ai/auth1/realms/appzkcrk3gkfiqe8/protocol/openid-connect/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            'grant_type': 'password',
            'client_id': 'public',
            'username': username || 'test',
            'password': password || 'test'
          })
        });

        debugInfo.authTest = {
          status: authTestResponse.status,
          statusText: authTestResponse.statusText,
          headers: Object.fromEntries(authTestResponse.headers.entries()),
          responsePreview: (await authTestResponse.text()).substring(0, 200)
        };

      } catch (authError) {
        debugInfo.authTest = {
          error: authError.message,
          type: authError.name
        };
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Debug information retrieved',
      debug: debugInfo
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      debug: {
        timestamp: new Date().toISOString(),
        errorType: error.name,
        stack: error.stack
      }
    });
  }
}