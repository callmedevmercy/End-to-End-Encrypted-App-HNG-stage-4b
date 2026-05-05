import React, { useEffect, useState, useRef } from 'react';
import { Search, Send, Lock, LogOut, Loader2, MessageSquare, ShieldCheck, Menu, X, ChevronLeft } from 'lucide-react';
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

    setIsSending(true);
    try {
      // 1. Get recipient public key
      const pubKeyRes = await api.get(`/users/${activeConversationId}/public-key`);
      const recipientPubKey = await importPublicKey(pubKeyRes.data.public_key);
      
      // 2. Get own public key (for encryptedKeyForSelf)
      const ownPubKeyRes = await api.get(`/users/${user.id}/public-key`);
      const ownPubKey = await importPublicKey(ownPubKeyRes.data.public_key);

      // 3. Generate AES-GCM message key
      const aesKey = await generateMessageKey();

      // 4. Encrypt message
      const plaintext = messageInput.trim();
      const { ciphertext, iv } = await encryptMessage(plaintext, aesKey);

      // 5. Encrypt AES key for recipient and self
      const encryptedKey = await encryptKeyWithRSA(aesKey, recipientPubKey);
      const encryptedKeyForSelf = await encryptKeyWithRSA(aesKey, ownPubKey);

      const payload = {
        ciphertext,
        iv,
        encryptedKey,
        encryptedKeyForSelf
      };

      // 6. Send via WS (or REST fallback)
      wsClient.send('message.send', {
        to: activeConversationId,
        payload
      });

      setMessageInput('');
    } catch (err) {
      console.error('Send failed', err);
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
    <div className="flex h-screen bg-[var(--color-dark-bg)] text-white overflow-hidden">

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-30 md:z-10
        w-80 flex flex-col
        border-r border-[var(--color-dark-border)]
        bg-[var(--color-dark-panel)]
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 glass-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={24} className="text-primary" />
            <h2 className="font-bold tracking-tight">WhisperBox</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleLogout}
              className="p-2 rounded-full hover:bg-white/10 text-[var(--color-dark-muted)] hover:text-white transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-full hover:bg-white/10 text-[var(--color-dark-muted)] hover:text-white transition-colors md:hidden"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-[var(--color-dark-border)]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input 
              type="text" 
              placeholder="Search users..." 
              className="glass-input w-full pl-9 py-2 text-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {searchQuery ? (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-[var(--color-dark-muted)] uppercase tracking-wider">Search Results</div>
              {searchResults.length === 0 ? (
                <div className="px-4 py-3 text-sm text-[var(--color-dark-muted)]">No users found</div>
              ) : (
                searchResults.map(u => (
                  <button 
                    key={u.id}
                    onClick={() => startConversation(u)}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      {u.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="font-medium truncate">{u.display_name}</div>
                      <div className="text-xs text-[var(--color-dark-muted)] truncate">@{u.username}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div>
              {conversations.length === 0 ? (
                <div className="p-8 text-center text-[var(--color-dark-muted)] flex flex-col items-center">
                  <MessageSquare size={32} className="mb-3 opacity-50" />
                  <p className="text-sm">No conversations yet.</p>
                  <p className="text-xs mt-1">Search for a user to start messaging.</p>
                </div>
              ) : (
                conversations.map(c => (
                  <button
                    key={c.user_id}
                    onClick={() => handleSelectConversation(c.user_id)}
                    className={`w-full text-left px-4 py-3 transition-colors flex items-center gap-3 border-l-2 ${activeConversationId === c.user_id ? 'bg-white/10 border-primary' : 'hover:bg-white/5 border-transparent'}`}
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/80 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                      {c.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <div className="font-medium truncate pr-2 text-[15px]">{c.display_name}</div>
                        {c.last_message_at && (
                          <div className="text-[11px] text-[var(--color-dark-muted)] whitespace-nowrap">
                            {new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-[var(--color-dark-muted)] flex items-center gap-1">
                        <Lock size={10} className="text-success inline" /> Encrypted
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
      <div className="flex-1 flex flex-col bg-[var(--color-dark-bg)] relative min-w-0">
        {/* Background glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>

        {activeConversationId ? (
          <>
            {/* Chat Header */}
            <div className="glass-header px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Mobile back button */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-2 -ml-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/80 to-purple-600 flex items-center justify-center text-white font-bold shadow-sm flex-shrink-0">
                  {activeConvoDetails?.display_name?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-[15px] leading-tight truncate">{activeConvoDetails?.display_name}</h3>
                  <p className="text-xs text-[var(--color-dark-muted)] truncate">@{activeConvoDetails?.username}</p>
                </div>
              </div>
              <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                <Lock size={12} className="animate-secure-lock" />
                <span className="hidden sm:inline">End-to-End Encrypted</span>
                <span className="sm:hidden">E2EE</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 relative z-0 scroll-smooth">
              {isLoadingHistory ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 size={24} className="animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {messages[activeConversationId]?.length === 0 && (
                    <div className="text-center text-[var(--color-dark-muted)] mt-10 text-sm bg-white/5 mx-auto max-w-sm p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
                      <Lock size={24} className="mx-auto mb-2 text-primary/70" />
                      Messages are end-to-end encrypted.<br/>No one outside of this chat, not even WhisperBox, can read or listen to them.
                    </div>
                  )}
                  {messages[activeConversationId]?.map((msg, i) => {
                    const isMe = msg.from_user_id === user.id;
                    return (
                      <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={isMe ? 'message-bubble-out' : 'message-bubble-in'}>
                          <p className="text-[15px] leading-relaxed break-words">{msg.plaintext}</p>
                          <div className={`text-[10px] mt-1 text-right flex items-center justify-end gap-1 ${isMe ? 'text-white/70' : 'text-white/40'}`}>
                             {new Date(msg.created_at || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-[var(--color-dark-panel)]/80 backdrop-blur-md border-t border-[var(--color-dark-border)] z-10">
              <form onSubmit={handleSendMessage} className="flex gap-2 max-w-4xl mx-auto">
                <input
                  type="text"
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  placeholder="Type an encrypted message..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder-white/30 text-white shadow-inner"
                />
                <button 
                  type="submit" 
                  disabled={!messageInput.trim() || isSending}
                  className="btn-primary rounded-2xl w-14 flex items-center justify-center disabled:opacity-50"
                >
                  {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="ml-1" />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-dark-muted)] relative z-10 px-4">
            {/* Mobile open sidebar button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden mb-6 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm"
            >
              <Menu size={18} /> Open Conversations
            </button>
            <div className="w-20 h-20 mb-6 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl backdrop-blur-xl">
              <ShieldCheck size={40} className="text-primary opacity-80" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2 tracking-tight">WhisperBox</h2>
            <p className="text-sm max-w-xs text-center">
              Select a conversation to start messaging securely. All messages are end-to-end encrypted with AES-256-GCM.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
