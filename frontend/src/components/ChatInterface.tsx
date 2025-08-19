import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, Bot, User, Trash2 } from "lucide-react";
import { useConfig } from "./app/ConfigContext";
import { askQuestion } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  collectionId: string;
  llmProvider?: string;
}

const ChatInterface = ({ collectionId, llmProvider }: ChatInterfaceProps) => {
  const { apiBaseUrl } = useConfig();
  
  // Load messages from localStorage on component mount
  const loadChatHistory = (): ChatMessage[] => {
    try {
      const saved = localStorage.getItem(`chat-${collectionId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
    
    // Default welcome message
    return [
      {
        id: '1',
        type: 'assistant',
        content: "Hi! I can help you explore your documents. Ask me questions about the content, key insights, or anything specific you'd like to know.",
        timestamp: new Date()
      }
    ];
  };

  const [messages, setMessages] = useState<ChatMessage[]>(loadChatHistory);
  const [inputValue, setInputValue] = useState('');

  // Save messages to localStorage whenever messages change
  const saveChatHistory = (msgs: ChatMessage[]) => {
    try {
      localStorage.setItem(`chat-${collectionId}`, JSON.stringify(msgs));
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  };

  const chatMutation = useMutation({
    mutationFn: (question: string) => askQuestion(apiBaseUrl, collectionId, question, llmProvider),
    onSuccess: (response) => {
      const newMessages = [
        ...messages,
        {
          id: Date.now().toString(),
          type: 'assistant' as const,
          content: response.answer,
          timestamp: new Date()
        }
      ];
      setMessages(newMessages);
      saveChatHistory(newMessages);
    },
    onError: () => {
      const errorMessage = {
        id: Date.now().toString(),
        type: 'assistant' as const,
        content: "I apologize, but I encountered an error processing your question. Please try again.",
        timestamp: new Date()
      };
      const newMessages = [...messages, errorMessage];
      setMessages(newMessages);
      saveChatHistory(newMessages);
    }
  });

  const handleSendMessage = () => {
    if (!inputValue.trim() || chatMutation.isPending) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    saveChatHistory(newMessages);
    chatMutation.mutate(inputValue.trim());
    setInputValue('');
  };

  const clearChat = () => {
    const defaultMessages = [
      {
        id: '1',
        type: 'assistant' as const,
        content: "Hi! I can help you explore your documents. Ask me questions about the content, key insights, or anything specific you'd like to know.",
        timestamp: new Date()
      }
    ];
    setMessages(defaultMessages);
    saveChatHistory(defaultMessages);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Document Chat
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearChat}
            className="h-6 w-6 p-0"
            title="Clear chat history"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-3 pt-0">
        <ScrollArea className="flex-1 pr-3">
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-2 max-w-[85%] ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.type === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    {message.type === 'user' ? (
                      <User className="h-3 w-3" />
                    ) : (
                      <Bot className="h-3 w-3" />
                    )}
                  </div>
                  <div className={`rounded-lg p-3 ${
                    message.type === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </div>
                    <div className={`text-xs mt-1 opacity-70`}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Loading indicator */}
            {chatMutation.isPending && (
              <div className="flex gap-2 justify-start">
                <div className="flex gap-2 max-w-[85%]">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-muted">
                    <Bot className="h-3 w-3" />
                  </div>
                  <div className="rounded-lg p-3 bg-muted">
                    <div className="flex space-x-1">
                      <Skeleton className="h-2 w-2 rounded-full" />
                      <Skeleton className="h-2 w-2 rounded-full" />
                      <Skeleton className="h-2 w-2 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2 mt-3 pt-3 border-t">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your documents..."
            disabled={chatMutation.isPending}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || chatMutation.isPending}
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChatInterface;
