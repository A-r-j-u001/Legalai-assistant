// api/agent.js - Clean QRaptor Integration (FIXED)
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_message, memory, session_id, timestamp } = req.body;

    if (!user_message) {
      return res.status(400).json({ error: 'user_message is required' });
    }

    console.log('🚀 QRaptor Agent Request:', { user_message, session_id });

    // QRaptor API call - Direct agent trigger
    const response = await fetch('https://appzkcrk3gkfige0.qraptor.ai/api/390/agent-controller/trigger-agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${process.env.QRAPTOR_USERNAME}:${process.env.QRAPTOR_PASSWORD}`).toString('base64')}`,
      },
      body: JSON.stringify({
        agent_name: 'Legal_agent',
        user_message: user_message,
        memory: memory || '',
        session_id: session_id || `session_${Date.now()}`,
        timestamp: timestamp || new Date().toISOString()
      }),
    });

    console.log('QRaptor Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('QRaptor Error:', response.status, errorText);
      
      return res.status(response.status).json({ 
        error: 'QRaptor API Error', 
        details: errorText,
        status: response.status 
      });
    }

    const responseText = await response.text();
    console.log('QRaptor Raw Response Length:', responseText.length);

    // Handle SSE format response (like your script.js expects)
    let data;
    try {
      if (responseText.includes('data: {')) {
        console.log('✅ Detected SSE format response');
        
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
        
      } else {
        data = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error('Failed to parse response:', parseError);
      return res.status(500).json({
        error: 'Failed to parse QRaptor API response',
        details: responseText.substring(0, 300) + '...'
      });
    }

    console.log('✅ QRaptor Agent Success - Data keys:', Object.keys(data));
    return res.status(200).json(data);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      details: error.message 
    });
  }
}