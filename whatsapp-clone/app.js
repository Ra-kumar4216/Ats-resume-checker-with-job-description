/**
 * WhatsApp Web Clone - Complete Application Logic
 */

// PRESET AVATARS FOR USER & CONTACTS
const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80'
];

const POPULAR_EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
  '🤯', '😳', '🥳', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
  '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
  '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
  '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
  '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
  '🙏', '✍️', '💅', '🤳', '💪', '❤️', '🧡', '💛', '💚', '💙'
];

// DEFAULT CONTACTS
const DEFAULT_CONTACTS = [
  {
    id: 'contact_ai_bot',
    name: 'WhatsApp AI Assistant 🤖',
    phone: '+1 800 555 0199',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    about: 'I am your smart WhatsApp AI assistant.',
    isBot: true,
    pinned: true,
    unreadCount: 1,
    lastMessage: 'Hello! I am your AI Assistant. Ask me anything or send a message!',
    lastTime: '10:00 AM'
  },
  {
    id: 'contact_priya',
    name: 'Priya Sharma',
    phone: '+91 98765 43210',
    avatar: PRESET_AVATARS[0],
    about: 'At work 💻',
    isBot: false,
    pinned: true,
    unreadCount: 0,
    lastMessage: 'Are we meeting today for the project discussion?',
    lastTime: 'Yesterday'
  },
  {
    id: 'contact_rahul',
    name: 'Rahul Verma',
    phone: '+91 91234 56789',
    avatar: PRESET_AVATARS[1],
    about: 'Battery about to die 🪫',
    isBot: false,
    pinned: false,
    unreadCount: 2,
    lastMessage: 'Check out this awesome new WhatsApp Web Clone!',
    lastTime: '09:15 AM'
  },
  {
    id: 'contact_ananya',
    name: 'Ananya Gupta',
    phone: '+91 99887 76655',
    avatar: PRESET_AVATARS[2],
    about: 'Urgent calls only 📞',
    isBot: false,
    pinned: false,
    unreadCount: 0,
    lastMessage: 'Thanks for sharing the files!',
    lastTime: 'Jul 12'
  }
];

// SAMPLE INITIAL STATUSES
const INITIAL_STATUSES = [
  {
    id: 'status_1',
    authorName: 'Priya Sharma',
    authorAvatar: PRESET_AVATARS[0],
    text: 'Enjoying a coffee break after a great coding session! ☕✨',
    bg: 'bg-gradient-to-tr from-purple-600 to-indigo-600',
    time: '10:15 AM'
  },
  {
    id: 'status_2',
    authorName: 'Rahul Verma',
    authorAvatar: PRESET_AVATARS[1],
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
    text: 'Weekend getaway at the beach! 🌊☀️',
    time: '08:30 AM'
  }
];

// STATE MANAGEMENT
let currentUser = null;
let selectedLoginAvatar = PRESET_AVATARS[0];
let contacts = [];
let activeContactId = null;
let messagesStore = {};
let currentFilter = 'all';
let statuses = [];
let statusProgressInterval = null;

// Call State
let callTimerInterval = null;
let callSeconds = 0;
let callMediaStream = null;

// Audio & Recording State
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// REAL-TIME MULTI-TAB BROADCAST CHANNEL
const syncChannel = new BroadcastChannel('whatsapp_clone_sync_channel');

// DOM ELEMENTS
const authScreen = document.getElementById('auth-screen');
const mainApp = document.getElementById('main-app');
const loginNameInput = document.getElementById('login-name');
const loginPhoneInput = document.getElementById('login-phone');
const loginAboutInput = document.getElementById('login-about');
const avatarSelectorContainer = document.getElementById('avatar-selector');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');

const userNameDisplay = document.getElementById('user-name-display');
const userStatusDisplay = document.getElementById('user-status-display');
const userAvatarImg = document.getElementById('user-avatar-img');

const chatListContainer = document.getElementById('chat-list');
const searchChatsInput = document.getElementById('search-chats');
const noChatSelectedView = document.getElementById('no-chat-selected');
const activeChatContainer = document.getElementById('active-chat-container');

// Chat Header Elements
const chatHeaderAvatar = document.getElementById('chat-header-avatar');
const chatHeaderName = document.getElementById('chat-header-name');
const chatHeaderStatus = document.getElementById('chat-header-status');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const btnSendMessage = document.getElementById('btn-send-message');
const btnMicRecorder = document.getElementById('btn-mic-recorder');
const micIcon = document.getElementById('mic-icon');

// Emoji & Attachments
const btnToggleEmoji = document.getElementById('btn-toggle-emoji');
const emojiPicker = document.getElementById('emoji-picker');
const btnToggleAttach = document.getElementById('btn-toggle-attach');
const attachmentMenu = document.getElementById('attachment-menu');
const attachImageInput = document.getElementById('attach-image-input');
const attachDocInput = document.getElementById('attach-doc-input');

