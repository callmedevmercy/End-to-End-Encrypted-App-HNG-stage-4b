import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversationId: null, // The partner's user_id
  messages: {}, // Record<partner_user_id, Message[]>
  
  setConversations: (convos) => set({ conversations: convos }),
  
  setActiveConversation: (id) => set({ activeConversationId: id }),
  
  addMessages: (partnerId, newMessages) => set((state) => {
    const existing = state.messages[partnerId] || [];
    
    // Get all optimistic messages from existing
    const optimisticMessages = existing.filter(m => m.id && m.id.toString().startsWith('optimistic-'));
    
    // Filter out optimistic messages that have a matching real message in newMessages
    // Using plaintext is foolproof for optimistic deduplication.
    const pendingOptimistic = optimisticMessages.filter(opt => 
       !newMessages.some(real => real.plaintext === opt.plaintext)
    );
    
    // The final list is all newly fetched real messages + any still-pending optimistic messages
    const finalMessages = [...newMessages, ...pendingOptimistic];
    
    // Ensure no duplicates by ID just in case
    const unique = finalMessages.filter((msg, index, self) => 
      index === self.findIndex((t) => t.id === msg.id)
    );
    
    unique.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    return {
      messages: {
        ...state.messages,
        [partnerId]: unique
      }
    };
  }),
  
  addMessage: (partnerId, message) => set((state) => {
    const existing = state.messages[partnerId] || [];
    if (existing.some(m => m.id === message.id)) return state;
    
    // If adding a real message, remove any optimistic message with the same ciphertext
    let newMessagesList = existing;
    if (message.id && !message.id.toString().startsWith('optimistic-')) {
      newMessagesList = existing.filter(m => m.payload?.ciphertext !== message.payload?.ciphertext);
    }
    
    return {
      messages: {
        ...state.messages,
        [partnerId]: [...newMessagesList, message]
      }
    };
  }),
}));
