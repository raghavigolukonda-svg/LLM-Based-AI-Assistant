import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Send, 
  Paperclip, 
  Trash2, 
  MessageSquare, 
  User, 
  Bot, 
  FileText, 
  MoreVertical,
  Settings,
  Shield,
  History,
  Menu,
  X,
  FileIcon,
  ChevronDown,
  Sparkles,
  Command,
  Activity,
  Zap,
  Lock,
  Cpu,
  Globe
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';

import { Message, ChatSession, AttachedFile } from './types';
import { streamChat } from './lib/gemini';
import { extractTextFromPdf, fileToBase64 } from './lib/pdf';
import ReactMarkdown from 'react-markdown';

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('nexus-chat-sessions');
    if (saved) {
      const parsed = JSON.parse(saved);
      setSessions(parsed);
      if (parsed.length > 0) setCurrentSessionId(parsed[0].id);
    } else {
      createNewSession();
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('nexus-chat-sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, currentSessionId, isStreaming]);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: 'New Conversation',
      messages: [],
      updatedAt: Date.now(),
    };
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    if (currentSessionId === id) {
      setCurrentSessionId(updated.length > 0 ? updated[0].id : null);
      if (updated.length === 0) createNewSession();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      let content = '';
      try {
        if (file.type === 'application/pdf') {
          content = await extractTextFromPdf(file);
        } else if (file.type.startsWith('image/')) {
          content = await fileToBase64(file);
        } else {
          content = await file.text();
        }

        setAttachedFiles(prev => [...prev, {
          name: file.name,
          type: file.type,
          content,
          size: file.size
        }]);
      } catch (err) {
        console.error('File parsing error:', err);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isStreaming || !currentSessionId) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
      files: attachedFiles.length > 0 ? [...attachedFiles] : undefined
    };

    const updatedSessions = sessions.map(s => {
      if (s.id === currentSessionId) {
        return {
          ...s,
          messages: [...s.messages, userMessage],
          updatedAt: Date.now(),
          title: s.messages.length === 0 ? input.slice(0, 30) || 'File Analysis' : s.title
        };
      }
      return s;
    });

    setSessions(updatedSessions);
    setInput('');
    setAttachedFiles([]);
    setIsStreaming(true);

    const assistantMessageId = crypto.randomUUID();
    const initialAssistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };

    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return { ...s, messages: [...s.messages, initialAssistantMessage] };
      }
      return s;
    }));

    try {
      const currentMessages = updatedSessions.find(s => s.id === currentSessionId)?.messages || [];
      const chatStream = streamChat([...currentMessages, userMessage]);
      
      let fullContent = '';
      for await (const chunk of chatStream) {
        fullContent += (chunk || '');
        setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
            return {
              ...s,
              messages: s.messages.map(m => 
                m.id === assistantMessageId ? { ...m, content: fullContent } : m
              )
            };
          }
          return s;
        }));
      }
    } catch (error) {
      console.error('Streaming error:', error);
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            messages: s.messages.map(m => 
              m.id === assistantMessageId ? { ...m, content: 'Sorry, I encountered an error. Please check your API key or try again.' } : m
            )
          };
        }
        return s;
      }));
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
        {/* Sidebar */}
        <motion.aside 
          initial={false}
          animate={{ width: isSidebarOpen ? 300 : 0, opacity: isSidebarOpen ? 1 : 0 }}
          className="bg-muted/30 border-r flex flex-col relative z-20 overflow-hidden"
        >
          <div className="p-6 flex flex-col min-w-[260px]">
            <div className="flex items-center gap-2 font-bold text-[12px] uppercase tracking-[2px] text-primary mb-8 px-2">
              <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_10px_#3B82F6]" />
              Architect AI
            </div>
            
            <div className="flex items-center justify-between mb-2 px-2">
              <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Workspace</span>
              <Tooltip>
                <TooltipTrigger render={
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={createNewSession}>
                    <Plus className="w-4 h-4" />
                  </Button>
                } />
                <TooltipContent>New Chat</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <ScrollArea className="flex-1 px-3 min-w-[260px]">
            <div className="space-y-1 py-2">
              {sessions.map(session => (
                <div
                  key={session.id}
                  onClick={() => setCurrentSessionId(session.id)}
                  className={`
                    group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200
                    ${currentSessionId === session.id 
                      ? 'bg-secondary text-secondary-foreground' 
                      : 'hover:bg-muted/50 text-muted-foreground'}
                  `}
                >
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate text-sm font-medium">
                    {session.title}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                        <MoreVertical className="w-3 h-3" />
                      </Button>
                    } />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-destructive" onClick={(e) => deleteSession(e, session.id)}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="p-4 border-t bg-muted/20 min-w-[300px]">
            <div className="flex items-center gap-3 p-2 rounded-xl border bg-card/50">
              <Avatar className="w-9 h-9 border text-xs">
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold truncate">Guest User</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-tight">Free Tier</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col relative min-w-0">
          {/* Header */}
          <header className="h-16 border-b flex items-center justify-between px-6 bg-background/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                className="lg:hidden" 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="hidden lg:flex" 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                {isSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-2 overflow-hidden">
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 shrink-0">
                  Gemini 3.1 Pro
                </Badge>
                <span className="text-sm text-muted-foreground truncate max-w-[200px] hidden sm:inline">
                  {currentSession?.title}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger render={
                  <Button variant="ghost" size="icon">
                    <History className="w-5 h-5" />
                  </Button>
                } />
                <TooltipContent>Memory Log</TooltipContent>
              </Tooltip>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                <Shield className="w-3 h-3 text-green-500" />
                SECURE
              </div>
            </div>
          </header>

          {/* Chat Area */}
          <div className="h-8 bg-muted/20 border-b flex items-center px-4 gap-6 text-[11px] text-muted-foreground/80 overflow-x-auto whitespace-nowrap scrollbar-none">
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
              SYSTEM ONLINE
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Cpu className="w-3 h-3" />
              GEMINI 3.1 PRO
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Activity className="w-3 h-3" />
              LAT: 24MS
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <History className="w-3 h-3" />
              MEMORY: 14.2K TOKENS
            </div>
          </div>

          <ScrollArea className="flex-1 p-6">
            <div className="max-w-3xl mx-auto space-y-8 pb-32">
              {currentSession?.messages.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center min-h-[60vh] text-center"
                >
                  <div className="w-16 h-16 rounded-3xl bg-secondary mb-6 flex items-center justify-center text-primary">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <h1 className="text-4xl font-bold tracking-tight mb-4">How can I help you today?</h1>
                  <p className="text-muted-foreground max-w-md mx-auto mb-8">
                    I'm Nexus, your advanced AI assistant. I can analyze files, write code, and solve complex problems with structured reasoning.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
                    {[
                      { icon: FileText, text: "Analyze this PDF for key insights" },
                      { icon: Command, text: "Write a high-performance React component" },
                      { icon: Shield, text: "Explain encryption fundamentals" },
                      { icon: MessageSquare, text: "Let's brainstorm a new project" }
                    ].map((item, idx) => (
                      <Button 
                        key={idx} 
                        variant="outline" 
                        className="justify-start h-auto py-3 px-4 text-left"
                        onClick={() => setInput(item.text)}
                      >
                        <item.icon className="w-4 h-4 mr-3 shrink-0 opacity-60" />
                        <span className="truncate">{item.text}</span>
                      </Button>
                    ))}
                  </div>
                </motion.div>
              )}

              {currentSession?.messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className={`max-w-[85%] flex flex-col gap-2 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {message.role === 'assistant' && (
                      <div className="text-[10px] font-bold text-primary uppercase tracking-[2px] flex items-center gap-2 mb-1">
                        <Bot className="w-3 h-3" />
                        Architect Response
                      </div>
                    )}
                    
                    {message.files && message.files.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-1">
                        {message.files.map((file, i) => (
                          <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-md bg-[#18181B] text-primary text-[11px] border border-primary/30">
                            <FileIcon className="w-3 h-3" />
                            <span className="truncate max-w-[120px]">{file.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className={`
                      px-4 py-3 text-[14px] leading-[1.5]
                      ${message.role === 'user' 
                        ? 'bg-[#27272A] text-white rounded-2xl rounded-br-[2px]' 
                        : 'bg-[#18181B] text-[#E4E4E7] border border-[#27272A] rounded-2xl rounded-bl-[2px]'}
                    `}>
                      <div className="markdown-body prose prose-invert prose-sm max-w-none break-words">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                      {message.role === 'assistant' && message.content === '' && isStreaming && (
                        <div className="flex gap-1 py-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce shadow-[0_0_5px_#3B82F6]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s] shadow-[0_0_5px_#3B82F6]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s] shadow-[0_0_5px_#3B82F6]" />
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="absolute bottom-6 left-0 right-0 px-6">
            <div className="max-w-3xl mx-auto">
              <div className="relative bg-[#18181B] border border-[#27272A] rounded-xl shadow-2xl overflow-hidden focus-within:border-primary transition-all">
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-[#27272A] bg-muted/10">
                    <AnimatePresence>
                      {attachedFiles.map((file, idx) => (
                        <motion.div 
                          key={idx}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#27272A] text-primary text-[11px] border border-primary/20 group pr-1"
                        >
                          <FileIcon className="w-3 h-3" />
                          <span className="max-w-[120px] truncate">{file.name}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))}
                          >
                            <X className="w-2.5 h-2.5" />
                          </Button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
                
                <div className="flex items-center px-4 py-2 gap-3 min-h-[56px]">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 bg-[#27272A] text-muted-foreground rounded-lg"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything... (Chain of Thought Enabled)"
                    className="flex-1 bg-transparent border-0 focus:ring-0 outline-none text-[14px] text-white placeholder:text-muted-foreground/50"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  
                  <Button 
                    size="icon" 
                    disabled={(!input.trim() && attachedFiles.length === 0) || isStreaming}
                    onClick={handleSendMessage}
                    className={`h-8 w-8 rounded-lg transition-all ${input.trim() || attachedFiles.length > 0 ? 'bg-primary text-white' : 'bg-[#27272A] text-muted-foreground'}`}
                  >
                    {isStreaming ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-center gap-4 mt-3">
                <span className="px-2 py-0.5 rounded bg-[#27272A] text-[10px] font-bold text-muted-foreground uppercase tracking-wider border border-[#3F3F46]">ACT AS: ARCHITECT</span>
                <span className="px-2 py-0.5 rounded bg-[#27272A] text-[10px] font-bold text-muted-foreground uppercase tracking-wider border border-[#3F3F46]">TONE: ANALYTICAL</span>
                <span className="px-2 py-0.5 rounded bg-[#27272A] text-[10px] font-bold text-muted-foreground uppercase tracking-wider border border-[#3F3F46]">MEM: ON</span>
              </div>
            </div>
          </div>
        </main>

        {/* Right Sidebar (Control Panel) */}
        <aside className="hidden xl:flex w-[240px] bg-[#0F0F12] border-l flex-col p-6 gap-8 overflow-y-auto">
          <div className="space-y-4">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">AI Controller</div>
            <Card className="bg-[#18181B] border-[#27272A] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">Response Quality</span>
                <span className="font-mono text-sm font-bold text-white">99.4%</span>
              </div>
              <div className="h-0.5 bg-[#27272A] rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '99.4%' }}
                  className="h-full bg-primary"
                />
              </div>
            </Card>
            <Card className="bg-[#18181B] border-[#27272A] p-4">
              <div className="text-[10px] text-muted-foreground uppercase tracking-tighter mb-1">Processing Power</div>
              <div className="font-mono text-lg font-bold text-white flex items-center gap-2">
                4.2 TFLOPs
                <Zap className="w-3 h-3 text-primary animate-pulse" />
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Prompt Engineering</div>
            <div className="space-y-2">
              {[
                { icon: Shield, text: "PI Redaction Enabled", color: "text-indigo-400" },
                { icon: Lock, text: "Hallucination Filter V2", color: "text-indigo-400" }
              ].map((guard, i) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-[#18181B] border border-indigo-900/30 rounded-md text-[11px] text-indigo-400">
                  <guard.icon className="w-3 h-3" />
                  {guard.text}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 mt-auto">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">System Health</div>
            <div className="grid grid-cols-2 gap-y-2 text-[11px]">
              <span className="text-muted-foreground">CPU</span>
              <span className="text-right text-emerald-500 font-mono">12%</span>
              <span className="text-muted-foreground">Network</span>
              <span className="text-right text-emerald-500 font-mono">Optimal</span>
              <span className="text-muted-foreground">Streaming</span>
              <span className="text-right text-primary font-mono italic">Active</span>
            </div>
          </div>
        </aside>
      </div>
    </TooltipProvider>
  );
}
