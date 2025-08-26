// api/agent.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST requests are allowed" });
  }

  try {
    // Forward request to QRaptor API
    const response = await fetch(
      "https://appzkcrk3gkfiqe8.qraptor.ai/api/390/agent-controller/trigger-agent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.QRAPTOR_TOKEN}` // Env variable se token
        },
        body: JSON.stringify(req.body),
      }
    );

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (error) {
    console.error("Proxy Error:", error);
    return res.status(500).json({ error: "Proxy failed", details: error.message });
  }
}
