import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { 
  Bot, Send, Loader2, Sparkles, BookOpen, 
  HelpCircle, MessageSquare, GraduationCap, AlertCircle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { askTutorQuestion } from "@/lib/webhook";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/tutor")({
  component: AITutorPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      lessonId: (search.lessonId as string) || undefined,
    };
  },
});

type LessonOption = {
  id: string;
  title: string;
  subject: string | null;
  lesson_plan: string | null;
  worksheet: string | null;
};

type ChatMessage = {
  id?: string;
  role: "user" | "model";
  content: string;
  created_at?: string;
};

function AITutorPage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const search = useSearch({ from: "/_app/tutor" });
  
  // State
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  // Load published lessons
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("lessons")
          .select("id, title, subject, lesson_plan, worksheet")
          .eq("is_published", true)
          .order("title", { ascending: true });
        
        if (error) throw error;
        setLessons(data || []);
        
        // If lessonId parameter is in URL, select it automatically
        if (search.lessonId && (data || []).some(l => l.id === search.lessonId)) {
          setSelectedLessonId(search.lessonId);
        } else if (data && data.length > 0) {
          setSelectedLessonId(data[0].id);
        }
      } catch (err) {
        console.error("Error loading lessons in Tutor:", err);
        toast.error("Failed to load lessons list.");
      } finally {
        setLoading(false);
      }
    })();
  }, [search.lessonId]);

  // Load chat history for the selected lesson
  useEffect(() => {
    if (!selectedLessonId || !user) return;
    
    (async () => {
      try {
        const { data, error } = await supabase
          .from("tutor_chats")
          .select("id, message, response, created_at")
          .eq("lesson_id", selectedLessonId)
          .eq("student_id", user.id)
          .order("created_at", { ascending: true });

        if (error) throw error;
        
        const history: ChatMessage[] = [];
        (data || []).forEach(chat => {
          history.push({ role: "user", content: chat.message, created_at: chat.created_at });
          history.push({ role: "model", content: chat.response, created_at: chat.created_at });
        });

        setChatHistory(history);
      } catch (err) {
        console.error("Error loading chats in Tutor:", err);
      }
    })();
  }, [selectedLessonId, user]);

  const activeLesson = lessons.find(l => l.id === selectedLessonId);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedLessonId || !user || !activeLesson) return;

    const userText = inputMessage.trim();
    setInputMessage("");
    setSending(true);

    // Optimistically add user query
    const updatedHistory: ChatMessage[] = [...chatHistory, { role: "user", content: userText }];
    setChatHistory(updatedHistory);

    try {
      // Build lesson plan text context
      const lessonContext = `Lesson: ${activeLesson.title}\nSubject: ${activeLesson.subject || "General"}\n\nLesson Plan:\n${activeLesson.lesson_plan || ""}\n\nWorksheet:\n${activeLesson.worksheet || ""}`;
      
      // Form history array for Gemini API
      const apiHistory = chatHistory.map(chat => ({
        role: chat.role,
        content: chat.content
      }));

      // Call Gemini completion
      const aiReply = await askTutorQuestion(lessonContext, apiHistory, userText, language);

      // Insert message and response into Database
      const { error } = await supabase
        .from("tutor_chats")
        .insert({
          student_id: user.id,
          lesson_id: selectedLessonId,
          message: userText,
          response: aiReply
        });

      if (error) throw error;

      setChatHistory([...updatedHistory, { role: "model", content: aiReply }]);
    } catch (err: any) {
      console.error("Error communicating with Tutor:", err);
      toast.error("AI Tutor responded with an error. Please verify your Gemini Key.");
      setChatHistory([...updatedHistory, { role: "model", content: `*(Error: Failed to fetch AI response. Please check your internet connection or Gemini Key configuration)*` }]);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Initializing AI Tutor Room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] space-y-4">
      {/* Header section */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-8 w-8 text-primary" />
            {t("aiTutor")}
          </h1>
          <p className="text-muted-foreground">Select any published lesson and clear your doubts instantly with specialized AI assistance.</p>
        </div>
        
        {/* Selector */}
        <div className="flex items-center gap-2 w-full max-w-sm">
          <GraduationCap className="h-5 w-5 text-primary shrink-0" />
          <Select value={selectedLessonId} onValueChange={setSelectedLessonId}>
            <SelectTrigger className="w-full bg-card">
              <SelectValue placeholder="Select a lesson to study..." />
            </SelectTrigger>
            <SelectContent>
              {lessons.map(lesson => (
                <SelectItem key={lesson.id} value={lesson.id}>
                  {lesson.title} ({lesson.subject || "General"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {lessons.length === 0 ? (
        <Card className="border-dashed p-10 text-center border-border bg-card/20 flex-1 flex flex-col items-center justify-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground/60 mb-2" />
          <CardTitle className="text-base font-semibold">No Lessons Published</CardTitle>
          <CardDescription className="max-w-xs mt-1">
            Wait for your teacher to publish lessons to the classroom library so you can query the AI Tutor.
          </CardDescription>
        </Card>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
          {/* Chat Container */}
          <Card className="flex-1 flex flex-col bg-card/40 border-border/80 backdrop-blur-sm overflow-hidden min-h-0">
            <CardHeader className="border-b py-3 px-4 flex flex-row items-center gap-2 bg-muted/15">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Bot className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">{activeLesson?.title}</CardTitle>
                <CardDescription className="text-[10px]">Context: Lesson Plan & Worksheet</CardDescription>
              </div>
            </CardHeader>
            
            {/* Messages body */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {chatHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
                  <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                  <div className="max-w-md">
                    <p className="font-semibold text-foreground text-sm">Welcome to your AI Doubt Solver</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Ask questions like *"Explain section 3 in simple terms"*, *"Give me 3 practice questions on this topic"*, or *"How does this lesson apply to real life?"*
                    </p>
                  </div>
                </div>
              ) : (
                chatHistory.map((chat, index) => {
                  const isUser = chat.role === "user";
                  return (
                    <div 
                      key={index}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`flex gap-2 max-w-[80%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isUser ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                        }`}>
                          {isUser ? "U" : "T"}
                        </div>
                        <div className={`rounded-xl p-3.5 text-sm leading-relaxed shadow-sm whitespace-pre-line ${
                          isUser 
                            ? "bg-primary text-primary-foreground rounded-tr-none" 
                            : "bg-card border rounded-tl-none text-foreground"
                        }`}>
                          {chat.content}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              
              {/* Typing loader */}
              {sending && (
                <div className="flex justify-start">
                  <div className="flex gap-2 max-w-[80%] items-center">
                    <div className="h-8 w-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-bold">
                      T
                    </div>
                    <div className="rounded-xl border bg-card p-3 shadow-sm flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Tutor is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </CardContent>
            
            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="border-t p-3 flex gap-2 bg-muted/10">
              <Input
                placeholder="Ask any question about this lesson..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={sending}
                className="bg-background"
              />
              <Button type="submit" size="icon" disabled={sending || !inputMessage.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </Card>

          {/* Quick Context panel */}
          <div className="w-full md:w-64 space-y-4">
            <Card className="bg-card/35 border-border/80">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Study Context
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2.5">
                <p>The tutor is loaded with full access to this lesson's guidance plan, learning targets, and student activities.</p>
                <p className="border-t pt-2 mt-2">
                  <span className="font-semibold text-foreground block mb-0.5">Focus Subject:</span>
                  {activeLesson?.subject || "General"}
                </p>
                <p>
                  <span className="font-semibold text-foreground block mb-0.5">Multilingual Solver:</span>
                  The tutor automatically answers questions in the language you select or ask in.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/35 border-border/80">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  Quick Questions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {[
                  "Explain this topic in simple terms",
                  "List the top 3 formulas/rules here",
                  "Give me a short practice quiz"
                ].map((item, index) => (
                  <Button 
                    key={index} 
                    variant="ghost" 
                    className="w-full justify-start text-left text-xs h-auto py-2 px-2.5 hover:bg-primary/5 hover:text-primary leading-normal text-muted-foreground whitespace-normal"
                    onClick={() => setInputMessage(item)}
                    disabled={sending}
                  >
                    💡 {item}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
