// src/app/chat/page.tsx
import ChatInterface from "@/components/chat/ChatInterface";

export default function ChatPage() {
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <ChatInterface />
    </div>
  );
}
