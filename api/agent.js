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

  // 🔹 FIXED: Properly use environment variable
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

    // 🔹 FIXED: Properly use template literal with environment token
    const response = await fetch(
      "https://appzkcrk3gkfiqe8.qraptor.ai/api/390/agent-controller/trigger-agent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resolvedToken}`,  // ✅ Fixed template literal
          "Accept": "application/json"
        },
        body: JSON.stringify(req.body),
      }
    );

    console.log("QRaptor API Response Status:", response.status);
    console.log("QRaptor API Response Headers:", Object.fromEntries(response.headers.entries()));

    // Get response text first to handle both JSON and SSE responses
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

    // 🔹 FIXED: Handle SSE (Server-Sent Events) response format
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
        console.log("Final extracted data:", JSON.stringify(data, null, 2));
        
      } else {
        // Regular JSON response
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