// api/agent.js - Enhanced with Token Refresh Logic

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

  // 🔹 Get token from environment or header
  const envToken = process.env.QRAPTOR_TOKEN;
  const headerToken = req.headers['x-qraptor-token'];
  let currentToken = envToken || (typeof headerToken === 'string' ? headerToken : Array.isArray(headerToken) ? headerToken[0] : undefined);

  // Check if token exists
  if (!currentToken) {
    console.error("QRAPTOR_TOKEN not provided");
    return res.status(500).json({ 
      error: "Server configuration error", 
      details: "QRAPTOR_TOKEN missing" 
    });
  }

  // 🔹 NEW: Token validation and refresh logic
  currentToken = await validateAndRefreshToken(currentToken);
  
  if (!currentToken) {
    return res.status(500).json({ 
      error: "Token refresh failed", 
      details: "Unable to obtain valid token" 
    });
  }

  try {
    console.log("Making request to QRaptor API...");
    console.log("Using token (length):", currentToken?.length);
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    // 🔹 Make API call with validated token
    const response = await fetch(
      "https://appzkcrk3gkfiqe8.qraptor.ai/api/390/agent-controller/trigger-agent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentToken}`,
          "Accept": "application/json"
        },
        body: JSON.stringify(req.body),
      }
    );

    console.log("QRaptor API Response Status:", response.status);

    // 🔹 ENHANCED: Handle token expiration during request
    if (response.status === 401 || response.status === 403) {
      console.log("Token expired during request, attempting refresh...");
      
      // Try to refresh token
      const newToken = await refreshQRaptorToken();
      
      if (newToken && newToken !== currentToken) {
        console.log("Token refreshed, retrying request...");
        
        // Retry the request with new token
        const retryResponse = await fetch(
          "https://appzkcrk3gkfiqe8.qraptor.ai/api/390/agent-controller/trigger-agent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${newToken}`,
              "Accept": "application/json"
            },
            body: JSON.stringify(req.body),
          }
        );
        
        if (retryResponse.ok) {
          return handleSuccessfulResponse(retryResponse, res);
        }
      }
      
      // If refresh failed or retry failed
      const errorText = await response.text();
      return res.status(response.status).json({
        error: "Unauthorized - Token expired and refresh failed",
        status: response.status,
        details: errorText || "Invalid or expired token",
      });
    }

    // Handle other non-OK responses
    if (!response.ok) {
      const responseText = await response.text();
      console.error("QRaptor API Error Response:", responseText);
      return res.status(response.status).json({ 
        error: "QRaptor API Error", 
        status: response.status,
        details: responseText
      });
    }

    // Handle successful response
    return handleSuccessfulResponse(response, res);

  } catch (error) {
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
      errorType: error.name
    });
  }
}

// 🔹 NEW: Token validation and refresh function
async function validateAndRefreshToken(token) {
  try {
    // Check if token is expired
    if (isTokenExpired(token)) {
      console.log("Token is expired, refreshing...");
      const newToken = await refreshQRaptorToken();
      return newToken || token; // Fallback to original token if refresh fails
    }
    
    // Check if token expires soon (within 5 minutes)
    if (isTokenExpiringSoon(token)) {
      console.log("Token expires soon, proactively refreshing...");
      const newToken = await refreshQRaptorToken();
      return newToken || token; // Fallback to original token if refresh fails
    }
    
    return token; // Token is valid
  } catch (error) {
    console.error("Token validation error:", error);
    return token; // Fallback to original token
  }
}

// 🔹 NEW: Check if JWT token is expired
function isTokenExpired(token) {
  try {
    if (!token) return true;
    
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    
    return payload.exp <= currentTime;
  } catch (error) {
    console.error("Error checking token expiration:", error);
    return false; // If we can't parse, assume it's valid
  }
}

// 🔹 NEW: Check if token expires within 5 minutes
function isTokenExpiringSoon(token) {
  try {
    if (!token) return true;
    
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    const fiveMinutesFromNow = currentTime + (5 * 60);
    
    return payload.exp <= fiveMinutesFromNow;
  } catch (error) {
    console.error("Error checking token expiration:", error);
    return false;
  }
}

// 🔹 NEW: Refresh QRaptor token
async function refreshQRaptorToken() {
  try {
    console.log("Attempting to refresh QRaptor token...");
    
    // QRaptor token refresh endpoint (you may need to adjust this)
    const refreshResponse = await fetch(
      "https://portal.qraptor.ai/auth1/realms/appzkcrk3gkfiqe8/protocol/openid-connect/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: "application",
          refresh_token: process.env.QRAPTOR_REFRESH_TOKEN || ""
        })
      }
    );

    if (refreshResponse.ok) {
      const tokenData = await refreshResponse.json();
      console.log("Token refreshed successfully");
      return tokenData.access_token;
    } else {
      console.error("Token refresh failed:", refreshResponse.status);
      
      // 🔹 FALLBACK: Try to use a backup token or re-authenticate
      return await fallbackTokenStrategy();
    }
  } catch (error) {
    console.error("Token refresh error:", error);
    return await fallbackTokenStrategy();
  }
}

