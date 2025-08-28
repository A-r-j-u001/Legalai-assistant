// api/agent.js

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

  // Resolve token from env or header fallback
  const envToken = process.env.QRAPTOR_TOKEN;
  const headerToken = req.headers['x-qraptor-token'];
  const resolvedToken = envToken || (typeof headerToken === 'string' ? headerToken : Array.isArray(headerToken) ? headerToken[0] : undefined);

  // Check if token exists
  if (!resolvedToken) {
    console.error("QRAPTOR_TOKEN not provided (env or X-QRAPTOR-TOKEN header)");
    return res.status(500).json({ 
      error: "Server configuration error", 
      details: "QRAPTOR_TOKEN env var missing and no X-QRAPTOR-TOKEN header provided" 
    });
  }

  try {
    console.log("Making request to QRaptor API...");
    console.log("Token exists:", !!resolvedToken);
    console.log("Token length:", resolvedToken?.length);
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    // Forward request to QRaptor API with exact endpoint
    const response = await fetch(
      "https://appzkcrk3gkfiqe8.qraptor.ai/api/390/agent-controller/trigger-agent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization":  ${eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICIzaldOMUt0YmpsRnFWRjFXY202RmdGZ2ZkRDJmaHNIOU9jRS1Hc0FCS29FIn0.eyJleHAiOjE3NTYzNjM5MzQsImlhdCI6MTc1NjM2MzYzNCwianRpIjoiODNmNzY1MTItNzY3ZC00NWM0LWEzYzAtZTE0ZjI3ZWZmMTU4IiwiaXNzIjoiaHR0cHM6Ly9wb3J0YWwucXJhcHRvci5haS9hdXRoMS9yZWFsbXMvYXBwemtjcmszZ2tmaXFlOCIsImF1ZCI6WyJyZWFsbS1tYW5hZ2VtZW50IiwiYWNjb3VudCJdLCJzdWIiOiIxYzc3ZTAyOC1hNjE0LTRhNDAtYTQzYy1lZTZjMTQ4YzNiNTAiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJhcHBsaWNhdGlvbiIsInNpZCI6ImZiNGJmODkyLWNlMmUtNDlkNi05OTZiLTRjMWFjN2E2M2FlMSIsImFjciI6IjEiLCJhbGxvd2VkLW9yaWdpbnMiOlsiaHR0cHM6Ly9hcHB6a2NyazNna2ZpcWU4LnFyYXB0b3IuYWkvIiwiaHR0cHM6Ly9wb3J0YWwucXJhcHRvci5haS8iXSwicmVhbG1fYWNjZXNzIjp7InJvbGVzIjpbInBvcnRhbF9hZG1pbiIsInBvcnRhbF9hcHBfZGV2ZWxvcGVyIiwicG9ydGFsX2FwcF92aWV3ZXIiLCJvZmZsaW5lX2FjY2VzcyIsInBvcnRhbF9vd25lciIsImRlZmF1bHQtcm9sZXMtYXBwemtjcmszZ2tmaXFlOCIsInVtYV9hdXRob3JpemF0aW9uIl19LCJyZXNvdXJjZV9hY2Nlc3MiOnsicmVhbG0tbWFuYWdlbWVudCI6eyJyb2xlcyI6WyJ2aWV3LWlkZW50aXR5LXByb3ZpZGVycyIsInZpZXctcmVhbG0iLCJtYW5hZ2UtaWRlbnRpdHktcHJvdmlkZXJzIiwiaW1wZXJzb25hdGlvbiIsInJlYWxtLWFkbWluIiwiY3JlYXRlLWNsaWVudCIsIm1hbmFnZS11c2VycyIsInF1ZXJ5LXJlYWxtcyIsInZpZXctYXV0aG9yaXphdGlvbiIsInF1ZXJ5LWNsaWVudHMiLCJxdWVyeS11c2VycyIsIm1hbmFnZS1ldmVudHMiLCJtYW5hZ2UtcmVhbG0iLCJ2aWV3LWV2ZW50cyIsInZpZXctdXNlcnMiLCJ2aWV3LWNsaWVudHMiLCJtYW5hZ2UtYXV0aG9yaXphdGlvbiIsIm1hbmFnZS1jbGllbnRzIiwicXVlcnktZ3JvdXBzIl19LCJhY2NvdW50Ijp7InJvbGVzIjpbIm1hbmFnZS1hY2NvdW50IiwibWFuYWdlLWFjY291bnQtbGlua3MiLCJ2aWV3LXByb2ZpbGUiXX19LCJzY29wZSI6InByb2ZpbGUgZW1haWwiLCJzdWJzY3JpcHRpb25faWQiOiJhcHB6a2NyazNna2ZpcWU4IiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5hbWUiOiJBeXVzaCBLdW1hciIsInByZWZlcnJlZF91c2VybmFtZSI6ImF5dWt1bWFyIiwiZ2l2ZW5fbmFtZSI6IkF5dXNoIiwiZmFtaWx5X25hbWUiOiJLdW1hciIsImVtYWlsIjoiYXNwb2tlNDU2QG91dGxvb2suY29tIn0.LzEg56c3nnqRBt6TiSCQCXti5QaR11mT6hqhyWsn_gQ9KCc7tikh2ZFkmIgfi2Dh_rFUnjWB9hxAGO4BCuvAL-EtJ8KGiVjH1UX8Va0eEqLztNog79d-8MaAB6atTj2B1wmGAR3bOhLETJcqvt4jOUWH9wk1WF2VjmjV_qOHx4YwNQ5TWpkiy9AFFZatCNWowvTJBh31zX7Cx_HcDB6ZU6smW2O0Ry6EJtUNtUK6LMaCf5-NiLAUvy8tFasvSgS1vcmEc1eH3SElCDZ-WBbdNG4tyGk7v2Ylj9jbR1xSHZ5Yu_wtP36fMYWln_XJDLdPw1AhMF1akpyOZEcudymkag}`,
          "Accept": "application/json"
        },
        body: JSON.stringify(req.body),
      }
    );

    console.log("QRaptor API Response Status:", response.status);
    console.log("QRaptor API Response Headers:", Object.fromEntries(response.headers.entries()));

    // Get response text first to handle both JSON and non-JSON responses
    const responseText = await response.text();
    console.log("QRaptor API Raw Response:", responseText);

    // If unauthorized, surface detailed context to client
    if (response.status === 401 || response.status === 403) {
      return res.status(response.status).json({
        error: "Unauthorized to QRaptor API",
        status: response.status,
        details: responseText || "Invalid or expired token",
      });
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

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse response as JSON:", parseError);
      return res.status(500).json({
        error: "Invalid JSON response from QRaptor API",
        details: responseText
      });
    }

    console.log("QRaptor API Success Response:", JSON.stringify(data, null, 2));
    
    return res.status(200).json(data);

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
      errorType: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