// Chat Menu & Search
const btnChatMenu = document.getElementById('btn-chat-menu');
const chatDropdownMenu = document.getElementById('chat-dropdown-menu');
const menuOptClear = document.getElementById('menu-opt-clear');
const menuOptPin = document.getElementById('menu-opt-pin');
const menuOptDelete = document.getElementById('menu-opt-delete');

const btnSearchMessages = document.getElementById('btn-search-messages');
const inChatSearchBar = document.getElementById('in-chat-search-bar');
const chatSearchInput = document.getElementById('chat-search-input');
const btnCloseChatSearch = document.getElementById('btn-close-chat-search');

// Status Elements
const btnAddStatus = document.getElementById('btn-add-status');
const myStatusCard = document.getElementById('my-status-card');
const modalAddStatus = document.getElementById('modal-add-status');
const btnCloseAddStatus = document.getElementById('btn-close-add-status');
const btnSubmitStatus = document.getElementById('btn-submit-status');
const statusTextInput = document.getElementById('status-text-input');
const statusImageInput = document.getElementById('status-image-input');
const statusListContainer = document.getElementById('status-list');

const modalStatusViewer = document.getElementById('modal-status-viewer');
const btnCloseStatusViewer = document.getElementById('btn-close-status-viewer');
const statusViewerAvatar = document.getElementById('status-viewer-avatar');
const statusViewerAuthor = document.getElementById('status-viewer-author');
const statusViewerTime = document.getElementById('status-viewer-time');
const statusViewerContent = document.getElementById('status-viewer-content');
const statusProgressBar = document.getElementById('status-progress-bar');

// Settings Elements
const btnThemeToggle = document.getElementById('btn-theme-toggle');
const themeToggleDot = document.getElementById('theme-toggle-dot');
const settingSoundCheckbox = document.getElementById('setting-sound');
const wallpaperPicker = document.getElementById('wallpaper-picker');

// Call Modal Elements
const btnAudioCall = document.getElementById('btn-audio-call');
const btnVideoCall = document.getElementById('btn-video-call');
const modalCall = document.getElementById('modal-call');
const callAvatar = document.getElementById('call-avatar');
const callTypeIcon = document.getElementById('call-type-icon');
const callUserName = document.getElementById('call-user-name');
const callStatus = document.getElementById('call-status');
const callTimer = document.getElementById('call-timer');
const callVideoContainer = document.getElementById('call-video-container');
const callLocalVideo = document.getElementById('call-local-video');
const btnCallEnd = document.getElementById('btn-call-end');

// Modal Elements
const modalAddContact = document.getElementById('modal-add-contact');
const btnAddContact = document.getElementById('btn-add-contact');
const btnCloseAddContact = document.getElementById('btn-close-add-contact');
const btnSaveContact = document.getElementById('btn-save-contact');
const newContactName = document.getElementById('new-contact-name');
const newContactPhone = document.getElementById('new-contact-phone');

// Navigation Tabs
const navTabChats = document.getElementById('nav-tab-chats');
const navTabStatus = document.getElementById('nav-tab-status');
const btnSettingsToggle = document.getElementById('btn-settings-toggle');
const viewChats = document.getElementById('view-chats');
const viewStatus = document.getElementById('view-status');
const viewSettings = document.getElementById('view-settings');

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  initAvatarSelector();
  initEmojiPicker();
  checkExistingAuth();
  setupAuthEventListeners();
  setupNavigationAndModals();
  setupMessagingHandlers();
  setupStatusHandlers();
  setupSettingsAndTheme();
  setupCallHandlers();
  setupBroadcastChannelListener();
});

// Broadcast Channel Real-time Sync across Tabs
function setupBroadcastChannelListener() {
  syncChannel.onmessage = (event) => {
    const { type, payload } = event.data;

    if (type === 'NEW_MESSAGE') {
      const { senderId, targetId, message } = payload;

      if (currentUser && (targetId === currentUser.phone || senderId === currentUser.phone)) {
        const chatPartnerKey = senderId === currentUser.phone ? targetId : senderId;

        let contact = contacts.find(c => c.phone === chatPartnerKey || c.id === chatPartnerKey);
        if (!contact) {
          contact = {
            id: 'contact_' + Date.now(),
            name: payload.senderName || chatPartnerKey,
            phone: chatPartnerKey,
            avatar: payload.senderAvatar || PRESET_AVATARS[3],
            about: 'Available',
            isBot: false,
            pinned: false,
            unreadCount: 0,
            lastMessage: message.text || 'Media message',
            lastTime: message.time
          };
          contacts.push(contact);
        }

        if (!messagesStore[contact.id]) {
          messagesStore[contact.id] = [];
        }

        messagesStore[contact.id].push(message);
        contact.lastMessage = message.text || (message.type === 'image' ? '📷 Photo' : (message.type === 'audio' ? '🎵 Voice Note' : '📄 Document'));
        contact.lastTime = message.time;

        if (activeContactId !== contact.id && senderId !== currentUser.phone) {
          contact.unreadCount = (contact.unreadCount || 0) + 1;
          playNotificationSound();
        }

        saveStateToLocalStorage();
        renderChatList();
        if (activeContactId === contact.id) {
          renderMessages();
        }
      }
    } else if (type === 'NEW_STATUS') {
      statuses.unshift(payload);
      saveStatusesToLocalStorage();
      renderStatusList();
    } else if (type === 'TYPING') {
      if (currentUser && payload.targetPhone === currentUser.phone) {
        showTypingIndicator(payload.senderName);
      }
    }
  };
}

