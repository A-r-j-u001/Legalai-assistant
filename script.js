// Global variables
let sidebarCollapsed = false;
let chatHistory = [];
let isDarkMode = false;

// DOM elements
const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggleBtn');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const messagesContainer = document.getElementById('messages');
const chatContainer = document.getElementById('chatContainer');
const typingIndicator = document.getElementById('typingIndicator');
const newChatBtn = document.getElementById('newChatBtn');
const connectionStatus = document.getElementById('connectionStatus');
const statusText = document.getElementById('statusText');
const apiStatus = document.getElementById('apiStatus');
const themeToggle = document.getElementById('themeToggle');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('welcomeTime').textContent = getCurrentTime();
    loadThemePreference();
    updateConnectionStatus('connected', 'Connected to Legal Agent • Ready');
    updateAPIStatus('connected', 'Legal Agent Ready');
});

// --- THEME ---
function loadThemePreference() {
    const savedTheme = 'light';
    isDarkMode = savedTheme === 'dark';
    applyTheme();
}

function applyTheme() {
    const body = document.body;
    const toggleCircle = themeToggle.querySelector('.theme-toggle-circle i');
    if (isDarkMode) {
        body.classList.add('dark');
        themeToggle.classList.add('dark');
        toggleCircle.className = 'fas fa-moon';
    } else {
        body.classList.remove('dark');
        themeToggle.classList.remove('dark');
        toggleCircle.className = 'fas fa-sun';
    }
}

function toggleTheme() {
    isDarkMode = !isDarkMode;
    applyTheme();
}

// --- STATUS UI ---
function updateConnectionStatus(status, message) {
    const statusDot = connectionStatus.querySelector('.status-dot');
    statusDot.className = `status-dot status-${status}`;
    statusText.textContent = message;
}

function updateAPIStatus(status, message) {
    let bgClass, textClass, icon;
    switch(status) {
        case 'connected': bgClass='bg-green-100'; textClass='text-green-800'; icon='fa-check-circle'; break;
        case 'processing': bgClass='bg-blue-100'; textClass='text-blue-800'; icon='fa-sync-alt animate-spin'; break;
        case 'error': bgClass='bg-red-100'; textClass='text-red-800'; icon='fa-exclamation-triangle'; break;
        default: bgClass='bg-yellow-100'; textClass='text-yellow-800'; icon='fa-sync-alt animate-spin';
    }
    apiStatus.className = `px-3 py-1 ${bgClass} ${textClass} text-xs font-medium rounded-full`;
    apiStatus.innerHTML = `<i class="fas ${icon} mr-1"></i>${message}`;
}

