"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, X, Send, User as UserIcon, CheckCircle2, MoreHorizontal, Pencil, Trash } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { chatApi, TeamMessage } from "@/lib/api/chat.api";
import { useSocket } from "@/lib/hooks/useSocket";
import { axiosClient } from "@/lib/axios";
import { useSnackbar } from "notistack";

interface FloatingTeamChatProps {
  teamId: number;
  inline?: boolean;
  defaultOpen?: boolean;
  teamName?: string;
  readOnly?: boolean;
}

export function FloatingTeamChat({ teamId, inline = false, defaultOpen = false, teamName, readOnly = false }: FloatingTeamChatProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [message, setMessage] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showTooltip, setShowTooltip] = useState(true);
  const isOpenRef = useRef(isOpen);
  const queryClient = useQueryClient();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);
  
  const { data: user } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const res = await axiosClient.get('/users/profile');
      return res.data.data;
    },
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  const { socket, isConnected } = useSocket("/chat");

  const { 
    data: messagesPages, 
    isLoading, 
    fetchNextPage, 
    hasNextPage,
    isFetchingNextPage 
  } = useInfiniteQuery({
    queryKey: ["team-messages", teamId],
    queryFn: ({ pageParam }) => chatApi.getTeamMessages(teamId, pageParam as number | undefined),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.length === 20 ? lastPage[0].id : undefined,
    enabled: !!teamId,
  });

  const messages = messagesPages ? messagesPages.pages.flat().sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) : [];

  const unreadCount = messages.filter((m) => m.senderId !== user?.id && !m.reads?.some((r) => r.userId === user?.id)).length;

  // Mark as read when opened or new message arrives while open
  useEffect(() => {
    if (!readOnly && isOpen && unreadCount > 0 && socket && isConnected && user?.id) {
      socket.emit("mark_as_read", teamId);
      // Optimistically update cache to mark as read
      queryClient.setQueryData(["team-messages", teamId], (oldData: any) => {
        if (!oldData) return oldData;
        const newPages = oldData.pages.map((page: TeamMessage[]) => 
          page.map(msg => {
            if (msg.senderId !== user.id && !msg.reads?.some(r => r.userId === user.id)) {
              return {
                ...msg,
                reads: [...(msg.reads || []), { userId: user.id, readAt: new Date().toISOString(), user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl || "" } }]
              };
            }
            return msg;
          })
        );
        return { ...oldData, pages: newPages };
      });
    }
  }, [isOpen, unreadCount, socket, isConnected, teamId, user, queryClient, readOnly]);

  useEffect(() => {
    if (!socket || !teamId) return;

    // Join room immediately on mount so we can receive background messages
    socket.emit("join_team_room", teamId);

    const handleReceiveMessage = (newMessage: TeamMessage) => {
      if (!isOpenRef.current && newMessage.senderId !== user?.id) {
        const messageText = newMessage.content.length > 40 ? newMessage.content.substring(0, 40) + "..." : newMessage.content;
        enqueueSnackbar(
          <div 
            onClick={() => {
              setIsOpen(true);
              setShowTooltip(false);
              // Close all snackbars if clicked (or use a ref to track this one)
              closeSnackbar();
            }}
            className="flex-1 cursor-pointer select-none"
          >
            <span className="font-semibold">New message from {newMessage.sender?.name || 'Team'}:</span> {messageText}
          </div>, 
          {
            variant: "info",
            autoHideDuration: 4000,
            action: (key) => (
              <Button
                size="sm"
                variant="outline"
                className="bg-white/10 text-white hover:bg-white/20 border-none ml-2 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(true);
                  setShowTooltip(false);
                  closeSnackbar(key);
                }}
              >
                View
              </Button>
            ),
          }
        );
      }

      if (newMessage.teamId === teamId) {
        queryClient.setQueryData(["team-messages", teamId], (oldData: any) => {
          if (!oldData) return oldData;
          // Check if message already exists
          const exists = oldData.pages.some((page: TeamMessage[]) => page.find(m => m.id === newMessage.id));
          if (!exists) {
            const newPages = [...oldData.pages];
            newPages[0] = [...newPages[0], newMessage];
            return { ...oldData, pages: newPages };
          }
          return oldData;
        });
      }

      // Update mentorTeams and organizerTeams cache for the sidebar preview
      const updateTeamListCache = (queryKeyPrefix: string) => {
        queryClient.setQueriesData({ queryKey: [queryKeyPrefix] }, (oldData: any) => {
          if (!oldData) return oldData;

          const updateTeam = (t: any) => {
            if (t.id === newMessage.teamId) {
              const isOwnMessage = user?.id && String(newMessage.senderId) === String(user.id);
              const shouldIncrementUnread = !isOwnMessage && (!isOpenRef.current || newMessage.teamId !== teamId);
              return {
                ...t,
                lastMessage: newMessage,
                lastMessageAt: newMessage.createdAt || new Date().toISOString(),
                unreadCount: shouldIncrementUnread ? (t.unreadCount || 0) + 1 : (isOwnMessage ? 0 : (t.unreadCount || 0))
              };
            }
            return t;
          };

          if (Array.isArray(oldData)) {
            return oldData.map(updateTeam);
          }
          if (Array.isArray(oldData?.data)) {
            return {
              ...oldData,
              data: oldData.data.map(updateTeam),
            };
          }
          return oldData;
        });
      };
      updateTeamListCache("mentorTeams");
      updateTeamListCache("organizerTeams");
      updateTeamListCache("organizerTeamsMessages");
    };

    const handleMessagesReadUpdated = (updatedMessages: TeamMessage[]) => {
      queryClient.setQueryData(["team-messages", teamId], (oldData: any) => {
        if (!oldData) return oldData;
        const newPages = oldData.pages.map((page: TeamMessage[]) => 
          page.map((msg: TeamMessage) => {
            const updated = updatedMessages.find((u) => u.id === msg.id);
            return updated ? { ...msg, ...updated } : msg;
          })
        );
        return { ...oldData, pages: newPages };
      });
    };

    const handleMessageEdited = (updatedMessage: TeamMessage) => {
      queryClient.setQueryData(["team-messages", teamId], (oldData: any) => {
        if (!oldData) return oldData;
        const newPages = oldData.pages.map((page: TeamMessage[]) => 
          page.map((msg: TeamMessage) => msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg)
        );
        return { ...oldData, pages: newPages };
      });
    };

    const handleMessageDeleted = (deletedMessage: TeamMessage) => {
      queryClient.setQueryData(["team-messages", teamId], (oldData: any) => {
        if (!oldData) return oldData;
        const newPages = oldData.pages.map((page: TeamMessage[]) => 
          page.map((msg: TeamMessage) => msg.id === deletedMessage.id ? { ...msg, ...deletedMessage } : msg)
        );
        return { ...oldData, pages: newPages };
      });
    };

    socket.on("receive_chat_message", handleReceiveMessage);
    socket.on("messages_read_updated", handleMessagesReadUpdated);
    socket.on("chat_message_edited", handleMessageEdited);
    socket.on("chat_message_deleted", handleMessageDeleted);

    return () => {
      // Intentionally NOT leaving the team room so we can continue receiving notifications globally
      socket.off("receive_chat_message", handleReceiveMessage);
      socket.off("messages_read_updated", handleMessagesReadUpdated);
      socket.off("chat_message_edited", handleMessageEdited);
      socket.off("chat_message_deleted", handleMessageDeleted);
    };
  }, [socket, teamId, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      // Only auto-scroll to bottom if we are already near the bottom or if it's the first load
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      if (scrollHeight - scrollTop - clientHeight < 150 || messages.length <= 20) {
        scrollRef.current.scrollTop = scrollHeight;
      }
    }
  }, [messages, isOpen]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    if (target.scrollTop === 0 && hasNextPage && !isFetchingNextPage) {
      // Save scroll height before fetching
      const oldScrollHeight = target.scrollHeight;
      fetchNextPage().then(() => {
        // Restore scroll position so it doesn't jump to top
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight - oldScrollHeight;
        }
      });
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    if (!message.trim() || !socket || !isConnected) return;

    socket.emit("send_chat_message", { teamId, content: message.trim() });
    setMessage("");
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case "student":
        return "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20";
      case "leader":
        return "bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20";
      case "stakeholder":
        return "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20";
      case "organizer":
      case "admin":
        return "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-500 hover:bg-zinc-500/20";
    }
  };

  return (
    <>
      {!inline && (
        <div className={`fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 ${isOpen ? 'hidden' : 'flex'}`}>
          {/* Tooltip Welcome Bubble */}
          <AnimatePresence>
            {showTooltip && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white dark:bg-zinc-800 text-foreground px-4 py-2 rounded-2xl rounded-br-sm shadow-xl border border-border text-sm font-medium flex items-center gap-2 relative"
              >
                <div className="absolute right-4 -bottom-[6px] w-3 h-3 bg-white dark:bg-zinc-800 border-b border-r border-border transform rotate-45" />
                Chat with Team & Mentors 👋
                <button onClick={() => setShowTooltip(false)} className="text-muted-foreground hover:text-foreground ml-1">
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Button */}
          <div className="relative">
            {unreadCount > 0 && (
              <div className="absolute -top-2 -right-2 z-50 flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-red-500 text-white border-2 border-background rounded-full shadow-lg text-xs font-bold animate-bounce">
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
            <Button
              onClick={() => {
                setIsOpen(true);
                setShowTooltip(false);
              }}
              className="h-14 w-14 rounded-full shadow-[0_0_20px_rgba(249,115,22,0.4)] animate-bounce hover:animate-none bg-gradient-to-tr from-orange-600 to-orange-400 hover:scale-105 transition-transform relative z-10"
            >
              <MessageSquare className="h-6 w-6 text-white" />
            </Button>
            <div className="absolute inset-0 rounded-full bg-orange-500 opacity-20 animate-ping pointer-events-none" style={{ animationDuration: '3s' }} />
          </div>
        </div>
      )}

      <AnimatePresence>
        {(isOpen || inline) && (
          <motion.div
            initial={inline ? false : { opacity: 0, y: 20, scale: 0.95 }}
            animate={inline ? false : { opacity: 1, y: 0, scale: 1 }}
            exit={inline ? undefined : { opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={
              inline
                ? "flex h-full w-full flex-col overflow-hidden bg-background"
                : "fixed bottom-6 right-6 z-50 flex h-[500px] w-[350px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
            }
          >
            {/* Header */}
            {!inline && (
              <div className="flex items-center justify-between border-b border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-orange-500" />
                  <h3 className="font-semibold">{teamName || "Team Discussion"}</h3>
                  <Badge variant="outline" className={isConnected ? "text-green-500 border-green-500/30" : "text-zinc-500"}>
                    {isConnected ? "Live" : "Connecting..."}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto" ref={scrollRef} onScroll={handleScroll}>
              {isFetchingNextPage && (
                <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
                  Loading older messages...
                </div>
              )}
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground text-center">
                  No messages yet. <br /> Start the conversation!
                </div>
              ) : (
                <div className="flex flex-col gap-1 pb-4">
                  {messages.map((msg, index) => {
                    const isMe = msg.senderId === user?.id;
                    const nextMsg = messages[index + 1];
                    const prevMsg = messages[index - 1];
                    const isConsecutive = prevMsg && prevMsg.senderId === msg.senderId;
                    const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId;
                    const isAbsoluteLast = index === messages.length - 1;

                    // Calculate readers to display for this specific message
                    const lastReadMessageIdByUser = new Map<number, number>();
                    messages.forEach(m => {
                      m.reads?.forEach(r => {
                        lastReadMessageIdByUser.set(r.userId, m.id);
                      });
                    });
                    
                    const readersToDisplay = msg.reads?.filter(r => lastReadMessageIdByUser.get(r.userId) === msg.id) || [];

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"} ${isConsecutive ? "mt-1" : "mt-4"}`}
                      >
                        {/* Avatar */}
                        <div className="w-8 shrink-0 flex items-end">
                          {!isMe && isLastInGroup && (
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={msg.sender?.avatarUrl || ""} />
                              <AvatarFallback>
                                <UserIcon className="h-4 w-4 text-muted-foreground" />
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>

                        {/* Message Content */}
                        <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[75%]`}>
                          {!isConsecutive && !isMe && (
                            <div className="flex items-center gap-2 mb-1 ml-1">
                              <span className="text-xs text-muted-foreground font-medium">
                                {msg.sender?.name || "Unknown"}
                              </span>
                              {msg.sender?.role && (
                                <Badge className={`text-[10px] h-4 px-1 rounded-sm ${getRoleBadgeColor(msg.sender.role)}`}>
                                  {msg.sender.role === 'stakeholder' ? 'Mentor' : msg.sender.role}
                                </Badge>
                              )}
                            </div>
                          )}
                          <div
                            className={`px-4 py-2 text-sm relative group ${
                              msg.isDeleted ? 'bg-muted/50 border border-border/50 text-muted-foreground' : (isMe ? "bg-orange-500 text-white" : "bg-muted text-foreground")
                            } ${
                              isMe 
                                ? `rounded-l-2xl ${isConsecutive ? 'rounded-tr-md rounded-br-md' : 'rounded-tr-2xl rounded-br-md'} ${isLastInGroup ? 'rounded-br-2xl' : ''}`
                                : `rounded-r-2xl ${isConsecutive ? 'rounded-tl-md rounded-bl-md' : 'rounded-tl-2xl rounded-bl-md'} ${isLastInGroup ? 'rounded-bl-2xl' : ''}`
                            }`}
                          >
                            {msg.isDeleted ? (
                              <span className="italic opacity-70">This message was deleted.</span>
                            ) : editingMessageId === msg.id ? (
                              <form 
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  if (!readOnly && editContent.trim()) {
                                    socket?.emit("edit_chat_message", { messageId: msg.id, content: editContent.trim() });
                                    setEditingMessageId(null);
                                  }
                                }}
                                className="flex flex-col gap-2 min-w-[200px]"
                              >
                                <Input 
                                  value={editContent} 
                                  onChange={(e) => setEditContent(e.target.value)} 
                                  className={`h-8 text-xs bg-background/50 border-white/20 ${isMe ? 'text-white' : 'text-foreground'}`}
                                  autoFocus 
                                />
                                <div className="flex gap-2 justify-end">
                                  <Button type="button" size="sm" variant="ghost" className={`h-6 px-2 text-[10px] ${isMe ? 'hover:text-white/80' : ''}`} onClick={() => setEditingMessageId(null)}>Cancel</Button>
                                  <Button type="submit" size="sm" variant="secondary" className="h-6 px-2 text-[10px]">Save</Button>
                                </div>
                              </form>
                            ) : (
                              <>
                                {msg.content}
                                {msg.isEdited && <span className="text-[10px] opacity-70 ml-2">(edited)</span>}
                                {!readOnly && (isMe || user?.role === 'admin' || user?.role === 'organizer') && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className={`absolute top-2 ${isMe ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded-full transition-opacity z-10`}>
                                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align={isMe ? "end" : "start"} className="z-[60]">
                                      {isMe && (
                                        <DropdownMenuItem onClick={() => { setEditingMessageId(msg.id); setEditContent(msg.content); }}>
                                          <Pencil className="h-4 w-4 mr-2" /> Edit
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-600" onClick={() => {
                                        if (confirm('Are you sure you want to delete this message?')) {
                                          socket?.emit("delete_chat_message", { messageId: msg.id });
                                        }
                                      }}>
                                        <Trash className="h-4 w-4 mr-2" /> Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </>
                            )}
                          </div>

                          {/* Status / Timestamp */}
                          {(isLastInGroup || (isMe && isAbsoluteLast)) && (
                            <div className="flex items-center gap-1 mt-0.5 justify-end">
                              {isLastInGroup && (
                                <span className="text-[10px] text-muted-foreground/60 mr-1">
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                              {isMe && (
                                <span className="flex items-center">
                                  {readersToDisplay.length > 0 ? (
                                    <div className="flex -space-x-1">
                                      {readersToDisplay.map((read) => (
                                        <Avatar key={read.userId} className="h-[14px] w-[14px] border border-background">
                                          <AvatarImage src={read.user.avatarUrl || ""} />
                                          <AvatarFallback className="text-[8px]">{read.user.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                      ))}
                                    </div>
                                  ) : isAbsoluteLast ? (
                                    <CheckCircle2 className="h-3 w-3 text-muted-foreground/50" />
                                  ) : null}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={handleSendMessage}
              className="flex items-center gap-2 border-t border-border bg-muted/10 p-3"
            >
              <Input
                placeholder={readOnly ? "Event ended — chat history is view only" : "Type your message..."}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={readOnly}
                className="flex-1 rounded-full border-border bg-background px-4"
              />
              <Button
                type="submit"
                size="icon"
                disabled={readOnly || !message.trim() || !isConnected}
                variant="orange"
                className="h-10 w-10 shrink-0 rounded-full"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