// Play notification sound using Web Audio API
function playNotificationSound() {
  if (settingSoundCheckbox && !settingSoundCheckbox.checked) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // A5

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {
    console.log("Audio Context play notice", e);
  }
}

// Setup Theme & Preferences
function setupSettingsAndTheme() {
  // Theme Toggle
  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      const isDark = document.documentElement.classList.contains('dark');
      localStorage.setItem('wa_theme', isDark ? 'dark' : 'light');
    });
  }

  // Load saved theme preference
  const savedTheme = localStorage.getItem('wa_theme');
  if (savedTheme === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
  }

  // Wallpaper Picker
  if (wallpaperPicker) {
    wallpaperPicker.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        wallpaperPicker.querySelectorAll('button').forEach(b => b.classList.remove('border-2', 'border-wa-teal'));
        btn.classList.add('border-2', 'border-wa-teal');

        const wall = btn.dataset.wall;
        messagesContainer.className = 'flex-1 overflow-y-auto p-4 md:p-6 space-y-3 relative wa-bg-pattern';

        if (wall === 'dark') messagesContainer.classList.add('bg-slate-900');
        else if (wall === 'blue') messagesContainer.classList.add('bg-slate-900/90');
        else if (wall === 'purple') messagesContainer.classList.add('bg-purple-950/20');
      });
    });
  }
}

// Setup Audio/Video Call Mock Interface
function setupCallHandlers() {
  if (btnAudioCall) btnAudioCall.addEventListener('click', () => startCall('audio'));
  if (btnVideoCall) btnVideoCall.addEventListener('click', () => startCall('video'));
  if (btnCallEnd) btnCallEnd.addEventListener('click', endCall);
}

function startCall(type) {
  if (!activeContactId) return;
  const contact = contacts.find(c => c.id === activeContactId);
  if (!contact) return;

  modalCall.classList.remove('hidden');
  callAvatar.src = contact.avatar;
  callUserName.textContent = contact.name;
  callTypeIcon.className = type === 'video' ? 'fa-solid fa-video' : 'fa-solid fa-phone';

  callStatus.textContent = 'Connecting...';
  callTimer.textContent = '00:00';

  if (type === 'video') {
    callVideoContainer.classList.remove('hidden');
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        callMediaStream = stream;
        callLocalVideo.srcObject = stream;
      })
      .catch(() => {
        callStatus.textContent = 'Camera access denied (Simulating Call)';
      });
  } else {
    callVideoContainer.classList.add('hidden');
  }

  setTimeout(() => {
    callStatus.textContent = 'Connected (00:00)';
    callSeconds = 0;
    clearInterval(callTimerInterval);
    callTimerInterval = setInterval(() => {
      callSeconds++;
      const mins = String(Math.floor(callSeconds / 60)).padStart(2, '0');
      const secs = String(callSeconds % 60).padStart(2, '0');
      callTimer.textContent = `${mins}:${secs}`;
    }, 1000);
  }, 1500);
}

function endCall() {
  modalCall.classList.add('hidden');
  clearInterval(callTimerInterval);
  if (callMediaStream) {
    callMediaStream.getTracks().forEach(track => track.stop());
    callMediaStream = null;
  }
}

// Render avatar options
function initAvatarSelector() {
  if (!avatarSelectorContainer) return;
  avatarSelectorContainer.innerHTML = '';

  PRESET_AVATARS.forEach((url, idx) => {
    const img = document.createElement('img');
    img.src = url;
    img.alt = `Avatar ${idx + 1}`;
    img.className = `w-12 h-12 rounded-full object-cover cursor-pointer border-2 transition duration-150 ${
      url === selectedLoginAvatar ? 'border-wa-teal scale-110' : 'border-transparent opacity-70 hover:opacity-100'
    }`;
    img.addEventListener('click', () => {
      selectedLoginAvatar = url;
      initAvatarSelector();
    });
    avatarSelectorContainer.appendChild(img);
  });
}

function initEmojiPicker() {
  if (!emojiPicker) return;
  emojiPicker.innerHTML = '';
  POPULAR_EMOJIS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'hover:bg-slate-100 dark:hover:bg-wa-darkHover rounded p-1 text-lg transition';
    btn.textContent = emoji;
    btn.addEventListener('click', () => {
      messageInput.value += emoji;
      messageInput.focus();
    });
    emojiPicker.appendChild(btn);
  });
}