function getCurrentTime() {
    return new Date().toLocaleTimeString('hi-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
}

// --- CHAT ---
function addMessage(content, type, isError=false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    if (type === 'user') {
        messageDiv.innerHTML = `
            <div class="flex justify-end">
                <div class="max-w-md bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl px-6 py-4 shadow-lg">
                    <p class="mb-2">${content}</p>
                    <p class="text-xs text-blue-100 text-right">${getCurrentTime()}</p>
                </div>
            </div>`;
    } else {
        const bgClass = isError ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200';
        const iconBg = isError ? 'from-red-500 to-red-600' : 'from-blue-600 to-purple-600';
        const icon = isError ? 'fa-exclamation-triangle' : 'fa-balance-scale';
        messageDiv.innerHTML = `
            <div class="flex justify-start">
                <div class="max-w-3xl ${bgClass} rounded-2xl px-6 py-4 shadow-sm border">
                    <div class="flex items-start space-x-3">
                        <div class="w-8 h-8 bg-gradient-to-r ${iconBg} rounded-full flex items-center justify-center">
                            <i class="fas ${icon} text-white text-sm"></i>
                        </div>
                        <div class="flex-1">
                            <div class="text-gray-900 mb-2 whitespace-pre-wrap leading-relaxed">${content}</div>
                            <p class="text-xs text-gray-500">${getCurrentTime()}</p>
                        </div>
                    </div>
                </div>
            </div>`;
    }
    messagesContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    chatHistory.push({role: type==='user'?'user':'assistant', content, timestamp:getCurrentTime()});
}

function buildMemoryString() {
    const recentHistory = chatHistory.slice(-10);
    return recentHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n');
}

function showTyping(){ typingIndicator.classList.remove('hidden'); chatContainer.scrollTop=chatContainer.scrollHeight;}
function hideTyping(){ typingIndicator.classList.add('hidden'); }

function updateSendButton() {
    const hasText = messageInput.value.trim().length > 0;
    if (hasText) {
        sendBtn.disabled=false;
        sendBtn.className='px-6 py-4 rounded-2xl transition-all duration-200 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover-effect';
    } else {
        sendBtn.disabled=true;
        sendBtn.className='px-6 py-4 rounded-2xl transition-all duration-200 bg-gray-100 text-gray-400';
    }
}

// 🔹 IMPROVED AI RESPONSE EXTRACTION FUNCTION
function extractAIResponse(data) {
    console.log("🔍 Extracting AI response from data:", data);
    
    let aiResponse = "";
    
    // Priority 1: Check outputs object first (based on logs)
    if (data.outputs) {
        console.log("📦 Found outputs object:", data.outputs);
        const outputs = data.outputs;
        
        // Check for legal_reply first (this seems to be the main response field)
        if (outputs.legal_reply && outputs.legal_reply !== null && outputs.legal_reply.trim()) {
            aiResponse = outputs.legal_reply;
            console.log("✅ Found legal_reply:", aiResponse.substring(0, 100) + "...");
        }
        // Check for general_reply as backup
        else if (outputs.general_reply && outputs.general_reply !== null && outputs.general_reply.trim()) {
            aiResponse = outputs.general_reply;
            console.log("✅ Found general_reply:", aiResponse.substring(0, 100) + "...");
        }
        // Check other possible response fields in outputs
        else if (outputs.response && outputs.response !== null && outputs.response.trim()) {
            aiResponse = outputs.response;
            console.log("✅ Found outputs.response:", aiResponse.substring(0, 100) + "...");
        }
        else if (outputs.message && outputs.message !== null && outputs.message.trim()) {
            aiResponse = outputs.message;
            console.log("✅ Found outputs.message:", aiResponse.substring(0, 100) + "...");
        }
        else {
            console.log("⚠️ No valid response found in outputs. Available fields:", Object.keys(outputs));
        }
    }
    
    // Priority 2: Check direct response fields if outputs didn't have what we need
    if (!aiResponse) {
        if (data.response && data.response.trim()) {
            aiResponse = data.response;
            console.log("✅ Found direct response:", aiResponse.substring(0, 100) + "...");
        }
        else if (data.message && data.message.trim()) {
            aiResponse = data.message;
            console.log("✅ Found direct message:", aiResponse.substring(0, 100) + "...");
        }
        else if (data.legal_reply && data.legal_reply.trim()) {
            aiResponse = data.legal_reply;
            console.log("✅ Found direct legal_reply:", aiResponse.substring(0, 100) + "...");
        }
        else if (data.general_reply && data.general_reply.trim()) {
            aiResponse = data.general_reply;
            console.log("✅ Found direct general_reply:", aiResponse.substring(0, 100) + "...");
        }
    }
    
    // Priority 3: Check for system message data
    if (!aiResponse && data.system_message && data.system_message.data) {
        aiResponse = data.system_message.data
            .replace(/\r\n/g, '\n')
            .replace(/None/g, '')
            .replace(/False/g, '')
            .replace(/True/g, '')
            .trim();
        console.log("✅ Found system_message.data:", aiResponse.substring(0, 100) + "...");
    }
    
    // Priority 4: Check raw_response
    if (!aiResponse && data.raw_response) {
        aiResponse = data.raw_response;
        console.log("✅ Found raw_response:", aiResponse.substring(0, 100) + "...");
    }
    
    // Clean up the response if found
    if (aiResponse && typeof aiResponse === 'string') {
        aiResponse = aiResponse.trim();
        
        // Remove common API artifacts and clean up formatting
        aiResponse = aiResponse
            .replace(/^["']|["']$/g, '') // Remove quotes at start/end
            .replace(/\\n/g, '\n') // Convert escaped newlines
            .replace(/\\"/g, '"') // Convert escaped quotes
            .replace(/\\r/g, '') // Remove escaped carriage returns
            .trim();
            
        console.log("🧹 Cleaned response:", aiResponse.substring(0, 100) + "...");
    }
    
    return aiResponse;
}

// --- SEND MESSAGE FUNCTION (KEEPING API CALLS UNCHANGED) ---
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    messageInput.value = '';
    updateSendButton();

    showTyping();
    updateAPIStatus('processing','Legal Agent Processing...');

    try {
        const requestData = {
            user_message: message
        };

        console.log('Sending request:', requestData);

        const response = await fetch("/api/agent", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(requestData)
        });

        hideTyping();

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        const responseText = await response.text();
        console.log('Raw response text:', responseText);

        let data;
        try {
            data = responseText ? JSON.parse(responseText) : {};
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            data = { raw_response: responseText, parse_error: parseError.message };
        }

        if (!response.ok) {
            console.error("API Error Response:", data);
            updateAPIStatus('error', 'Connection Error');
            
            // Handle specific error cases
            if (response.status === 401) {
                addMessage(`🔐 **Authentication Error**\n\nThere seems to be an issue with the API credentials. Please check:\n- QRaptor username and password are correctly set\n- Account has proper permissions\n\nError details: ${data.details || data.error || 'Invalid credentials'}`, 'assistant', true);
            } else if (response.status === 404) {
                addMessage(`🔍 **Endpoint Not Found**\n\nThe API endpoint couldn't be found. This might be a configuration issue.\n\nError: ${data.details || data.error || 'Endpoint not found'}`, 'assistant', true);
            } else {
                const errorDetails = data.details || data.error || JSON.stringify(data) || 'Unknown error occurred';
                addMessage(`⚠️ **Error ${response.status}**\n\n${errorDetails}`, 'assistant', true);
            }
            return;
        }

        console.log("✅ Successful API Response:", data);

        // 🔹 USE THE NEW IMPROVED EXTRACTION FUNCTION
        let aiResponse = extractAIResponse(data);

        // Final fallback if no response found
        if (!aiResponse) {
            console.warn('❌ No valid response found in data:', data);
            console.log("📋 Available data keys:", Object.keys(data));
            
            // Try to extract ANY text content as last resort
            const dataStr = JSON.stringify(data);
            if (dataStr.length > 100) {
                aiResponse = "I received your message and processed it successfully, but I'm having trouble extracting the response. Please try asking your question again.";
            } else {
                aiResponse = "I apologize, but I couldn't generate a proper response to your legal query. Please try rephrasing your question or contact support if the issue persists.";
            }
        }

        // Add legal disclaimer if not already present
        if (aiResponse && !aiResponse.includes('Disclaimer') && !aiResponse.includes('legal advice') && !aiResponse.includes('educational purposes')) {
            aiResponse += "\n\n**Legal Disclaimer:** This information is for educational purposes only and does not constitute legal advice. Please consult a qualified lawyer for specific legal matters.";
        }

        console.log("📤 Displaying response to user:", aiResponse.substring(0, 200) + "...");
        addMessage(aiResponse, 'assistant');
        updateAPIStatus('connected', 'Legal Agent Ready');

    } catch (networkError) {
        hideTyping();
        console.error("Network/Fetch Error:", networkError);
        updateAPIStatus('error', 'Connection Failed');
        
        let errorMessage = "🌐 **Connection Error**\n\n";
        if (networkError.name === 'TypeError' && networkError.message.includes('fetch')) {
            errorMessage += "Unable to connect to the Legal Agent API. Please check:\n- Your internet connection\n- API server status\n- Firewall settings";
        } else {
            errorMessage += `Network error: ${networkError.message}`;
        }
        
        addMessage(errorMessage, 'assistant', true);
    }
}

// --- EVENTS ---
toggleBtn.addEventListener('click',()=>{ sidebarCollapsed=!sidebarCollapsed; sidebar.classList.toggle('collapsed',sidebarCollapsed); });
document.getElementById('toggleBtnIcon').addEventListener('click',()=>{ sidebarCollapsed=!sidebarCollapsed; sidebar.classList.toggle('collapsed',sidebarCollapsed); });
themeToggle.addEventListener('click', toggleTheme);
messageInput.addEventListener('input',()=>{updateSendButton();});
messageInput.addEventListener('keydown',function(e){ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); if(!sendBtn.disabled) sendMessage(); }});
sendBtn.addEventListener('click',sendMessage);
newChatBtn.addEventListener('click',()=>{ chatHistory=[]; messagesContainer.innerHTML=""; });
