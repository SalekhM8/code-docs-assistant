import { ChatView } from "@/components/chat/chat-view";

export default async function ConversationPage({ params }: { params: Promise<{ repoId: string; conversationId: string }> }) {
  const { repoId, conversationId } = await params;
  return <ChatView key={conversationId} repoId={repoId} conversationId={conversationId} />;
}