function checkExistingAuth() {
  const storedUser = localStorage.getItem('wa_clone_current_user');
  if (storedUser) {
    try {
      currentUser = JSON.parse(storedUser);
      loadAppForUser();
    } catch (e) {
      console.error("Failed to parse stored user", e);
    }
  }
}

function setupAuthEventListeners() {
  if (btnLogin) btnLogin.addEventListener('click', handleLogin);
  if (btnLogout) btnLogout.addEventListener('click', handleLogout);
}

function setupNavigationAndModals() {
  if (navTabChats) navTabChats.addEventListener('click', () => switchSidebarView('chats'));
  if (navTabStatus) navTabStatus.addEventListener('click', () => switchSidebarView('status'));
  if (btnSettingsToggle) btnSettingsToggle.addEventListener('click', () => switchSidebarView('settings'));

  if (btnAddContact) btnAddContact.addEventListener('click', () => modalAddContact.classList.remove('hidden'));
  if (btnCloseAddContact) btnCloseAddContact.addEventListener('click', () => modalAddContact.classList.add('hidden'));
  if (btnSaveContact) btnSaveContact.addEventListener('click', handleAddContact);

  if (searchChatsInput) {
    searchChatsInput.addEventListener('input', (e) => renderChatList(e.target.value.toLowerCase()));
  }

  document.querySelectorAll('.chat-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chat-filter-btn').forEach(b => {
        b.classList.remove('bg-wa-teal', 'text-white');
        b.classList.add('bg-slate-100', 'dark:bg-wa-darkHeader', 'text-slate-600', 'dark:text-slate-300');
      });
      btn.classList.remove('bg-slate-100', 'dark:bg-wa-darkHeader', 'text-slate-600', 'dark:text-slate-300');
      btn.classList.add('bg-wa-teal', 'text-white');
      currentFilter = btn.dataset.filter;
      renderChatList();
    });
  });

  const btnBackToChats = document.getElementById('btn-back-to-chats');
  if (btnBackToChats) {
    btnBackToChats.addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('hidden');
      activeChatContainer.classList.add('hidden');
      noChatSelectedView.classList.remove('hidden');
    });
  }
}

function setupStatusHandlers() {
  if (btnAddStatus) btnAddStatus.addEventListener('click', () => modalAddStatus.classList.remove('hidden'));
  if (myStatusCard) myStatusCard.addEventListener('click', () => modalAddStatus.classList.remove('hidden'));
  if (btnCloseAddStatus) btnCloseAddStatus.addEventListener('click', () => modalAddStatus.classList.add('hidden'));

  if (btnSubmitStatus) btnSubmitStatus.addEventListener('click', createStatusUpdate);
  if (btnCloseStatusViewer) btnCloseStatusViewer.addEventListener('click', closeStatusViewer);
}

