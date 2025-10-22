// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCEgDvWOldi07pRz-3na8oQ7QkJR0pzzKc",
    authDomain: "big-pig-38efe.firebaseapp.com",
    databaseURL: "https://big-pig-38efe-default-rtdb.firebaseio.com",
    projectId: "big-pig-38efe",
    storageBucket: "big-pig-38efe.firebasestorage.app",
    messagingSenderId: "443761891665",
    appId: "1:443761891665:web:e2246e398a6951128cdb70",
    measurementId: "G-ZM3BEXBYPW"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// DOM Elements
const loginPage = document.getElementById('loginPage');
const chatPage = document.getElementById('chatPage');
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usernameInput');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const messages = document.getElementById('messages');
const userList = document.getElementById('userList');
const userCount = document.getElementById('userCount');
const typingIndicator = document.getElementById('typingIndicator');

let currentUsername = '';
let currentUserId = '';
let typingTimeout;
let messagesRef;
let usersRef;
let typingRef;
let onlineStartTime;
let onlineTimeInterval;

// Login
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    
    if (username) {
        currentUsername = username;
        currentUserId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Add user to online list
        usersRef = database.ref('users/' + currentUserId);
        usersRef.set({
            username: username,
            joinedAt: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Remove user on disconnect
        usersRef.onDisconnect().remove();
        
        // Send system message: user joined
        database.ref('messages').push({
            type: 'system',
            text: `🔷 ${username} connected to BASE Chat`,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Switch to chat page
        loginPage.style.display = 'none';
        chatPage.style.display = 'block';
        messageInput.focus();
        
        // Start online time counter
        onlineStartTime = Date.now();
        startOnlineTimer();
        
        // Start listening to messages and users
        listenToMessages();
        listenToUsers();
        listenToTyping();
    }
});

// Send message
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    
    if (message && currentUsername) {
        database.ref('messages').push({
            type: 'message',
            username: currentUsername,
            text: message,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        messageInput.value = '';
        
        // Clear typing status
        if (typingRef) {
            typingRef.remove();
        }
    }
});

// Listen to input, show typing status
let isTyping = false;
messageInput.addEventListener('input', () => {
    if (!isTyping && currentUserId) {
        isTyping = true;
        typingRef = database.ref('typing/' + currentUserId);
        typingRef.set({
            username: currentUsername,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Auto remove after 5 seconds
        typingRef.onDisconnect().remove();
    }
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        isTyping = false;
        if (typingRef) {
            typingRef.remove();
        }
    }, 1000);
});

// Listen to messages
function listenToMessages() {
    messagesRef = database.ref('messages').limitToLast(50);
    
    messagesRef.on('child_added', (snapshot) => {
        const data = snapshot.val();
        
        if (data.type === 'system') {
            const systemMsg = document.createElement('div');
            systemMsg.className = 'system-message';
            systemMsg.textContent = data.text;
            messages.appendChild(systemMsg);
        } else {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message';
            
            const time = data.timestamp ? new Date(data.timestamp).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }) : '';
            
            messageDiv.innerHTML = `
                <div class="message-header">
                    <span class="message-username">💬 ${escapeHtml(data.username)}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text">${escapeHtml(data.text)}</div>
            `;
            
            messages.appendChild(messageDiv);
        }
        
        messages.scrollTop = messages.scrollHeight;
    });
}

// Listen to online users
function listenToUsers() {
    const allUsersRef = database.ref('users');
    
    allUsersRef.on('value', (snapshot) => {
        const usersData = snapshot.val();
        userList.innerHTML = '';
        
        if (usersData) {
            const usersArray = Object.values(usersData);
            userCount.textContent = usersArray.length;
            
            usersArray.forEach(user => {
                const userItem = document.createElement('div');
                userItem.className = 'user-item';
                userItem.textContent = user.username;
                userList.appendChild(userItem);
            });
        } else {
            userCount.textContent = '0';
        }
    });
    
    // Listen to user leaving
    allUsersRef.on('child_removed', (snapshot) => {
        const userData = snapshot.val();
        if (userData && userData.username !== currentUsername) {
            database.ref('messages').push({
                type: 'system',
                text: `⛓️ ${userData.username} disconnected from BASE Chat`,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        }
    });
}

// Listen to typing
function listenToTyping() {
    const typingUsersRef = database.ref('typing');
    
    typingUsersRef.on('value', (snapshot) => {
        const typingData = snapshot.val();
        
        if (typingData) {
            const typingUsers = Object.entries(typingData)
                .filter(([id, data]) => id !== currentUserId)
                .map(([id, data]) => data.username);
            
            if (typingUsers.length > 0) {
                typingIndicator.textContent = `💭 ${typingUsers[0]} is typing...`;
            } else {
                typingIndicator.textContent = '';
            }
        } else {
            typingIndicator.textContent = '';
        }
    });
}

// HTML escape function
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Clean up on page close
window.addEventListener('beforeunload', () => {
    if (currentUserId && currentUsername) {
        // Send leave message
        database.ref('messages').push({
            type: 'system',
            text: `⛓️ ${currentUsername} disconnected from BASE Chat`,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Remove user
        if (usersRef) {
            usersRef.remove();
        }
        
        // Remove typing status
        if (typingRef) {
            typingRef.remove();
        }
    }
});

// Periodically clean old messages (keep last 100)
if (currentUsername) {
    setInterval(() => {
        database.ref('messages').once('value', (snapshot) => {
            const messages = snapshot.val();
            if (messages) {
                const messageKeys = Object.keys(messages);
                if (messageKeys.length > 100) {
                    const toDelete = messageKeys.slice(0, messageKeys.length - 100);
                    toDelete.forEach(key => {
                        database.ref('messages/' + key).remove();
                    });
                }
            }
        });
    }, 60000); // Check every minute
}

// Periodically clean expired typing status
setInterval(() => {
    database.ref('typing').once('value', (snapshot) => {
        const typingData = snapshot.val();
        if (typingData) {
            const now = Date.now();
            Object.entries(typingData).forEach(([id, data]) => {
                if (data.timestamp && now - data.timestamp > 3000) {
                    database.ref('typing/' + id).remove();
                }
            });
        }
    });
}, 2000); // Check every 2 seconds

// Online time counter
function startOnlineTimer() {
    const onlineTimeElement = document.getElementById('onlineTime');
    if (!onlineTimeElement) return;
    
    onlineTimeInterval = setInterval(() => {
        const elapsed = Date.now() - onlineStartTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        onlineTimeElement.textContent = 
            String(minutes).padStart(2, '0') + ':' + 
            String(seconds).padStart(2, '0');
    }, 1000);
}

// Add random visit count increase effect (decorative only)
let todayVisits = 1024;
let totalVisits = 9999;

setInterval(() => {
    if (Math.random() > 0.7) {
        todayVisits += Math.floor(Math.random() * 3) + 1;
        totalVisits += Math.floor(Math.random() * 5) + 1;
        
        const todayElement = document.querySelector('.info-content p:nth-child(1) .counter');
        const totalElement = document.querySelector('.info-content p:nth-child(2) .counter');
        
        if (todayElement) todayElement.textContent = todayVisits;
        if (totalElement) totalElement.textContent = totalVisits;
    }
}, 5000); // Check every 5 seconds
