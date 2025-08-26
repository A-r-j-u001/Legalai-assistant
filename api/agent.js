export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST requests are allowed" });
  }

  if (!process.env.QRAPTOR_TOKEN) {
    console.error("QRAPTOR_TOKEN environment variable not found");
    return res.status(500).json({
      error: "Server configuration error",
      details: "QRAPTOR_TOKEN not configured on server"
    });
  }

  try {
    const response = await fetch(
      "https://appzkcrk3gkfiqe8.qraptor.ai/api/390/agent-controller/trigger-agent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.QRAPTOR_TOKEN}`,
          "Accept": "application/json"
        },
        body: JSON.stringify(req.body),
      }
    );

    const responseText = await response.text();

    if (!response.ok) {
      // Bubble up precise info so you can see 401 vs others
      return res.status(response.status).json({
        error: "QRaptor API Error",
        status: response.status,
        details: responseText
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return res.status(500).json({
        error: "Invalid JSON response from QRaptor API",
        details: responseText
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: "Proxy failed",
      details: error.message
    });
  }
}