function createStatusUpdate() {
  const text = statusTextInput.value.trim();
  const file = statusImageInput.files[0];

  if (!text && !file) {
    alert('Please enter text or choose an image for your status.');
    return;
  }

  const postStatusObj = (imageUrl = null) => {
    const newStatus = {
      id: 'status_' + Date.now(),
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar,
      text: text,
      imageUrl: imageUrl,
      bg: 'bg-gradient-to-tr from-emerald-600 to-teal-700',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    statuses.unshift(newStatus);
    saveStatusesToLocalStorage();
    renderStatusList();

    syncChannel.postMessage({
      type: 'NEW_STATUS',
      payload: newStatus
    });

    statusTextInput.value = '';
    statusImageInput.value = '';
    modalAddStatus.classList.add('hidden');
    alert('Status update posted!');
  };

  if (file) {
    const reader = new FileReader();
    reader.onload = (evt) => postStatusObj(evt.target.result);
    reader.readAsDataURL(file);
  } else {
    postStatusObj();
  }
}

function renderStatusList() {
  if (!statusListContainer) return;
  statusListContainer.innerHTML = '';

  if (statuses.length === 0) {
    statusListContainer.innerHTML = `<p class="text-xs text-slate-400 italic p-2">No recent status updates</p>`;
    return;
  }

  statuses.forEach(st => {
    const item = document.createElement('div');
    item.className = 'flex items-center gap-3 p-3 bg-white dark:bg-wa-darkHeader rounded-xl shadow-xs cursor-pointer border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-wa-darkHover transition';
    item.innerHTML = `
      <div class="relative p-0.5 rounded-full ring-2 ring-wa-teal">
        <img src="${st.authorAvatar}" class="w-10 h-10 rounded-full object-cover">
      </div>
      <div class="flex-1">
        <h4 class="font-semibold text-sm text-slate-800 dark:text-slate-100">${st.authorName}</h4>
        <p class="text-xs text-slate-500 dark:text-slate-400">${st.time}</p>
      </div>
    `;

    item.addEventListener('click', () => openStatusViewer(st));
    statusListContainer.appendChild(item);
  });
}

function openStatusViewer(status) {
  modalStatusViewer.classList.remove('hidden');
  statusViewerAvatar.src = status.authorAvatar;
  statusViewerAuthor.textContent = status.authorName;
  statusViewerTime.textContent = status.time;

  statusViewerContent.innerHTML = '';

  if (status.imageUrl) {
    statusViewerContent.innerHTML = `
      <div class="relative max-w-full max-h-full flex flex-col items-center">
        <img src="${status.imageUrl}" class="max-h-[75vh] rounded-lg object-contain mb-4">
        ${status.text ? `<p class="text-white text-lg font-medium bg-black/50 px-4 py-2 rounded-full">${status.text}</p>` : ''}
      </div>
    `;
  } else {
    statusViewerContent.innerHTML = `
      <div class="w-full h-full min-h-[400px] flex items-center justify-center p-8 rounded-2xl ${status.bg || 'bg-gradient-to-tr from-teal-600 to-emerald-700'} text-white">
        <p class="text-2xl md:text-4xl font-bold max-w-xl leading-relaxed">${status.text}</p>
      </div>
    `;
  }

  statusProgressBar.style.width = '0%';
  let progress = 0;
  clearInterval(statusProgressInterval);

  statusProgressInterval = setInterval(() => {
    progress += 2;
    statusProgressBar.style.width = progress + '%';
    if (progress >= 100) {
      clearInterval(statusProgressInterval);
      closeStatusViewer();
    }
  }, 100);
}

function closeStatusViewer() {
  clearInterval(statusProgressInterval);
  modalStatusViewer.classList.add('hidden');
}

function saveStatusesToLocalStorage() {
  localStorage.setItem('wa_clone_statuses', JSON.stringify(statuses));
}

function loadStatuses() {
  const stored = localStorage.getItem('wa_clone_statuses');
  if (stored) {
    try {
      statuses = JSON.parse(stored);
    } catch (e) {
      statuses = [...INITIAL_STATUSES];
    }
  } else {
    statuses = [...INITIAL_STATUSES];
  }
  renderStatusList();
}

function setupMessagingHandlers() {
  btnSendMessage.addEventListener('click', sendTextMessage);
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    } else {
      broadcastTypingSignal();
    }
  });

  btnToggleEmoji.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.classList.toggle('hidden');
    attachmentMenu.classList.add('hidden');
  });

  btnToggleAttach.addEventListener('click', (e) => {
    e.stopPropagation();
    attachmentMenu.classList.toggle('hidden');
    emojiPicker.classList.add('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && e.target !== btnToggleEmoji) emojiPicker.classList.add('hidden');
    if (!attachmentMenu.contains(e.target) && e.target !== btnToggleAttach) attachmentMenu.classList.add('hidden');
    if (chatDropdownMenu && !chatDropdownMenu.contains(e.target) && e.target !== btnChatMenu) chatDropdownMenu.classList.add('hidden');
  });

  attachImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => sendMediaMessage('image', evt.target.result, file.name);
      reader.readAsDataURL(file);
    }
    attachmentMenu.classList.add('hidden');
  });

  attachDocInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) sendMediaMessage('document', '', file.name);
    attachmentMenu.classList.add('hidden');
  });

  btnMicRecorder.addEventListener('click', toggleVoiceRecorder);

  if (btnChatMenu) {
    btnChatMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      chatDropdownMenu.classList.toggle('hidden');
    });
  }

  if (menuOptClear) {
    menuOptClear.addEventListener('click', () => {
      if (activeContactId && confirm('Are you sure you want to clear all messages in this chat?')) {
        messagesStore[activeContactId] = [];
        saveStateToLocalStorage();
        renderMessages();
        renderChatList();
      }
      chatDropdownMenu.classList.add('hidden');
    });
  }

  if (menuOptPin) {
    menuOptPin.addEventListener('click', () => {
      if (activeContactId) {
        const c = contacts.find(item => item.id === activeContactId);
        if (c) {
          c.pinned = !c.pinned;
          saveStateToLocalStorage();
          renderChatList();
        }
      }
      chatDropdownMenu.classList.add('hidden');
    });
  }

  if (menuOptDelete) {
    menuOptDelete.addEventListener('click', () => {
      if (activeContactId && confirm('Delete this chat?')) {
        contacts = contacts.filter(c => c.id !== activeContactId);
        delete messagesStore[activeContactId];
        activeContactId = null;
        saveStateToLocalStorage();
        renderChatList();
        activeChatContainer.classList.add('hidden');
        noChatSelectedView.classList.remove('hidden');
      }
      chatDropdownMenu.classList.add('hidden');
    });
  }

  if (btnSearchMessages) {
    btnSearchMessages.addEventListener('click', () => {
      inChatSearchBar.classList.toggle('hidden');
      if (!inChatSearchBar.classList.contains('hidden')) chatSearchInput.focus();
    });
  }

  if (btnCloseChatSearch) {
    btnCloseChatSearch.addEventListener('click', () => {
      inChatSearchBar.classList.add('hidden');
      chatSearchInput.value = '';
      renderMessages();
    });
  }

  if (chatSearchInput) {
    chatSearchInput.addEventListener('input', (e) => renderMessages(e.target.value.toLowerCase()));
  }
}

