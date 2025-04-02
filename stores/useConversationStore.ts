import { create } from 'zustand';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConversationState {
  messages: Message[];
  addMessage: (message: Message) => void;
  clearMessages: () => void;
}

const useConversationStore = create<ConversationState>((set) => ({
  messages: [],
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  clearMessages: () => set({ messages: [] }),
}));

export default useConversationStore;
