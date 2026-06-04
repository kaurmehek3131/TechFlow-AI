import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { 
  callMakeWebhook, generateRubric, generateHomework, duplicateAndAdaptLesson,
  generateLessonSummaries, generateLessonQuestions, generateBloomsQuestions,
  generateTeachingSuggestions, regenerateLessonSection
} from "@/lib/webhook";
import { createVersionSnapshot, restoreVersion } from "@/lib/versions";
import { exportLessonKitToPDF } from "@/lib/pdf-export";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { LessonSection } from "@/components/LessonSection";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Save,
  RefreshCw,
  Mail,
  ArrowLeft,
  Globe,
  Lock,
  Download,
  Copy,
  History,
  Edit2,
  Sparkles,
  Check,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/lessons/$id")({ component: LessonView });

type Lesson = {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  topic: string | null;
  duration: string | null;
  language: string | null;
  objectives: string | null;
  lesson_plan: string | null;
  worksheet: string | null;
  quiz: string | null;
  answer_key: string | null;
  rubric: string | null;
  homework: string | null;
  short_summary: string | null;
  revision_notes: string | null;
  exam_notes: string | null;
  one_minute_review: string | null;
  generated_questions: string | null;
  blooms_taxonomy: string | null;
  teaching_suggestions: string | null;
  is_published: boolean;
};

const SUBJECTS = ["Math", "Science", "English", "History", "Geography", "Art", "Music", "Computer Science", "Physical Education"];
const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const DURATIONS = ["20 min", "30 min", "45 min", "60 min", "90 min"];
const LANGUAGES = ["English", "Hindi", "French", "Spanish", "German", "Japanese", "Chinese"];