function broadcastTypingSignal() {
  if (!activeContactId || !currentUser) return;
  const contact = contacts.find(c => c.id === activeContactId);
  if (!contact) return;

  syncChannel.postMessage({
    type: 'TYPING',
    payload: {
      senderPhone: currentUser.phone,
      senderName: currentUser.name,
      targetPhone: contact.phone
    }
  });
}

function sendTextMessage() {
  const text = messageInput.value.trim();
  if (!text || !activeContactId) return;

  const msgTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const newMsg = {
    id: 'msg_' + Date.now(),
    sender: currentUser.phone,
    type: 'text',
    text: text,
    time: msgTime,
    status: 'read'
  };

  pushAndBroadcastMessage(newMsg);
  messageInput.value = '';
  emojiPicker.classList.add('hidden');

  const activeContact = contacts.find(c => c.id === activeContactId);
  if (activeContact && activeContact.isBot) {
    generateAiResponse(text);
  }
}

function sendMediaMessage(type, mediaData, fileName = '') {
  if (!activeContactId) return;
  const msgTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const newMsg = {
    id: 'msg_' + Date.now(),
    sender: currentUser.phone,
    type: type,
    text: type === 'image' ? 'Photo' : fileName,
    mediaUrl: mediaData,
    fileName: fileName,
    time: msgTime,
    status: 'read'
  };

  pushAndBroadcastMessage(newMsg);
}

function pushAndBroadcastMessage(msg) {
  if (!messagesStore[activeContactId]) messagesStore[activeContactId] = [];
  messagesStore[activeContactId].push(msg);

  const contact = contacts.find(c => c.id === activeContactId);
  if (contact) {
    contact.lastMessage = msg.text || 'Media attachment';
    contact.lastTime = msg.time;
  }

  saveStateToLocalStorage();
  renderMessages();
  renderChatList();

  syncChannel.postMessage({
    type: 'NEW_MESSAGE',
    payload: {
      senderId: currentUser.phone,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      targetId: contact ? contact.phone : '',
      message: msg
    }
  });
}

function generateAiResponse(userQuery) {
  showTypingIndicator('WhatsApp AI Assistant');
  setTimeout(() => {
    const q = userQuery.toLowerCase();
    let reply = "I'm here to help you! You can ask me about features, real-time sync, or status updates.";

    if (q.includes('hello') || q.includes('hi') || q.includes('namaste')) {
      reply = `Hello ${currentUser.name}! How can I assist you today? 😊`;
    } else if (q.includes('feature') || q.includes('what can you do')) {
      reply = "This WhatsApp Web clone features real-time multi-tab messaging, status stories, voice notes, attachments, theme toggles, and audio/video call simulation!";
    } else if (q.includes('time') || q.includes('date')) {
      reply = `Current time is ${new Date().toLocaleTimeString()} on ${new Date().toLocaleDateString()}.`;
    } else if (q.includes('who created you') || q.includes('developer')) {
      reply = "I was built with modern HTML5, Vanilla JavaScript, and Tailwind CSS!";
    }

    const botMsg = {
      id: 'msg_' + Date.now(),
      sender: activeContactId,
      type: 'text',
      text: reply,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'read'
    };

    messagesStore[activeContactId].push(botMsg);
    const contact = contacts.find(c => c.id === activeContactId);
    if (contact) {
      contact.lastMessage = botMsg.text;
      contact.lastTime = botMsg.time;
    }
    saveStateToLocalStorage();
    renderMessages();
    renderChatList();
  }, 1200);
}

async function toggleVoiceRecorder() {
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        sendMediaMessage('audio', audioUrl, 'Voice Note');
      };

      mediaRecorder.start();
      isRecording = true;
      micIcon.className = 'fa-solid fa-stop text-red-500 animate-pulse';
      btnMicRecorder.title = 'Stop & Send Recording';
    } catch (err) {
      alert('Microphone access is required for recording voice notes.');
    }
  } else {
    if (mediaRecorder) {
      mediaRecorder.stop();
      isRecording = false;
      micIcon.className = 'fa-solid fa-microphone text-base';
      btnMicRecorder.title = 'Record Voice Note';
    }
  }
}

function switchSidebarView(viewName) {
  viewChats.classList.add('hidden');
  viewStatus.classList.add('hidden');
  viewSettings.classList.add('hidden');

  navTabChats.classList.remove('text-wa-teal');
  navTabStatus.classList.remove('text-wa-teal');
  btnSettingsToggle.classList.remove('text-wa-teal');

  if (viewName === 'chats') {
    viewChats.classList.remove('hidden');
    navTabChats.classList.add('text-wa-teal');
  } else if (viewName === 'status') {
    viewStatus.classList.remove('hidden');
    navTabStatus.classList.add('text-wa-teal');
  } else if (viewName === 'settings') {
    viewSettings.classList.remove('hidden');
    btnSettingsToggle.classList.add('text-wa-teal');
  }
}

