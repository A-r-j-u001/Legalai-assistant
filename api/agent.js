// api/agent.js

// Token management
let cachedToken = null;
let tokenExpiry = null;

// Authentication credentials (store these as environment variables)
const AUTH_CONFIG = {
  username: process.env.QRAPTOR_USERNAME || 'ayukumar',
  password: process.env.QRAPTOR_PASSWORD || 'KaCW813y#o',
  client_id: 'application',
  client_secret: 'aoS5JiFBR3EIvUNXL5MhV5ooyUStM3ja',
  token_url: 'https://portal.qraptor.ai/auth1/realms/appzkcrk3gkfiqe8/protocol/openid-connect/token',
  api_url: 'https://appzkcrk3gkfiqe8.qraptor.ai/api/390/agent-controller/trigger-agent'
};

// Function to get a new access token
async function getAccessToken() {
  try {
    console.log("Requesting new access token from QRaptor...");
    
    const tokenResponse = await fetch(AUTH_CONFIG.token_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: AUTH_CONFIG.username,
        password: AUTH_CONFIG.password,
        grant_type: 'password',
        client_id: AUTH_CONFIG.client_id,
        client_secret: AUTH_CONFIG.client_secret
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token request failed:", tokenResponse.status, errorText);
      throw new Error(`Token request failed: ${tokenResponse.status} - ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log("Token response received:", {
      access_token: tokenData.access_token ? "Present" : "Missing",
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type
    });

    if (!tokenData.access_token) {
      throw new Error("No access token in response");
    }

    // Cache the token and calculate expiry time (subtract 60 seconds for safety)
    cachedToken = tokenData.access_token;
    const expiresInMs = (tokenData.expires_in - 60) * 1000; // Convert to ms, subtract 60s buffer
    tokenExpiry = Date.now() + expiresInMs;
    
    console.log("Token cached successfully. Expires at:", new Date(tokenExpiry).toISOString());
    return cachedToken;

  } catch (error) {
    console.error("Failed to get access token:", error);
    cachedToken = null;
    tokenExpiry = null;
    throw error;
  }
}

// Function to get valid token (cached or fresh)
async function getValidToken() {
  // Check if we have a cached token that's still valid
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    console.log("Using cached token (expires in", Math.round((tokenExpiry - Date.now()) / 1000), "seconds)");
    return cachedToken;
  }

  console.log("Token expired or missing, requesting new token...");
  return await getAccessToken();
}

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

  try {
    console.log("=== Agent API Request Started ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    // Get a valid access token
    let accessToken;
    try {
      accessToken = await getValidToken();
    } catch (tokenError) {
      console.error("Token acquisition failed:", tokenError);
      return res.status(500).json({
        error: "Authentication failed",
        details: "Could not obtain access token from QRaptor",
        tokenError: tokenError.message
      });
    }

    console.log("Making request to QRaptor API with fresh token...");

    // 🔹 ENHANCED: Build request with conversation context
    let requestBody = { ...req.body };
    
    // If chat history is provided, build a contextual message
    if (req.body.chat_history && Array.isArray(req.body.chat_history) && req.body.chat_history.length > 0) {
      console.log("📝 Building message with conversation context...");
      
      // Get recent history (last 10 messages to avoid token limits)
      const recentHistory = req.body.chat_history.slice(-10);
      
      // Build conversation context
      const conversationContext = recentHistory
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n\n');
      
      // Create contextual message
      const contextualMessage = `Previous conversation context:
${conversationContext}

Current user question: ${req.body.user_message}

Please respond to the current question while considering the previous conversation context. Provide a helpful and relevant response that builds upon our previous discussion.`;

      requestBody.user_message = contextualMessage;
      console.log("📋 Built contextual message:", contextualMessage.substring(0, 300) + "...");
    } else {
      console.log("🆕 No chat history provided, treating as fresh conversation");
    }

    // Make the API request with the access token
    const response = await fetch(AUTH_CONFIG.api_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json"
      },
      body: JSON.stringify(requestBody),
    });

    console.log("QRaptor API Response Status:", response.status);
    console.log("QRaptor API Response Headers:", Object.fromEntries(response.headers.entries()));

    // Get response text first to handle both JSON and SSE responses
    const responseText = await response.text();
    console.log("QRaptor API Raw Response:", responseText.substring(0, 500) + "...");

    // If we get 401/403, try refreshing token once
    if (response.status === 401 || response.status === 403) {
      console.log("Got auth error, attempting token refresh...");
      
      try {
        // Force refresh token
        cachedToken = null;
        tokenExpiry = null;
        accessToken = await getValidToken();
        
        console.log("Retrying request with new token...");
        
        // Retry the request
        const retryResponse = await fetch(AUTH_CONFIG.api_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
            "Accept": "application/json"
          },
          body: JSON.stringify(requestBody),
        });

        const retryResponseText = await retryResponse.text();
        
        if (!retryResponse.ok) {
          return res.status(retryResponse.status).json({
            error: "QRaptor API Error (after token refresh)",
            status: retryResponse.status,
            details: retryResponseText,
          });
        }

        // Process successful retry response
        const retryData = await processApiResponse(retryResponseText);
        console.log("Retry successful!");
        return res.status(200).json(retryData);

      } catch (retryError) {
        console.error("Retry after token refresh failed:", retryError);
        return res.status(401).json({
          error: "Authentication failed even after token refresh",
          details: retryError.message
        });
      }
    }

    // Check if response is ok
    if (!response.ok) {
      console.error("QRaptor API Error Response:", responseText);
      return res.status(response.status).json({ 
        error: "QRaptor API Error", 
        status: response.status,
        details: responseText,
        headers: Object.fromEntries(response.headers.entries())
      });
    }

    // Process successful response
    const data = await processApiResponse(responseText);
    console.log("=== Agent API Request Completed Successfully ===");
    return res.status(200).json(data);

  } catch (error) {
    console.error("=== Agent API Request Failed ===");
    console.error("Proxy Error:", error);
    
    // Handle different types of errors
    if (error.name === 'AbortError') {
      return res.status(408).json({ 
        error: "Request timeout", 
        details: "The request to QRaptor API timed out"
      });
    }
    
    if (error.cause?.code === 'ENOTFOUND') {
      return res.status(503).json({ 
        error: "DNS resolution failed", 
        details: "Could not resolve QRaptor API hostname"
      });
    }
    
    return res.status(500).json({ 
      error: "Proxy failed", 
      details: error.message,
      errorType: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Function to process API response (handles both JSON and SSE formats)
async function processApiResponse(responseText) {
  let data;
  try {
    // Check if it's SSE format (contains "data:" lines)
    if (responseText.includes('data: {')) {
      console.log("Detected SSE format response");
      
      // Extract all data lines from SSE
      const dataLines = responseText
        .split('\n')
        .filter(line => line.startsWith('data: {'))
        .map(line => line.replace('data: ', ''));
      
      console.log("Extracted SSE data lines:", dataLines.length);
      
      // Find the final/complete response (with agentExecutionComplete: true)
      let finalData = null;
      for (const line of dataLines.reverse()) { // Start from last
        try {
          const parsed = JSON.parse(line);
          if (parsed.agentExecutionComplete === true || parsed.outputs) {
            finalData = parsed;
            break;
          }
        } catch (e) {
          console.log("Skipping unparseable line:", line.substring(0, 100));
        }
      }
      
      data = finalData || JSON.parse(dataLines[dataLines.length - 1]);
      console.log("Final extracted data keys:", Object.keys(data));
      
    } else {
      // Regular JSON response
      data = JSON.parse(responseText);
    }
    
    return data;
    
  } catch (parseError) {
    console.error("Failed to parse response:", parseError);
    throw new Error(`Failed to parse QRaptor API response: ${parseError.message}`);
  }
}