function LessonView() {
  const { id } = Route.useParams();
  const { user, role, loading } = useAuth();
  const { language: activeLanguage, t } = useLanguage();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [busy, setBusy] = useState(false);

  // Editing state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editField, setEditField] = useState<keyof Lesson | null>(null);
  const [editText, setEditText] = useState("");

  // Version History states
  const [isVersionsOpen, setIsVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  // Duplication states
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [duplicateForm, setDuplicateForm] = useState({
    subject: "",
    grade: "",
    topic: "",
    duration: "",
    objectives: "",
    language: ""
  });

  // On-demand Rubric/Homework generation states
  const [isGeneratingRubric, setIsGeneratingRubric] = useState(false);
  const [rubricAssessmentType, setRubricAssessmentType] = useState("General Assessment");
  const [isGeneratingHomework, setIsGeneratingHomework] = useState(false);

  // Assignment states
  const [isAssignmentOpen, setIsAssignmentOpen] = useState(false);
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDueDate, setAssignmentDueDate] = useState("");
  const [createdAssignmentLink, setCreatedAssignmentLink] = useState("");
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Advanced AI states
  const [isGeneratingSummaries, setIsGeneratingSummaries] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isGeneratingBlooms, setIsGeneratingBlooms] = useState(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [isSmartRegenOpen, setIsSmartRegenOpen] = useState(false);
  const [smartRegenSection, setSmartRegenSection] = useState<'whole' | 'lesson_plan' | 'worksheet' | 'quiz' | 'homework' | 'answer_key'>('whole');
  const [smartRegenInstruction, setSmartRegenInstruction] = useState("");
  const [isRegeneratingSection, setIsRegeneratingSection] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("lessons").select("*").eq("id", id).maybeSingle();
    setLesson(data as Lesson | null);
  };

  useEffect(() => {
    if (!loading && role === "student") {
      navigate({ to: "/study/$id", params: { id } });
      return;
    }
    load();
  }, [id, role, loading]);

  useEffect(() => {
    if (lesson) {
      localStorage.setItem("active_lesson_title", lesson.title);
      localStorage.setItem("active_lesson_plan", lesson.lesson_plan ?? "");
      localStorage.setItem("active_lesson_worksheet", lesson.worksheet ?? "");
      localStorage.setItem("active_lesson_objectives", lesson.objectives ?? "");
      localStorage.setItem("active_lesson_subject", lesson.subject ?? "");
    }
    return () => {
      localStorage.removeItem("active_lesson_title");
      localStorage.removeItem("active_lesson_plan");
      localStorage.removeItem("active_lesson_worksheet");
      localStorage.removeItem("active_lesson_objectives");
      localStorage.removeItem("active_lesson_subject");
    };
  }, [lesson]);

  if (!lesson) return <div className="text-muted-foreground text-center py-12">Loading…</div>;

  // Save manual snapshot
  const save = async () => {
    try {
      await createVersionSnapshot(lesson.id, user?.id);
      toast.success("Manual version snapshot created successfully");
    } catch (e: any) {
      toast.error("Failed to create snapshot: " + e.message);
    }
  };

  // Full regeneration
  const regenerate = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("webhook_url").eq("id", user.id).maybeSingle();
      
      // Before update, take version history snapshot of current state
      await createVersionSnapshot(lesson.id, user.id);

      const out = await callMakeWebhook(profile?.webhook_url ?? "", {
        subject: lesson.subject ?? "",
        grade: lesson.grade ?? "",
        topic: lesson.topic ?? "",
        duration: lesson.duration ?? "",
        language: activeLanguage,
        objectives: lesson.objectives ?? "",
      });

      await supabase.from("lessons").update({ ...out, language: activeLanguage }).eq("id", lesson.id);
      await load();
      toast.success("Regenerated complete lesson kit!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Manual Section Editing
  const openEdit = (field: keyof Lesson) => {
    setEditField(field);
    setEditText((lesson[field] as string) || "");
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editField || !user) return;
    setBusy(true);
    try {
      // 1. Take snapshot of current state
      await createVersionSnapshot(lesson.id, user.id);

      // 2. Update field
      const { error } = await supabase
        .from("lessons")
        .update({ [editField]: editText })
        .eq("id", lesson.id);

      if (error) throw error;
      await load();
      setIsEditOpen(false);
      toast.success("Section updated successfully");
    } catch (e: any) {
      toast.error("Failed to update: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  // Version History actions
  const openVersions = async () => {
    setIsVersionsOpen(true);
    try {
      const { data } = await supabase
        .from("lesson_versions")
        .select("*")
        .eq("lesson_id", id)
        .order("version_number", { ascending: false });
      setVersions(data || []);
    } catch (e: any) {
      toast.error("Failed to fetch version history: " + e.message);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!user) return;
    setBusy(true);
    try {
      await restoreVersion(versionId, lesson.id, user.id);
      await load();
      setIsVersionsOpen(false);
      toast.success("Lesson version restored successfully");
    } catch (e: any) {
      toast.error("Failed to restore: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  // Duplication & Adaptation
  const openDuplicate = () => {
    setDuplicateForm({
      subject: lesson.subject || "",
      grade: lesson.grade || "",
      topic: lesson.topic || "",
      duration: lesson.duration || "",
      objectives: lesson.objectives || "",
      language: lesson.language || "English"
    });
    setIsDuplicateOpen(true);
  };

  const handleDuplicate = async () => {
    if (!user) return;
    setBusy(true);
    try {
      // Call adaptation AI pipeline
      const adapted = await duplicateAndAdaptLesson(lesson, duplicateForm);

      // Save into DB as new lesson
      const { data, error } = await supabase
        .from("lessons")
        .insert({
          user_id: user.id,
          title: `${duplicateForm.topic} (${duplicateForm.subject}, Grade ${duplicateForm.grade})`,
          ...duplicateForm,
          ...adapted
        })
        .select("id")
        .single();

      if (error) throw error;

      // Create version 1 snapshot for the duplicated lesson
      await createVersionSnapshot(data.id, user.id);

      setIsDuplicateOpen(false);
      toast.success("Lesson cloned and adapted successfully!");
      navigate({ to: "/lessons/$id", params: { id: data.id } });
    } catch (e: any) {
      toast.error("Cloning failed: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  // On-demand Rubric Generator
  const handleGenerateRubric = async () => {
    if (!user) return;
    setIsGeneratingRubric(true);
    try {
      await createVersionSnapshot(lesson.id, user.id);

      const rub = await generateRubric({
        subject: lesson.subject || "",
        grade: lesson.grade || "",
        topic: lesson.topic || "",
        objectives: lesson.objectives || "",
        assessmentType: rubricAssessmentType,
        language: lesson.language || "English"
      });

      await supabase.from("lessons").update({ rubric: rub }).eq("id", lesson.id);
      await load();
      toast.success("Grading rubric generated successfully!");
    } catch (e: any) {
      toast.error("Failed to generate rubric: " + e.message);
    } finally {
      setIsGeneratingRubric(false);
    }
  };

  // On-demand Homework Generator
  const handleGenerateHomework = async () => {
    if (!user) return;
    setIsGeneratingHomework(true);
    try {
      await createVersionSnapshot(lesson.id, user.id);

      const hw = await generateHomework({
        subject: lesson.subject || "",
        grade: lesson.grade || "",
        topic: lesson.topic || "",
        objectives: lesson.objectives || "",
        lessonContent: lesson.lesson_plan || "",
        language: lesson.language || "English"
      });

      await supabase.from("lessons").update({ homework: hw }).eq("id", lesson.id);
      await load();
      toast.success("Homework assignment generated successfully!");
    } catch (e: any) {
      toast.error("Failed to generate homework: " + e.message);
    } finally {
      setIsGeneratingHomework(false);
    }
  };

  // Create student assignment link
  const handleCreateAssignment = async () => {
    if (!user || !lesson) return;
    setIsCreatingAssignment(true);
    try {
      const { data, error } = await supabase
        .from("assignments")
        .insert({
          lesson_id: lesson.id,
          teacher_id: user.id,
          title: assignmentTitle || lesson.title,
          due_date: assignmentDueDate ? new Date(assignmentDueDate).toISOString() : null
        })
        .select("id")
        .single();

      if (error) throw error;
      
      const link = `${window.location.origin}/assignment/${data.id}`;
      setCreatedAssignmentLink(link);
      toast.success("Assignment created successfully!");
    } catch (e: any) {
      toast.error("Failed to create assignment: " + e.message);
    } finally {
      setIsCreatingAssignment(false);
    }
  };

  const copyCreatedLink = () => {
    if (!createdAssignmentLink) return;
    navigator.clipboard.writeText(createdAssignmentLink);
    setCopiedLink(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Advanced AI Generator Handlers
  const handleGenerateSummaries = async () => {
    if (!user || !lesson) return;
    setIsGeneratingSummaries(true);
    try {
      await createVersionSnapshot(lesson.id, user.id);
      const lessonText = `Lesson Plan:\n${lesson.lesson_plan || ''}\n\nWorksheet:\n${lesson.worksheet || ''}`;
      const res = await generateLessonSummaries(lessonText, lesson.language || "English");
      
      const { error } = await supabase
        .from("lessons")
        .update({
          short_summary: res.short_summary,
          revision_notes: res.revision_notes,
          exam_notes: res.exam_notes,
          one_minute_review: res.one_minute_review
        })
        .eq("id", lesson.id);

      if (error) throw error;
      await load();
      toast.success("AI Summaries generated successfully!");
    } catch (e: any) {
      toast.error("Failed to generate summaries: " + e.message);
    } finally {
      setIsGeneratingSummaries(false);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!user || !lesson) return;
    setIsGeneratingQuestions(true);
    try {
      await createVersionSnapshot(lesson.id, user.id);
      const lessonText = `Lesson Plan:\n${lesson.lesson_plan || ''}\n\nWorksheet:\n${lesson.worksheet || ''}`;
      const res = await generateLessonQuestions(lessonText, lesson.language || "English");

      const { error } = await supabase
        .from("lessons")
        .update({ generated_questions: res })
        .eq("id", lesson.id);

      if (error) throw error;
      await load();
      toast.success("AI Question Bank generated successfully!");
    } catch (e: any) {
      toast.error("Failed to generate question bank: " + e.message);
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handleGenerateBlooms = async () => {
    if (!user || !lesson) return;
    setIsGeneratingBlooms(true);
    try {
      await createVersionSnapshot(lesson.id, user.id);
      const lessonText = `Lesson Plan:\n${lesson.lesson_plan || ''}\n\nWorksheet:\n${lesson.worksheet || ''}`;
      const res = await generateBloomsQuestions(lessonText, lesson.language || "English");

      const { error } = await supabase
        .from("lessons")
        .update({ blooms_taxonomy: res })
        .eq("id", lesson.id);

      if (error) throw error;
      await load();
      toast.success("AI Bloom's Taxonomy questions generated successfully!");
    } catch (e: any) {
      toast.error("Failed to generate Bloom's questions: " + e.message);
    } finally {
      setIsGeneratingBlooms(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!user || !lesson) return;
    setIsGeneratingSuggestions(true);
    try {
      await createVersionSnapshot(lesson.id, user.id);
      const lessonText = `Lesson Plan:\n${lesson.lesson_plan || ''}\n\nWorksheet:\n${lesson.worksheet || ''}`;
      const res = await generateTeachingSuggestions(lessonText, lesson.language || "English");

      const { error } = await supabase
        .from("lessons")
        .update({ teaching_suggestions: res })
        .eq("id", lesson.id);

      if (error) throw error;
      await load();
      toast.success("AI Teaching Suggestions generated successfully!");
    } catch (e: any) {
      toast.error("Failed to generate teaching suggestions: " + e.message);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const handleSmartRegenerate = async () => {
    if (!user || !lesson || !smartRegenInstruction.trim() || smartRegenSection === "whole") return;
    setIsRegeneratingSection(true);
    try {
      await createVersionSnapshot(lesson.id, user.id);

      const updatedSectionText = await regenerateLessonSection(
        lesson,
        smartRegenSection,
        smartRegenInstruction,
        lesson.language || "English"
      );

      const { error } = await supabase
        .from("lessons")
        .update({ [smartRegenSection]: updatedSectionText })
        .eq("id", lesson.id);

      if (error) throw error;
      await load();
      setIsSmartRegenOpen(false);
      setSmartRegenInstruction("");
      toast.success(`Successfully regenerated section: ${smartRegenSection.replace("_", " ")}`);
    } catch (e: any) {
      toast.error("Failed to regenerate section: " + e.message);
    } finally {
      setIsRegeneratingSection(false);
    }
  };

  // Unified Email
  const email = () => {
    const body = `${lesson.title}\n\n=== Lesson Plan ===\n${lesson.lesson_plan}\n\n=== Worksheet ===\n${lesson.worksheet}\n\n=== Quiz ===\n${lesson.quiz}\n\n=== Answer Key ===\n${lesson.answer_key}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(lesson.title)}&body=${encodeURIComponent(body)}`;
    // Increment shares count
    supabase.rpc("increment_shares", { lesson_id: lesson.id }).then(() => {
      supabase.from("lessons").update({ shares_count: (lesson.shares_count || 0) + 1 }).eq("id", lesson.id);
    });
  };

  // Export Full Kit PDF
  const downloadFullKit = () => {
    exportLessonKitToPDF(lesson);
    // Increment shares count
    supabase.from("lessons").update({ shares_count: (lesson.shares_count || 0) + 1 }).eq("id", lesson.id);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Top Banner Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/library" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> {t("backToLibrary")}
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{lesson.title}</h1>
          <p className="text-muted-foreground">{lesson.subject} · Grade {lesson.grade} · {lesson.duration} · {lesson.language}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={lesson.is_published ? "default" : "outline"}
            onClick={async () => {
              const next = !lesson.is_published;
              const { error } = await supabase.from("lessons").update({ is_published: next }).eq("id", lesson.id);
              if (error) return toast.error(error.message);
              setLesson({ ...lesson, is_published: next });
              toast.success(next ? "Published to public library" : "Unpublished — now private");
            }}
          >
            {lesson.is_published ? <Globe className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
            {lesson.is_published ? t("published") : t("publish")}
          </Button>
          <Button 
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            onClick={() => {
              setAssignmentTitle(lesson.title);
              setAssignmentDueDate("");
              setCreatedAssignmentLink("");
              setIsAssignmentOpen(true);
            }} 
            title="Create Student Assignment Link"
          >
            <Globe className="mr-2 h-4 w-4" /> Create Assignment
          </Button>
          <Button variant="outline" onClick={save} title="Trigger Snapshot"><Save className="mr-2 h-4 w-4" /> {t("save")}</Button>
          <Button variant="outline" onClick={() => {
            setSmartRegenSection("whole");
            setSmartRegenInstruction("");
            setIsSmartRegenOpen(true);
          }} disabled={busy}>
            <RefreshCw className="mr-2 h-4 w-4" /> {t("regenerate")}
          </Button>
          <Button variant="outline" onClick={openVersions} title="View Versions"><History className="mr-2 h-4 w-4" /> {t("versions")}</Button>
          <Button variant="outline" onClick={openDuplicate} title="Clone & Modify"><Copy className="mr-2 h-4 w-4" /> {t("duplicate")}</Button>
          <Button variant="outline" onClick={downloadFullKit} title="Download Full PDF"><Download className="mr-2 h-4 w-4" /> {t("downloadFullKit")}</Button>
          <Button variant="outline" onClick={email}><Mail className="mr-2 h-4 w-4" /> {t("email")}</Button>
        </div>
      </div>

      {/* Accordion Panels */}
      <Card className="bg-card/40 border-border/60 backdrop-blur-sm shadow-sm">
        <CardHeader><CardTitle>{t("lessonKit")}</CardTitle></CardHeader>
        <CardContent>
          <Accordion type="multiple" defaultValue={["plan"]} className="w-full">
            {/* Lesson Plan */}
            <AccordionItem value="plan">
              <div className="flex items-center justify-between border-b pr-4">
                <AccordionTrigger className="hover:no-underline">{t("lessonPlan")}</AccordionTrigger>
                <Button variant="ghost" size="sm" onClick={() => openEdit("lesson_plan")}><Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit</Button>
              </div>
              <AccordionContent className="pt-4">
                <LessonSection title={t("lessonPlan")} content={lesson.lesson_plan ?? ""} subject={lesson.subject ?? undefined} topic={lesson.topic ?? undefined} lessonMetadata={lesson} />
              </AccordionContent>
            </AccordionItem>

            {/* Worksheet */}
            <AccordionItem value="ws">
              <div className="flex items-center justify-between border-b pr-4">
                <AccordionTrigger className="hover:no-underline">{t("worksheet")}</AccordionTrigger>
                <Button variant="ghost" size="sm" onClick={() => openEdit("worksheet")}><Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit</Button>
              </div>
              <AccordionContent className="pt-4">
                <LessonSection title={t("worksheet")} content={lesson.worksheet ?? ""} subject={lesson.subject ?? undefined} topic={lesson.topic ?? undefined} lessonMetadata={lesson} />
              </AccordionContent>
            </AccordionItem>

            {/* Quiz */}
            <AccordionItem value="quiz">
              <div className="flex items-center justify-between border-b pr-4">
                <AccordionTrigger className="hover:no-underline">{t("quiz")}</AccordionTrigger>
                <Button variant="ghost" size="sm" onClick={() => openEdit("quiz")}><Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit</Button>
              </div>
              <AccordionContent className="pt-4">
                <LessonSection title={t("quiz")} content={lesson.quiz ?? ""} subject={lesson.subject ?? undefined} topic={lesson.topic ?? undefined} lessonMetadata={lesson} />
              </AccordionContent>
            </AccordionItem>

            {/* Answer Key */}
            <AccordionItem value="ans">
              <div className="flex items-center justify-between border-b pr-4">
                <AccordionTrigger className="hover:no-underline">{t("answerKey")}</AccordionTrigger>
                <Button variant="ghost" size="sm" onClick={() => openEdit("answer_key")}><Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit</Button>
              </div>
              <AccordionContent className="pt-4">
                <LessonSection title={t("answerKey")} content={lesson.answer_key ?? ""} subject={lesson.subject ?? undefined} topic={lesson.topic ?? undefined} lessonMetadata={lesson} />
              </AccordionContent>
            </AccordionItem>

            {/* AI Rubric */}
            <AccordionItem value="rubric">
              <div className="flex items-center justify-between border-b pr-4">
                <AccordionTrigger className="hover:no-underline">{t("rubric")}</AccordionTrigger>
                {lesson.rubric && (
                  <Button variant="ghost" size="sm" onClick={() => openEdit("rubric")}><Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit</Button>
                )}
              </div>
              <AccordionContent className="pt-4">
                {lesson.rubric ? (
                  <LessonSection title={t("rubric")} content={lesson.rubric} subject={lesson.subject ?? undefined} topic={lesson.topic ?? undefined} lessonMetadata={lesson} />
                ) : (
                  <div className="p-6 rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-center space-y-4">
                    <span className="text-3xl">⚖️</span>
                    <div>
                      <h4 className="font-semibold text-sm">No Rubric Generated Yet</h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm">Generate a customized grading matrix based on your objectives and topic.</p>
                    </div>
                    
                    <div className="flex flex-col gap-2 w-full max-w-xs">
                      <Label htmlFor="rubric-type" className="text-left text-xs">Assessment Type</Label>
                      <Input
                        id="rubric-type"
                        value={rubricAssessmentType}
                        onChange={(e) => setRubricAssessmentType(e.target.value)}
                        placeholder="e.g. Essay, Quiz, Project, Lab"
                        className="h-8 text-xs"
                      />
                      <Button onClick={handleGenerateRubric} disabled={isGeneratingRubric} className="h-9 gap-2">
                        <Sparkles className="h-4 w-4" /> {isGeneratingRubric ? "Generating Rubric..." : "Generate Rubric with AI"}
                      </Button>
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Homework */}
            <AccordionItem value="homework">
              <div className="flex items-center justify-between border-b pr-4">
                <AccordionTrigger className="hover:no-underline">{t("homework")}</AccordionTrigger>
                {lesson.homework && (
                  <Button variant="ghost" size="sm" onClick={() => openEdit("homework")}><Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit</Button>
                )}
              </div>
              <AccordionContent className="pt-4">
                {lesson.homework ? (
                  <LessonSection title={t("homework")} content={lesson.homework} subject={lesson.subject ?? undefined} topic={lesson.topic ?? undefined} lessonMetadata={lesson} showAnswerKey={true} />
                ) : (
                  <div className="p-6 rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-center space-y-4">
                    <span className="text-3xl">📝</span>
                    <div>
                      <h4 className="font-semibold text-sm">No Homework Generated Yet</h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm">Generate homework worksheets, question arrays, and answer keys instantly.</p>
                    </div>
                    <Button onClick={handleGenerateHomework} disabled={isGeneratingHomework} className="gap-2">
                      <Sparkles className="h-4 w-4" /> {isGeneratingHomework ? "Generating Homework..." : "Generate Homework with AI"}
                    </Button>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>



            {/* Teaching Suggestions */}
            <AccordionItem value="teaching_suggestions">
              <div className="flex items-center justify-between border-b pr-4">
                <AccordionTrigger className="hover:no-underline">Teaching Suggestions</AccordionTrigger>
                {lesson.teaching_suggestions && (
                  <Button variant="ghost" size="sm" onClick={() => openEdit("teaching_suggestions")}><Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit</Button>
                )}
              </div>
              <AccordionContent className="pt-4">
                {lesson.teaching_suggestions ? (
                  <LessonSection title="Teaching Suggestions" content={lesson.teaching_suggestions} subject={lesson.subject ?? undefined} topic={lesson.topic ?? undefined} lessonMetadata={lesson} />
                ) : (
                  <div className="p-6 rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-center space-y-4">
                    <span className="text-3xl">💡</span>
                    <div>
                      <h4 className="font-semibold text-sm">No Teaching Suggestions</h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm">Generate classroom activities, teaching strategies, and student engagement tips.</p>
                    </div>
                    <Button onClick={handleGenerateSuggestions} disabled={isGeneratingSuggestions} size="sm">
                      {isGeneratingSuggestions ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                      Generate Teaching Suggestions
                    </Button>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Manual Section Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Section: {editField ? t(String(editField).replace("_", "")) || String(editField) : ""}</DialogTitle>
            <DialogDescription>Manually customize content. Saving will create a new version snapshot.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={16}
              className="font-mono text-xs leading-relaxed"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={busy}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={isVersionsOpen} onOpenChange={setIsVersionsOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("versions")}</DialogTitle>
            <DialogDescription>{t("selectVersion")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {versions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">{t("noVersions")}</p>
            ) : (
              versions.map((ver) => (
                <div key={ver.id} className="flex items-center justify-between p-3 rounded-lg border bg-card/60 hover:bg-card/90 transition text-xs">
                  <div>
                    <span className="font-semibold text-primary">Version #{ver.version_number}</span>
                    <p className="text-muted-foreground text-[10px] mt-0.5">{new Date(ver.created_at).toLocaleString()}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleRestoreVersion(ver.id)} disabled={busy}>
                    {t("restore")}
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Duplication & Selective Regeneration Dialog */}
      <Dialog open={isDuplicateOpen} onOpenChange={setIsDuplicateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("duplicationDialogTitle")}</DialogTitle>
            <DialogDescription>Duplicate this lesson plan and selectively regenerate modified properties.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>{t("subject")}</Label>
                <Select value={duplicateForm.subject} onValueChange={(val) => setDuplicateForm(f => ({ ...f, subject: val }))}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("grade")}</Label>
                <Select value={duplicateForm.grade} onValueChange={(val) => setDuplicateForm(f => ({ ...f, grade: val }))}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{GRADES.map((g) => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>{t("topic")}</Label>
              <Input
                value={duplicateForm.topic}
                onChange={(e) => setDuplicateForm(f => ({ ...f, topic: e.target.value }))}
                className="h-8"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>{t("duration")}</Label>
                <Select value={duplicateForm.duration} onValueChange={(val) => setDuplicateForm(f => ({ ...f, duration: val }))}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{DURATIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("language")}</Label>
                <Select value={duplicateForm.language} onValueChange={(val) => setDuplicateForm(f => ({ ...f, language: val }))}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>{t("learningObjectives")}</Label>
              <Textarea
                value={duplicateForm.objectives}
                onChange={(e) => setDuplicateForm(f => ({ ...f, objectives: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDuplicateOpen(false)}>Cancel</Button>
            <Button onClick={handleDuplicate} disabled={busy} className="gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Duplicate & Adapt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Assignment Dialog */}
      <Dialog open={isAssignmentOpen} onOpenChange={setIsAssignmentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Student Assignment</DialogTitle>
            <DialogDescription>
              Generate a unique assignment link for your students. They can read the lesson materials and complete the interactive quiz.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="asgn-title">Assignment Title</Label>
              <Input
                id="asgn-title"
                value={assignmentTitle}
                onChange={(e) => setAssignmentTitle(e.target.value)}
                placeholder="e.g. Math Homework - Fractions"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asgn-due">Due Date (Optional)</Label>
              <Input
                id="asgn-due"
                type="date"
                value={assignmentDueDate}
                onChange={(e) => setAssignmentDueDate(e.target.value)}
              />
            </div>

            {createdAssignmentLink && (
              <div className="space-y-2 mt-4 pt-2 border-t border-border">
                <Label className="text-primary font-bold">Copy Sharing Link</Label>
                <div className="flex items-center gap-1 rounded bg-secondary p-1">
                  <span className="flex-1 truncate pl-1 select-all font-mono text-[11px]">{createdAssignmentLink}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copyCreatedLink}>
                    {copiedLink ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsAssignmentOpen(false)}>Cancel</Button>
            {!createdAssignmentLink ? (
              <Button onClick={handleCreateAssignment} disabled={isCreatingAssignment}>
                {isCreatingAssignment ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Generate Assignment Link
              </Button>
            ) : (
              <Button onClick={copyCreatedLink} className="gap-1.5">
                {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copy Link
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Smart Regeneration Dialog */}
      <Dialog open={isSmartRegenOpen} onOpenChange={setIsSmartRegenOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <RefreshCw className="h-5 w-5 text-primary" />
              Smart AI Regeneration
            </DialogTitle>
            <DialogDescription>
              Regenerate the entire lesson kit, or target only a specific section while keeping the rest identical.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="regen-target">Section to Regenerate</Label>
              <Select 
                value={smartRegenSection} 
                onValueChange={(val: any) => setSmartRegenSection(val)}
              >
                <SelectTrigger id="regen-target" className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whole">Whole Lesson Kit (Full Generation)</SelectItem>
                  <SelectItem value="lesson_plan">Only Lesson Plan (Activities)</SelectItem>
                  <SelectItem value="worksheet">Only Worksheet</SelectItem>
                  <SelectItem value="quiz">Only Practice Quiz</SelectItem>
                  <SelectItem value="homework">Only Homework</SelectItem>
                  <SelectItem value="answer_key">Only Answer Key</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="regen-prompt">Instructions for the AI (Changes needed)</Label>
              <Textarea
                id="regen-prompt"
                rows={3}
                placeholder="e.g. Make it more interactive; Add a group discussion task; Make the quiz harder; Translate answers..."
                value={smartRegenInstruction}
                onChange={(e) => setSmartRegenInstruction(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsSmartRegenOpen(false)}>Cancel</Button>
            <Button 
              onClick={async () => {
                if (smartRegenSection === "whole") {
                  setIsSmartRegenOpen(false);
                  await regenerate();
                } else {
                  await handleSmartRegenerate();
                }
              }} 
              disabled={isRegeneratingSection || busy || !smartRegenInstruction.trim()}
            >
              {isRegeneratingSection ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Start Regeneration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