function handleLogin() {
  const name = loginNameInput.value.trim();
  const phone = loginPhoneInput.value.trim();
  const about = loginAboutInput.value.trim() || 'Hey there! I am using WhatsApp.';

  if (!name) return alert('Please enter your name.');
  if (!phone) return alert('Please enter your phone number.');

  currentUser = {
    id: 'user_' + Date.now(),
    name: name,
    phone: phone,
    about: about,
    avatar: selectedLoginAvatar
  };

  localStorage.setItem('wa_clone_current_user', JSON.stringify(currentUser));
  loadAppForUser();
}

function handleLogout() {
  if (confirm('Are you sure you want to log out of WhatsApp?')) {
    localStorage.removeItem('wa_clone_current_user');
    currentUser = null;
    mainApp.classList.add('hidden');
    authScreen.classList.remove('hidden');
  }
}

function loadAppForUser() {
  if (!currentUser) return;

  userNameDisplay.textContent = currentUser.name;
  userStatusDisplay.textContent = currentUser.about || 'Online';
  userAvatarImg.src = currentUser.avatar;

  document.getElementById('settings-avatar-img').src = currentUser.avatar;
  document.getElementById('settings-name-input').value = currentUser.name;
  document.getElementById('settings-about-input').value = currentUser.about || '';
  document.getElementById('my-status-avatar').src = currentUser.avatar;

  loadContactsAndMessages();
  loadStatuses();

  authScreen.classList.add('hidden');
  mainApp.classList.remove('hidden');
}

function loadContactsAndMessages() {
  const userStorageKey = `wa_clone_contacts_${currentUser.phone}`;
  const storedContacts = localStorage.getItem(userStorageKey);

  if (storedContacts) {
    try {
      contacts = JSON.parse(storedContacts);
    } catch (e) {
      contacts = [...DEFAULT_CONTACTS];
    }
  } else {
    contacts = [...DEFAULT_CONTACTS];
  }

  const messagesKey = `wa_clone_messages_${currentUser.phone}`;
  const storedMessages = localStorage.getItem(messagesKey);
  if (storedMessages) {
    try {
      messagesStore = JSON.parse(storedMessages);
    } catch (e) {
      messagesStore = {};
    }
  }

  contacts.forEach(contact => {
    if (!messagesStore[contact.id]) {
      messagesStore[contact.id] = [
        {
          id: 'msg_init_1',
          sender: contact.id,
          text: `Hey ${currentUser.name}! ${contact.lastMessage}`,
          time: '10:00 AM',
          status: 'read'
        }
      ];
    }
  });

  saveStateToLocalStorage();
  renderChatList();
}

function saveStateToLocalStorage() {
  if (!currentUser) return;
  localStorage.setItem(`wa_clone_contacts_${currentUser.phone}`, JSON.stringify(contacts));
  localStorage.setItem(`wa_clone_messages_${currentUser.phone}`, JSON.stringify(messagesStore));
}

function handleAddContact() {
  const name = newContactName.value.trim();
  const phone = newContactPhone.value.trim();

  if (!name || !phone) return alert('Please provide both name and phone number.');

  const existing = contacts.find(c => c.phone === phone);
  if (existing) {
    alert('Contact with this phone number already exists!');
    selectChat(existing.id);
    modalAddContact.classList.add('hidden');
    return;
  }

  const newContact = {
    id: 'contact_' + Date.now(),
    name: name,
    phone: phone,
    avatar: PRESET_AVATARS[Math.floor(Math.random() * PRESET_AVATARS.length)],
    about: 'Hey there! I am using WhatsApp.',
    isBot: false,
    pinned: false,
    unreadCount: 0,
    lastMessage: 'Chat created',
    lastTime: 'Just now'
  };

  contacts.unshift(newContact);
  messagesStore[newContact.id] = [
    {
      id: 'msg_' + Date.now(),
      sender: 'system',
      text: '🔒 Messages and calls are end-to-end encrypted.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'read'
    }
  ];

  saveStateToLocalStorage();
  renderChatList();
  selectChat(newContact.id);

  newContactName.value = '';
  newContactPhone.value = '';
  modalAddContact.classList.add('hidden');
}

