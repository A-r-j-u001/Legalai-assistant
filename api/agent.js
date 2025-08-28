// api/agent.js
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Only POST requests are allowed" });
  }

  // 🔹 Get current token from cache or login
  let accessToken = await getCachedAccessToken();

  if (!accessToken) {
    console.log("No cached token, logging in...");
    accessToken = await loginWithCredentials();
    if (!accessToken) {
      return res.status(500).json({
        error: "Login failed",
        details: "Could not authenticate with QRaptor"
      });
    }
  }

  // 🔹 Validate and refresh token if needed
  try {
    accessToken = await validateAndRefreshToken(accessToken);
  } catch (err) {
    console.error("Token validation/refresh failed:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      details: "Failed to obtain valid token"
    });
  }

  // 🔹 Make request to QRaptor API
  try {
    const response = await fetch(
      "https://appzkcrk3gkfiqe8.qraptor.ai/api/390/agent-controller/trigger-agent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json"
        },
        body: JSON.stringify(req.body),
      }
    );

    if (response.status === 401 || response.status === 403) {
      console.log("Token expired during request, attempting refresh...");
      const newToken = await refreshQRaptorToken();
      if (newToken) {
        console.log("Retrying with new token...");
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
        return handleSuccessfulResponse(retryResponse, res);
      } else {
        return res.status(401).json({
          error: "Unauthorized",
          details: "Token expired and refresh failed"
        });
      }
    }

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        error: "QRaptor API Error",
        status: response.status,
        details: text
      });
    }

    return handleSuccessfulResponse(response, res);

  } catch (error) {
    console.error("Proxy Error:", error);
    if (error.name === 'AbortError') {
      return res.status(408).json({ error: "Request timeout", details: "QRaptor API timed out" });
    }
    return res.status(500).json({ error: "Proxy failed", details: error.message });
  }
}

// 🔹 Cache for tokens (in-memory, reset on server restart)
let cachedAccessToken = null;
let cachedRefreshToken = null;

// 🔹 Login with username/password
async function loginWithCredentials() {
  const username = process.env.QRAPTOR_USERNAME;
  const password = process.env.QRAPTOR_PASSWORD;
  const clientId = process.env.QRAPTOR_CLIENT_ID || "application";

  if (!username || !password) {
    throw new Error("Missing username or password");
  }

  const response = await fetch(
    "https://portal.qraptor.ai/auth1/realms/appzkcrk3gkfiqe8/protocol/openid-connect/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: clientId,
        username: username,
        password: password,
      })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error("Login failed:", response.status, text);
    return null;
  }

  const data = await response.json();
  cachedAccessToken = data.access_token;
  cachedRefreshToken = data.refresh_token;
  console.log("✅ Logged in successfully. Token expires in", data.expires_in, "seconds");

  return cachedAccessToken;
}

// 🔹 Get cached access token
async function getCachedAccessToken() {
  if (cachedAccessToken && isTokenValid(cachedAccessToken)) {
    return cachedAccessToken;
  }
  return null;
}

// 🔹 Check if token is still valid
function isTokenValid(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now + 60; // Allow 1 min buffer
  } catch (e) {
    return false;
  }
}

// 🔹 Validate and refresh token
async function validateAndRefreshToken(token) {
  if (isTokenExpired(token)) {
    console.log("Token expired, refreshing...");
    const newToken = await refreshQRaptorToken();
    if (newToken) {
      cachedAccessToken = newToken;
      return newToken;
    }
  }

  if (isTokenExpiringSoon(token)) {
    console.log("Token expiring soon, proactively refreshing...");
    const newToken = await refreshQRaptorToken();
    if (newToken) {
      cachedAccessToken = newToken;
      return newToken;
    }
  }

  return token;
}

// 🔹 Check if token is expired
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    return payload.exp <= now;
  } catch (e) {
    return true;
  }
}

// 🔹 Check if token expires within 5 minutes
function isTokenExpiringSoon(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    const fiveMinutes = now + 300;
    return payload.exp <= fiveMinutes;
  } catch (e) {
    return false;
  }
}

// 🔹 Refresh token using refresh_token
async function refreshQRaptorToken() {
  if (!cachedRefreshToken) {
    console.error("No refresh token available");
    return null;
  }

  const response = await fetch(
    "https://portal.qraptor.ai/auth1/realms/appzkcrk3gkfiqe8/protocol/openid-connect/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.QRAPTOR_CLIENT_ID || "application",
        refresh_token: cachedRefreshToken,
      })
    }
  );

  if (response.ok) {
    const data = await response.json();
    cachedAccessToken = data.access_token;
    cachedRefreshToken = data.refresh_token || cachedRefreshToken; // Keep old if no new one
    console.log("✅ Token refreshed successfully");
    return data.access_token;
  } else {
    const text = await response.text();
    console.error("❌ Token refresh failed:", response.status, text);
    return null;
  }
}

// 🔹 Handle successful response
async function handleSuccessfulResponse(response, res) {
  const text = await response.text();
  let data;

  try {
    if (text.includes('data: {')) {
      const lines = text.split('\n').filter(line => line.startsWith('data: '));
      let finalData = null;
      for (const line of lines.reverse()) {
        try {
          const parsed = JSON.parse(line.replace('data: ', ''));
          if (parsed.agentExecutionComplete === true || parsed.outputs) {
            finalData = parsed;
            break;
          }
        } catch {}
      }
      data = finalData || JSON.parse(lines[lines.length - 1].replace('data: ', ''));
    } else {
      data = JSON.parse(text);
    }
  } catch (err) {
    return res.status(500).json({
      error: "Failed to parse QRaptor response",
      details: text.substring(0, 500)
    });
  }

  return res.status(200).json(data);
}
