// api/agent.js - Complete Updated Version with Seamless Token Refresh

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-QRAPTOR-TOKEN');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST requests are allowed" });
  }

  // Get fresh token from QRaptor auth endpoint
  async function getFreshToken() {
    try {
      console.log("🔄 Getting fresh token from QRaptor...");

      const response = await fetch('https://portal.qraptor.ai/auth1/realms/appzkcrk3gkfiqe8/protocol/openid-connect/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'grant_type': 'password',
          'client_id': 'public',
          'username': process.env.QRAPTOR_USERNAME || 'ayukumar',
          'password': process.env.QRAPTOR_PASSWORD || 'KaCW813y#o'
        })
      });

      const responseText = await response.text();
      console.log("Auth response status:", response.status);

      if (!response.ok) {
        throw new Error(`Auth failed: ${response.status} - ${responseText}`);
      }

      const tokenData = JSON.parse(responseText);
      console.log("✅ Fresh token obtained, expires in:", tokenData.expires_in, "seconds");
      
      return tokenData.access_token;
    } catch (error) {
      console.error('❌ Token fetch failed:', error.message);
      throw error;
    }
  }

  // Make agent request with token
  async function makeAgentRequest(token, requestData) {
    console.log("🤖 Making agent request...");
    
    const response = await fetch(
      "https://appzkcrk3gkfiqe8.qraptor.ai/api/390/agent-controller/trigger-agent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        },
        body: JSON.stringify(requestData),
      }
    );

    return response;
  }

  try {
    console.log("🚀 Agent API called with seamless token refresh");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    // Step 1: Always get fresh token first
    let token;
    try {
      token = await getFreshToken();
      console.log("✅ Fresh token ready");
    } catch (tokenError) {
      console.error("❌ Failed to get token:", tokenError);
      return res.status(500).json({
        error: "Authentication failed",
        details: "Could not obtain access token from QRaptor"
      });
    }

    // Step 2: Make agent request
    let response = await makeAgentRequest(token, req.body);
    console.log("Agent response status:", response.status);

    // Step 3: If 401, retry with fresh token
    if (response.status === 401) {
      console.log("🔄 Got 401, retrying with fresh token...");
      try {
        token = await getFreshToken();
        response = await makeAgentRequest(token, req.body);
        console.log("✅ Retry successful, status:", response.status);
      } catch (retryError) {
        console.error("❌ Retry failed:", retryError);
        return res.status(401).json({
          error: "Authentication failed after retry",
          details: "Could not authenticate with QRaptor API"
        });
      }
    }

    // Step 4: Process response
    const responseText = await response.text();
    console.log("QRaptor API Raw Response Length:", responseText.length);

    if (!response.ok) {
      console.error("❌ QRaptor API Error:", response.status, responseText.substring(0, 300));
      return res.status(response.status).json({ 
        error: "QRaptor API Error", 
        status: response.status,
        details: responseText
      });
    }

    // Step 5: Handle SSE format (your existing logic)
    let data;
    try {
      if (responseText.includes('data: {')) {
        console.log("✅ Detected SSE format response");
        
        const dataLines = responseText
          .split('\n')
          .filter(line => line.startsWith('data: {'))
          .map(line => line.replace('data: ', ''));
        
        console.log(`✅ Extracted ${dataLines.length} SSE data lines`);
        
        let finalData = null;
        for (const line of dataLines.reverse()) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.agentExecutionComplete === true || parsed.outputs) {
              finalData = parsed;
              break;
            }
          } catch (e) {
            // Skip unparseable lines
          }
        }
        
        data = finalData || JSON.parse(dataLines[dataLines.length - 1]);
        console.log("✅ Final extracted data");
        
      } else {
        data = JSON.parse(responseText);
        console.log("✅ Parsed as regular JSON");
      }
    } catch (parseError) {
      console.error("❌ Failed to parse response:", parseError);
      return res.status(500).json({
        error: "Failed to parse QRaptor API response",
        details: responseText.substring(0, 300) + "..."
      });
    }

    console.log("✅ QRaptor Agent Success - returning response");
    return res.status(200).json(data);

  } catch (error) {
    console.error("❌ Agent API Error:", error);
    return res.status(500).json({ 
      error: "Agent API failed", 
      details: error.message
    });
  }
}