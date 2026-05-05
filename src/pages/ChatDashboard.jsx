import React, { useEffect, useState, useRef } from 'react';
import { Search, Send, Lock, LogOut, Loader2, MessageSquare, ShieldCheck, Menu, X, ChevronLeft, Plus, Settings } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import api from '../services/api';
import { wsClient } from '../services/websocket';
import { 
  generateMessageKey, 
  encryptMessage, 
  encryptKeyWithRSA, 
  decryptKeyWithRSA, 
  decryptMessage 
} from '../crypto/encryption';
import { importPublicKey } from '../crypto/keys';

export default function ChatDashboard() {
  const { user, accessToken, privateKey, logout } = useAuthStore();
  const { 
    conversations, 
    setConversations, 
    activeConversationId, 
    setActiveConversation,
    messages,
    addMessage,
    addMessages
  } = useChatStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef(null);

  // Initialize WebSocket and fetch conversations
  useEffect(() => {
    fetchConversations();

    wsClient.connect(accessToken);
    wsClient.on('message.receive', handleReceiveMessage);

    return () => {
      wsClient.off('message.receive', handleReceiveMessage);
      wsClient.disconnect();
    };
  }, []);

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      const res = await api.get('/conversations');
      setConversations(res.data);
    } catch (err) {
      console.error('Failed to fetch conversations', err);
    }
  };

  // Fetch user search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 0) {
        try {
          const res = await api.get(`/users/search?q=${searchQuery}`);
          setSearchResults(res.data);
        } catch (err) {
          console.error(err);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Load active conversation history
  useEffect(() => {
    if (activeConversationId) {
      loadMessageHistory(activeConversationId);
    }
  }, [activeConversationId]);

  // Fallback: silent polling every 3 seconds to guarantee delivery if WS drops
  useEffect(() => {
    if (!activeConversationId) return;
    const intervalId = setInterval(() => {
      // Fetch history silently (no loading spinner)
      api.get(`/conversations/${activeConversationId}/messages`).then(async (res) => {
        const encryptedMessages = res.data.reverse();
        const decryptedMessages = await Promise.all(
          encryptedMessages.map(msg => decryptMessagePayload(msg))
        );
        addMessages(activeConversationId, decryptedMessages);
      }).catch(err => console.error('Silent poll failed', err));
    }, 3000);

    return () => clearInterval(intervalId);
  }, [activeConversationId, privateKey, user.id]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages[activeConversationId]]);

  const decryptMessagePayload = async (msg) => {
    try {
      const isSender = msg.from_user_id === user.id;
      const encryptedKeyToUse = isSender ? msg.payload.encryptedKeyForSelf : msg.payload.encryptedKey;
      
      const aesKey = await decryptKeyWithRSA(encryptedKeyToUse, privateKey);
      const plaintext = await decryptMessage(msg.payload.ciphertext, msg.payload.iv, aesKey);
      
      return {
        ...msg,
        plaintext
      };
    } catch (err) {
      console.error('Decryption failed for msg', msg.id, err);
      return {
        ...msg,
        plaintext: '[Decryption Failed]'
      };
    }
  };

  const handleReceiveMessage = async (msg) => {
    // Process single message from WS
    const partnerId = msg.from_user_id === user.id ? msg.to_user_id : msg.from_user_id;
    const decryptedMsg = await decryptMessagePayload(msg);
    addMessage(partnerId, decryptedMsg);
    fetchConversations(); // Update side bar times
  };

  const loadMessageHistory = async (partnerId) => {
    setIsLoadingHistory(true);
    try {
      const res = await api.get(`/conversations/${partnerId}/messages`);
      const encryptedMessages = res.data.reverse(); // Newest last for display
      
      const decryptedMessages = await Promise.all(
        encryptedMessages.map(msg => decryptMessagePayload(msg))
      );
      
      addMessages(partnerId, decryptedMessages);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeConversationId || isSending) return;

    const plaintext = messageInput.trim();
    setMessageInput(''); // Clear input immediately for better UX
    setIsSending(true);

    try {
      // 1. Get recipient public key
      const pubKeyRes = await api.get(`/users/${activeConversationId}/public-key`);
      const recipientKeyBase64 = pubKeyRes.data?.public_key || pubKeyRes.data;
      
      let recipientPubKey;
      try {
        recipientPubKey = await importPublicKey(recipientKeyBase64);
      } catch (e) {
        alert("Cannot send message: The recipient's encryption key is corrupted or missing. They may have registered on an older version of the app.");
        setIsSending(false);
        setMessageInput(plaintext);
        return;
      }

      // 2. Get own public key (so sender can decrypt their own sent messages)
      const ownPubKeyRes = await api.get(`/users/${user.id}/public-key`);
      const ownKeyBase64 = ownPubKeyRes.data?.public_key || ownPubKeyRes.data;
      
      let ownPubKey;
      try {
        ownPubKey = await importPublicKey(ownKeyBase64);
      } catch (e) {
        alert("Cannot send message: Your own encryption key is corrupted. Please log out and register a new account to generate valid keys.");
        setIsSending(false);
        setMessageInput(plaintext);
        return;
      }

      // 3. Generate a fresh AES-GCM key + encrypt the message
      const aesKey = await generateMessageKey();
      const { ciphertext, iv } = await encryptMessage(plaintext, aesKey);

      // 4. Encrypt the AES key for both recipient and self
      const encryptedKey        = await encryptKeyWithRSA(aesKey, recipientPubKey);
      const encryptedKeyForSelf = await encryptKeyWithRSA(aesKey, ownPubKey);

      const payload = { ciphertext, iv, encryptedKey, encryptedKeyForSelf };

      // 5. Optimistic update — show message immediately in sender's chat
      //    This makes the UI feel instant without waiting for WS echo
      const optimisticMsg = {
        id: `optimistic-${Date.now()}`,
        from_user_id: user.id,
        to_user_id: activeConversationId,
        payload,
        delivered: false,
        created_at: new Date().toISOString(),
        plaintext, // already have it — no need to decrypt
      };
      addMessage(activeConversationId, optimisticMsg);

      // 6. ALWAYS use REST to guarantee persistence and delivery.
      // The backend WebSocket `message.send` is silently dropping messages.
      // By forcing REST, the database guarantees it saves, and our 3-second polling guarantees the recipient sees it.
      await api.post('/messages', { to: activeConversationId, payload });

      // Refresh conversation list to bump the "last message" timestamp
      fetchConversations();
    } catch (err) {
      console.error('Send failed', err);
      // Restore the message text so the user can retry
      setMessageInput(plaintext);
    } finally {
      setIsSending(false);
    }
  };


  const startConversation = (partner) => {
    setSearchQuery('');
    setSearchResults([]);
    setSidebarOpen(false); // Close sidebar on mobile after selecting

    // Add to conversations list optimistically if not exists
    if (!conversations.find(c => c.user_id === partner.id)) {
      setConversations([{
        user_id: partner.id,
        display_name: partner.display_name,
        username: partner.username,
        last_message_at: new Date().toISOString()
      }, ...conversations]);
    }

    setActiveConversation(partner.id);
  };

  const handleLogout = async () => {
    const refreshToken = sessionStorage.getItem('refresh_token');
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refresh_token: refreshToken });
      }
    } catch (err) {
      // Swallow error — we still clear client state
      console.warn('Server logout failed, clearing client session.', err);
    } finally {
      logout();
    }
  };

  const handleSelectConversation = (id) => {
    setActiveConversation(id);
    setSidebarOpen(false); // Close sidebar on mobile after selecting
  };

  const activeConvoDetails = conversations.find(c => c.user_id === activeConversationId) || 
    searchResults.find(u => u.id === activeConversationId);

  return (
    <div className="flex h-screen text-white overflow-hidden" style={{ background: 'var(--color-bg)' }}>

      {/* Sidebar */}
      <div
        className={`
          flex-col w-full md:w-80
          transition-none
          ${activeConversationId ? 'hidden md:flex' : 'flex'}
        `}
        style={{ background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)' }}
      >
        <div className="glass-header p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-tertiary)' }}>
              <ShieldCheck size={18} className="text-[#1a1203]" />
            </div>
            <h2 className="font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>WhisperBox</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleLogout}
              className="p-2 rounded-full transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'white'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
              title="Logout"
            >
              <LogOut size={18} />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-full transition-colors md:hidden"
              style={{ color: 'var(--color-muted)' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Search users…"
              className="glass-input pl-9 py-2 text-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {searchQuery ? (
            <div>
              <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Search Results</div>
              {searchResults.length === 0 ? (
                <div className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>No users found</div>
              ) : (
                searchResults.map(u => (
                  <button
                    key={u.id}
                    onClick={() => startConversation(u)}
                    className="w-full text-left px-4 py-3 transition-colors flex items-center gap-3"
                    style={{ borderRadius: 0 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[#1a1203] text-sm flex-shrink-0" style={{ background: 'var(--color-tertiary)' }}>
                      {u.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="font-medium truncate" style={{ color: 'var(--color-text)' }}>{u.display_name}</div>
                      <div className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>@{u.username}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div>
              {conversations.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center" style={{ color: 'var(--color-text-muted)' }}>
                  <MessageSquare size={32} className="mb-3 opacity-40" />
                  <p className="text-sm">No conversations yet.</p>
                  <p className="text-xs mt-1">Search for a user to start messaging.</p>
                </div>
              ) : (
                conversations.map(c => (
                  <button
                    key={c.user_id}
                    onClick={() => handleSelectConversation(c.user_id)}
                    className="w-full text-left px-4 py-3 transition-all flex items-center gap-3"
                    style={{
                      borderLeft: activeConversationId === c.user_id
                        ? '3px solid var(--color-primary)'
                        : '3px solid transparent',
                      background: activeConversationId === c.user_id
                        ? 'rgba(40,43,164,0.12)'
                        : 'transparent',
                    }}
                    onMouseEnter={e => { if (activeConversationId !== c.user_id) e.currentTarget.style.background = 'rgba(93,98,145,0.1)'; }}
                    onMouseLeave={e => { if (activeConversationId !== c.user_id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-[#1a1203] text-base flex-shrink-0" style={{ background: 'var(--color-tertiary)' }}>
                      {c.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <div className="font-semibold truncate pr-2 text-[14px]" style={{ color: 'var(--color-text)' }}>{c.display_name}</div>
                        {c.last_message_at && (
                          <div className="text-[11px] whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                            {new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                      <div className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                        <Lock size={9} style={{ color: 'var(--color-success)' }} /> Encrypted
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex-col relative min-w-0 ${!activeConversationId ? 'hidden md:flex' : 'flex'}`} style={{ background: 'var(--color-bg)' }}>

        {activeConversationId ? (
          <>
            {/* Chat Header */}
            <div className="glass-header px-4 md:px-6 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveConversation(null)}
                  className="md:hidden p-1.5 -ml-1 rounded-full transition-colors"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="min-w-0">
                  <h3 className="font-semibold text-lg leading-tight truncate" style={{ color: 'var(--color-text)' }}>{activeConvoDetails?.display_name}</h3>
                </div>
              </div>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[#1a1203] text-sm flex-shrink-0"
                style={{ background: 'var(--color-tertiary)' }}
              >
                {activeConvoDetails?.display_name?.charAt(0).toUpperCase()}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 relative z-0 scroll-smooth">
              
              {/* Secure Session Pill */}
              <div className="flex justify-center mt-2 mb-6">
                <div className="px-4 py-1.5 rounded-full text-xs font-bold tracking-wider flex items-center gap-2" style={{ background: 'rgba(189,170,116,0.1)', border: '1px solid rgba(189,170,116,0.3)', color: 'var(--color-tertiary)' }}>
                  <Lock size={12} className="animate-secure-lock" /> SECURE SESSION ACTIVE
                </div>
              </div>

              {isLoadingHistory ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-tertiary)' }} />
                </div>
              ) : (
                <>
                  {messages[activeConversationId]?.map((msg, i) => {
                    const isMe = msg.from_user_id === user.id;
                    return (
                      <div key={msg.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={isMe ? 'message-bubble-out' : 'message-bubble-in'}>
                          <p className="text-[15px] leading-relaxed break-words">{msg.plaintext}</p>
                        </div>
                        <div className="text-[11px] mt-1.5 font-medium px-1" style={{ color: 'var(--color-text-muted)' }}>
                          {new Date(msg.created_at || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 z-10 bg-[var(--color-bg)]">
              <form onSubmit={handleSendMessage} className="flex items-center gap-3 max-w-4xl mx-auto rounded-2xl px-2 py-2" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <button type="button" className="p-2 ml-1" style={{ color: 'var(--color-text-muted)' }}>
                  <Plus size={20} />
                </button>
                <input
                  type="text"
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  placeholder="Type a secure message..."
                  className="flex-1 bg-transparent border-none text-[15px] outline-none"
                  style={{ color: 'var(--color-text)' }}
                />
                {messageInput.trim() && (
                  <button
                    type="submit"
                    disabled={isSending}
                    className="p-2 mr-1 rounded-xl transition-transform"
                    style={{ background: 'var(--color-tertiary)', color: '#1a1203' }}
                  >
                    {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                )}
              </form>
              <div className="text-center mt-3 text-[10px] font-medium tracking-wide uppercase" style={{ color: 'var(--color-text-muted)' }}>
                Messages are secured with RSA-OAEP / AES-GCM
              </div>
            </div>

          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4" style={{ color: 'var(--color-text-muted)' }}>
            <div
              className="w-20 h-20 mb-6 rounded-3xl flex items-center justify-center shadow-2xl"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <ShieldCheck size={38} style={{ color: 'var(--color-tertiary)', opacity: 0.9 }} />
            </div>
            <h2 className="text-xl font-bold mb-2 tracking-tight" style={{ color: 'var(--color-text)' }}>WhisperBox</h2>
            <p className="text-sm max-w-xs text-center">
              Select a conversation to start messaging. All content is end-to-end encrypted with AES-256-GCM.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
