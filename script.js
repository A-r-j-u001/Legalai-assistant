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

// --- REMOVE direct token & API url (handled in backend now) ---
// const ACCESS_TOKEN = "...";
// const QRAPTOR_API_URL = "...";

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

// --- MAIN SEND ---
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
            user_message: message,
            memory: buildMemoryString(),
            session_id: `session_${Date.now()}`,
            timestamp: new Date().toISOString()
        };

        // 🔹 Call your Vercel proxy instead of QRaptor directly
        const response = await fetch("/api/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestData)
        });

        hideTyping();

        const text = await response.text();
        let data; 
        try { data = text ? JSON.parse(text) : {}; } catch { data = { raw:text }; }

        if (!response.ok) {
            console.error("Agent Error Response:", data);
            updateAPIStatus('error','Connection Error');
            const details = typeof data === 'object' ? (data.details || data.error || JSON.stringify(data)) : String(data);
            addMessage(`⚠️ Error ${response.status}. ${details || 'Request failed.'}`,'assistant',true);
            return;
        }

        console.log("Agent Response:", data);

        let aiResponse = "";

        if (data.clarification_needed) {
            aiResponse = "I need more information to provide accurate legal guidance. Could you please provide more details?";
        } else {
            if (data.legal_reply) aiResponse += data.legal_reply.trim();
            if (data.general_reply) aiResponse += (aiResponse ? "\n\n":"") + data.general_reply.trim();
        }

        if (!aiResponse.trim()) aiResponse = "Sorry, I couldn't process your query.";

        aiResponse += "\n\n**Disclaimer:** This is for information only, not legal advice.";

        addMessage(aiResponse,'assistant');
        updateAPIStatus('connected','Legal Agent Ready');

    } catch (err) {
        hideTyping();
        console.error("Agent Error:", err);
        updateAPIStatus('error','Connection Error');
        addMessage("⚠️ There was an error connecting to the Legal Agent.",'assistant',true);
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