function renderChatList(query = '') {
  chatListContainer.innerHTML = '';

  let filtered = contacts.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(query) || c.phone.includes(query);
    if (currentFilter === 'unread') return matchesSearch && c.unreadCount > 0;
    if (currentFilter === 'favourites') return matchesSearch && c.pinned;
    return matchesSearch;
  });

  filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  if (filtered.length === 0) {
    chatListContainer.innerHTML = `<div class="p-6 text-center text-slate-400 text-sm">No chats found</div>`;
    return;
  }

  filtered.forEach(contact => {
    const chatItem = document.createElement('div');
    chatItem.className = `px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-wa-darkHover transition relative ${
      activeContactId === contact.id ? 'bg-slate-200/70 dark:bg-wa-darkHover' : ''
    }`;

    chatItem.innerHTML = `
      <div class="relative flex-shrink-0">
        <img src="${contact.avatar}" class="w-12 h-12 rounded-full object-cover">
        <span class="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-wa-darkSidebar"></span>
      </div>
      <div class="flex-1 min-w-0 border-b border-slate-100 dark:border-slate-800/60 pb-1">
        <div class="flex justify-between items-baseline mb-0.5">
          <h4 class="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">${contact.name}</h4>
          <span class="text-xs text-slate-400">${contact.lastTime || ''}</span>
        </div>
        <div class="flex justify-between items-center text-xs">
          <p class="text-slate-500 dark:text-slate-400 truncate max-w-[200px]">${contact.lastMessage || ''}</p>
          <div class="flex items-center gap-1.5">
            ${contact.pinned ? '<i class="fa-solid fa-thumbtack text-slate-400 text-xs"></i>' : ''}
            ${contact.unreadCount > 0 ? `<span class="bg-wa-teal text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">${contact.unreadCount}</span>` : ''}
          </div>
        </div>
      </div>
    `;

    chatItem.addEventListener('click', () => selectChat(contact.id));
    chatListContainer.appendChild(chatItem);
  });
}

function selectChat(contactId) {
  activeContactId = contactId;
  const contact = contacts.find(c => c.id === contactId);
  if (!contact) return;

  contact.unreadCount = 0;
  saveStateToLocalStorage();
  renderChatList();

  noChatSelectedView.classList.add('hidden');
  activeChatContainer.classList.remove('hidden');

  chatHeaderAvatar.src = contact.avatar;
  chatHeaderName.textContent = contact.name;
  chatHeaderStatus.textContent = contact.isBot ? 'AI Assistant (Online)' : (contact.about || 'online');

  renderMessages();
}

function renderMessages(searchQuery = '') {
  if (!activeContactId) return;
  let msgs = messagesStore[activeContactId] || [];

  if (searchQuery) {
    msgs = msgs.filter(m => m.text && m.text.toLowerCase().includes(searchQuery));
  }

  messagesContainer.innerHTML = '';

  msgs.forEach(m => {
    const isMe = m.sender === currentUser.phone || m.sender === 'me';
    const isSystem = m.sender === 'system';

    const msgDiv = document.createElement('div');
    if (isSystem) {
      msgDiv.className = 'flex justify-center my-2';
      msgDiv.innerHTML = `<span class="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 text-xs px-3 py-1 rounded-lg shadow-xs">${m.text}</span>`;
    } else {
      msgDiv.className = `flex ${isMe ? 'justify-end' : 'justify-start'} my-1 group`;

      let contentHtml = `<p>${m.text}</p>`;
      if (m.type === 'image' && m.mediaUrl) {
        contentHtml = `<img src="${m.mediaUrl}" class="rounded-lg max-h-60 object-cover mb-1 border border-black/10"><p class="text-xs">${m.text || ''}</p>`;
      } else if (m.type === 'document') {
        contentHtml = `<div class="flex items-center gap-3 p-2 bg-black/5 dark:bg-white/5 rounded-lg border border-black/10 mb-1"><i class="fa-solid fa-file-pdf text-red-500 text-2xl"></i><div><p class="font-medium text-xs truncate max-w-[180px]">${m.fileName || 'Document'}</p><span class="text-[10px] text-slate-400">PDF Document</span></div></div>`;
      } else if (m.type === 'audio') {
        contentHtml = `<div class="flex items-center gap-2 py-1"><audio controls src="${m.mediaUrl}" class="h-8 max-w-[200px]"></audio></div>`;
      }

      msgDiv.innerHTML = `
        <div class="max-w-[80%] md:max-w-[65%] rounded-xl px-3 py-2 text-sm shadow-sm relative ${
          isMe ? 'bg-wa-lightBubbleOut dark:bg-wa-darkBubbleOut text-slate-900 dark:text-slate-100' : 'bg-white dark:bg-wa-darkBubbleIn text-slate-900 dark:text-slate-100'
        }">
          ${contentHtml}
          <div class="flex items-center justify-end gap-1 text-[10px] text-slate-400 mt-1">
            <span>${m.time}</span>
            ${isMe ? '<i class="fa-solid fa-check-double text-blue-500"></i>' : ''}
          </div>
        </div>
      `;
    }
    messagesContainer.appendChild(msgDiv);
  });

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator(username) {
  const typingIndicator = document.getElementById('typing-indicator');
  const typingUsername = document.getElementById('typing-username');
  if (typingIndicator && typingUsername) {
    typingUsername.textContent = username;
    typingIndicator.classList.remove('hidden');
    setTimeout(() => {
      typingIndicator.classList.add('hidden');
    }, 2500);
  }
}