// 🔹 NEW: Fallback token strategy
async function fallbackTokenStrategy() {
  // For hackathon - use the latest token you provided
  const fallbackToken = "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIzaldOMUt0YmpsRnFWRjFXY202RmdGZ2ZkRDJmaHNIOU9jRS1Hc0FCS29FIn0.eyJleHAiOjE3NTYzNzk0ODIsImlhdCI6MTc1NjM3OTE4MiwianRpIjoiZDkwMDg2ODMtMmY3Ni00NGVjLTgyZTYtMmQyNWQ4MDM2NTFjIiwiaXNzIjoiaHR0cHM6Ly9wb3J0YWwucXJhcHRvci5haS9hdXRoMS9yZWFsbXMvYXBwemtjcmszZ2tmaXFlOCIsImF1ZCI6WyJyZWFsbS1tYW5hZ2VtZW50IiwiYWNjb3VudCJdLCJzdWIiOiIxYzc3ZTAyOC1hNjE0LTRhNDAtYTQzYy1lZTZjMTQ4YzNiNTAiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJhcHBsaWNhdGlvbiIsInNpZCI6ImNhYjA3YWUzLTkyNGQtNDY4OC1hNGQ5LTM0OGM1OTNhOTI3NyIsImFjciI6IjEiLCJhbGxvd2VkLW9yaWdpbnMiOlsiaHR0cHM6Ly9hcHB6a2NyazNna2ZpcWU4LnFyYXB0b3IuYWkvIiwiaHR0cHM6Ly9wb3J0YWwucXJhcHRvci5haS8iXSwicmVhbG1fYWNjZXNzIjp7InJvbGVzIjpbInBvcnRhbF9hZG1pbiIsInBvcnRhbF9hcHBfZGV2ZWxvcGVyIiwicG9ydGFsX2FwcF92aWV3ZXIiLCJvZmZsaW5lX2FjY2VzcyIsInBvcnRhbF9vd25lciIsImRlZmF1bHQtcm9sZXMtYXBwemtjcmszZ2tmaXFlOCIsInVtYV9hdXRob3JpemF0aW9uIl19LCJyZXNvdXJjZV9hY2Nlc3MiOnsicmVhbG0tbWFuYWdlbWVudCI6eyJyb2xlcyI6WyJ2aWV3LWlkZW50aXR5LXByb3ZpZGVycyIsInZpZXctcmVhbG0iLCJtYW5hZ2UtaWRlbnRpdHktcHJvdmlkZXJzIiwiaW1wZXJzb25hdGlvbiIsInJlYWxtLWFkbWluIiwiY3JlYXRlLWNsaWVudCIsIm1hbmFnZS11c2VycyIsInF1ZXJ5LXJlYWxtcyIsInZpZXctYXV0aG9yaXphdGlvbiIsInF1ZXJ5LWNsaWVudHMiLCJxdWVyeS11c2VycyIsIm1hbmFnZS1ldmVudHMiLCJtYW5hZ2UtcmVhbG0iLCJ2aWV3LWV2ZW50cyIsInZpZXctdXNlcnMiLCJ2aWV3LWNsaWVudHMiLCJtYW5hZ2UtYXV0aG9yaXphdGlvbiIsIm1hbmFnZS1jbGllbnRzIiwicXVlcnktZ3JvdXBzIl19LCJhY2NvdW50Ijp7InJvbGVzIjpbIm1hbmFnZS1hY2NvdW50IiwibWFuYWdlLWFjY291bnQtbGlua3MiLCJ2aWV3LXByb2ZpbGUiXX19LCJzY29wZSI6InByb2ZpbGUgZW1haWwiLCJzdWJzY3JpcHRpb25faWQiOiJhcHB6a2NyazNna2ZpcWU4IiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5hbWUiOiJBeXVzaCBLdW1hciIsInByZWZlcnJlZF91c2VybmFtZSI6ImF5dWt1bWFyIiwiZ2l2ZW5fbmFtZSI6IkF5dXNoIiwiZmFtaWx5X25hbWUiOiJLdW1hciIsImVtYWlsIjoiYXNwb2tlNDU2QG91dGxvb2suY29tIn0.IO5WoY-2l8EYgW8-vJePvyI9p4u4JcjLBQhe72uvrCjuW2slZpQ62KaTpyDZl7-7BmytmpmOfptvDETzFTPpnrlWsenyNC9YLlgFBHq-7yFPnZZ13AzNDS8RAoAKvfpxXJo664FBplLvzc85YnYkCw2asFUfF1b7NC8CdC0hFGIRBwCoLwbH9xpaDdjKPbh8_OBltWABl9bz2scr_w66SJiXk8tNByjpXYf6emsFfu8bNHi3l7Nn9eK3ZACtmrQx6KOUVyQjAPKdsw4uZAVdKYLx5w6_l2C5WD4APcsVx0cEoDnL15r4MgU9gp4mMmUP4G7vhe9bJ1CVwKX9OORxjA";
  
  console.log("Using fallback token strategy");
  return fallbackToken;
}

// 🔹 NEW: Handle successful response (extracted for reuse)
async function handleSuccessfulResponse(response, res) {
  const responseText = await response.text();
  console.log("QRaptor API Raw Response:", responseText);

  // Handle SSE (Server-Sent Events) response format
  let data;
  try {
    if (responseText.includes('data: {')) {
      console.log("Detected SSE format response");
      
      const dataLines = responseText
        .split('\n')
        .filter(line => line.startsWith('data: {'))
        .map(line => line.replace('data: ', ''));
      
      console.log("Extracted SSE data lines:", dataLines.length);
      
      let finalData = null;
      for (const line of dataLines.reverse()) {
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
      console.log("Final extracted data:", JSON.stringify(data, null, 2));
      
    } else {
      data = JSON.parse(responseText);
    }
  } catch (parseError) {
    console.error("Failed to parse response:", parseError);
    return res.status(500).json({
      error: "Failed to parse QRaptor API response",
      details: responseText.substring(0, 500) + "..."
    });
  }

  console.log("QRaptor API Success Response:", JSON.stringify(data, null, 2));
  return res.status(200).json(data);
}
