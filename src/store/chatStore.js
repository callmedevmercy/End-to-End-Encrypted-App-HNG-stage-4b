import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversationId: null, // The partner's user_id
  messages: {}, // Record<partner_user_id, Message[]>
  
  setConversations: (convos) => set({ conversations: convos }),
  
  setActiveConversation: (id) => set({ activeConversationId: id }),
  
  addMessages: (partnerId, newMessages) => set((state) => {
    const existing = state.messages[partnerId] || [];
    // prevent duplicates by ID and sort by time
    const merged = [...existing, ...newMessages];
    const unique = merged.filter((msg, index, self) => 
      index === self.findIndex((t) => (
        t.id === msg.id
      ))
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
    
    return {
      messages: {
        ...state.messages,
        [partnerId]: [...existing, message]
      }
    };
  }),
}));
