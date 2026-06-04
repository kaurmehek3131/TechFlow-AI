import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { 
  Clipboard, Check, Share2, MessageSquare, Calendar, 
  Clock, Award, Loader2, Edit3, UserCheck, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/class-progress")({
  component: ClassProgressPortal,
});

type AssignmentItem = {
  id: string;
  lesson_id: string;
  title: string;
  due_date: string | null;
  created_at: string;
  submissions_count?: number;
  lessons: {
    title: string;
    subject: string | null;
  } | null;
};

type SubmissionItem = {
  id: string;
  assignment_id: string;
  student_id: string;
  submitted_at: string;
  answers: string;
  score: number | null;
  status: string;
  feedback: string | null;
  assignments: {
    id: string;
    title: string;
  } | null;
  profiles: {
    full_name: string | null;
    email?: string | null;
  } | null;
};

function ClassProgressPortal() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"assignments" | "submissions">("assignments");
  
  // Data lists
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  
  // UI states
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [gradingSubmission, setGradingSubmission] = useState<SubmissionItem | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [savingGrade, setSavingGrade] = useState(false);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch assignments with submissions counts
      const { data: assignmentsData, error: assignmentsErr } = await supabase
        .from("assignments")
        .select(`
          id,
          lesson_id,
          title,
          due_date,
          created_at,
          lessons (
            title,
            subject
          )
        `)
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });

      if (assignmentsErr) throw assignmentsErr;

      // Get submission counts for these assignments
      const { data: subCounts } = await supabase
        .from("submissions")
        .select("assignment_id");

      const countMap: Record<string, number> = {};
      (subCounts || []).forEach(s => {
        countMap[s.assignment_id] = (countMap[s.assignment_id] || 0) + 1;
      });

      const formattedAssignments = (assignmentsData || []).map(a => ({
        id: a.id,
        lesson_id: a.lesson_id,
        title: a.title,
        due_date: a.due_date,
        created_at: a.created_at,
        submissions_count: countMap[a.id] || 0,
        lessons: Array.isArray(a.lessons) ? a.lessons[0] : a.lessons,
      })) as AssignmentItem[];

      setAssignments(formattedAssignments);

      // 2. Fetch submissions for this teacher's assignments
      let submissionsData = null;
      
      const { data: subDataWithEmail, error: submissionsErr } = await supabase
        .from("submissions")
        .select(`
          id,
          assignment_id,
          student_id,
          submitted_at,
          answers,
          score,
          status,
          feedback,
          assignments!inner (
            id,
            title,
            teacher_id
          ),
          profiles (
            full_name,
            email
          )
        `)
        .eq("assignments.teacher_id", user.id)
        .order("submitted_at", { ascending: false });

      if (submissionsErr) {
        console.warn("Failed to fetch submissions with email, trying fallback query:", submissionsErr);
        const { data: subDataFallback, error: fallbackErr } = await supabase
          .from("submissions")
          .select(`
            id,
            assignment_id,
            student_id,
            submitted_at,
            answers,
            score,
            status,
            feedback,
            assignments!inner (
              id,
              title,
              teacher_id
            ),
            profiles (
              full_name
            )
          `)
          .eq("assignments.teacher_id", user.id)
          .order("submitted_at", { ascending: false });

        if (fallbackErr) throw fallbackErr;
        submissionsData = subDataFallback;
      } else {
        submissionsData = subDataWithEmail;
      }

      const formattedSubmissions = (submissionsData || []).map(s => ({
        id: s.id,
        assignment_id: s.assignment_id,
        student_id: s.student_id,
        submitted_at: s.submitted_at,
        answers: s.answers,
        score: s.score,
        status: s.status,
        feedback: s.feedback,
        assignments: Array.isArray(s.assignments) ? s.assignments[0] : s.assignments,
        profiles: Array.isArray(s.profiles) ? s.profiles[0] : s.profiles,
      })) as SubmissionItem[];

      setSubmissions(formattedSubmissions);
    } catch (err) {
      console.error("Error loading teacher class data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const copyAssignmentLink = (assignmentId: string) => {
    const link = `${window.location.origin}/assignment/${assignmentId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(assignmentId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deleteAssignment = async (assignmentId: string) => {
    if (!confirm("Are you sure you want to delete this assignment? Students will no longer be able to submit solutions.")) return;
    try {
      const { error } = await supabase
        .from("assignments")
        .delete()
        .eq("id", assignmentId);
      if (error) throw error;
      setAssignments(assignments.filter(a => a.id !== assignmentId));
      setSubmissions(submissions.filter(s => s.assignment_id !== assignmentId));
    } catch (err) {
      console.error("Error deleting assignment:", err);
    }
  };

  const handleOpenGrading = (sub: SubmissionItem) => {
    setGradingSubmission(sub);
    setFeedbackText(sub.feedback || "");
  };

  const handleSaveGrade = async () => {
    if (!gradingSubmission) return;
    setSavingGrade(true);
    try {
      const { error } = await supabase
        .from("submissions")
        .update({
          feedback: feedbackText,
          status: "graded"
        })
        .eq("id", gradingSubmission.id);

      if (error) throw error;

      // Update locally
      setSubmissions(submissions.map(s => 
        s.id === gradingSubmission.id 
          ? { ...s, feedback: feedbackText, status: "graded" }
          : s
      ));

      setGradingSubmission(null);
    } catch (err) {
      console.error("Error updating feedback:", err);
    } finally {
      setSavingGrade(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading Class Progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("classProgress")}</h1>
        <p className="text-muted-foreground">Manage active study links, review student quiz submissions, and issue feedback.</p>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-border">
        <button 
          onClick={() => setActiveTab("assignments")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-all ${
            activeTab === "assignments" 
              ? "border-primary text-primary" 
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Active Assignments ({assignments.length})
        </button>
        <button 
          onClick={() => setActiveTab("submissions")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-all ${
            activeTab === "submissions" 
              ? "border-primary text-primary" 
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("submissions")} ({submissions.length})
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "assignments" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.length === 0 ? (
            <Card className="col-span-full border-dashed p-10 text-center border-border bg-card/20">
              <CardDescription>No assignments created yet. Open any lesson from your library and click "Create Assignment".</CardDescription>
            </Card>
          ) : (
            assignments.map((item) => (
              <Card key={item.id} className="border-border bg-card/45 backdrop-blur-sm flex flex-col justify-between">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold line-clamp-1">{item.title}</CardTitle>
                  <CardDescription className="text-xs">Subject: {item.lessons?.subject || "General"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Created: {new Date(item.created_at).toLocaleDateString()}</span>
                    {item.due_date && (
                      <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Due: {new Date(item.due_date).toLocaleDateString()}</span>
                    )}
                    <span className="flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5" /> Submissions: {item.submissions_count}</span>
                  </div>

                  {/* Link field */}
                  <div className="flex items-center gap-1 rounded bg-secondary p-1 text-xs">
                    <span className="flex-1 truncate pl-1 select-all">{`${window.location.origin}/assignment/${item.id}`}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyAssignmentLink(item.id)}>
                      {copiedId === item.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Clipboard className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </CardContent>
                <div className="p-6 pt-0 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => copyAssignmentLink(item.id)}>
                    <Share2 className="h-3.5 w-3.5" /> Share URL
                  </Button>
                  <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-9 w-9 border border-border/40" onClick={() => deleteAssignment(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      ) : (
        <Card className="border-border bg-card/45 backdrop-blur-sm">
          <CardContent className="p-0">
            {submissions.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">No submissions found. Students will see assignment links you share and submit solutions.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="p-4 font-semibold text-muted-foreground">Student</th>
                      <th className="p-4 font-semibold text-muted-foreground">Assignment</th>
                      <th className="p-4 font-semibold text-muted-foreground text-center">Score</th>
                      <th className="p-4 font-semibold text-muted-foreground">Submitted At</th>
                      <th className="p-4 font-semibold text-muted-foreground">Status</th>
                      <th className="p-4 font-semibold text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub) => (
                      <tr key={sub.id} className="border-b border-border/50 hover:bg-card/25 transition-colors">
                        <td className="p-4 leading-tight">
                          <div className="font-semibold text-foreground">{sub.profiles?.full_name || "Student"}</div>
                          {sub.profiles?.email && <div className="text-xs text-muted-foreground">{sub.profiles?.email}</div>}
                        </td>
                        <td className="p-4 font-medium text-foreground line-clamp-1 max-w-[200px] mt-2">{sub.assignments?.title || "—"}</td>
                        <td className="p-4 text-center font-bold text-foreground">
                          {sub.score !== null ? `${sub.score}%` : "—"}
                        </td>
                        <td className="p-4 text-muted-foreground text-xs">{new Date(sub.submitted_at).toLocaleString()}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            sub.status === "graded" 
                              ? "bg-green-500/10 text-green-500" 
                              : "bg-amber-500/10 text-amber-500"
                          }`}>
                            {sub.status === "graded" ? "Graded" : "Completed"}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <Button size="sm" variant="ghost" className="gap-1 text-primary hover:text-primary hover:bg-primary/5" onClick={() => handleOpenGrading(sub)}>
                            <Edit3 className="h-3.5 w-3.5" />
                            {sub.status === "graded" ? "View/Edit" : t("gradeAssignment")}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Grading / Feedback Dialog */}
      <Dialog open={gradingSubmission !== null} onOpenChange={(open) => !open && setGradingSubmission(null)}>
        <DialogContent className="sm:max-w-[500px] border-border bg-card">
          {gradingSubmission && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Grade & Feedback
                </DialogTitle>
                <DialogDescription>
                  Submit feedback for {gradingSubmission.profiles?.full_name || gradingSubmission.profiles?.email || ""}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="text-sm border rounded-lg p-3 bg-secondary/30 space-y-1">
                  <div><span className="font-semibold text-muted-foreground">Assignment:</span> <span className="font-medium">{gradingSubmission.assignments?.title || "—"}</span></div>
                  <div><span className="font-semibold text-muted-foreground">Quiz Score:</span> <span className="font-bold text-primary">{gradingSubmission.score !== null ? `${gradingSubmission.score}%` : "No Quiz"}</span></div>
                  <div className="pt-2"><span className="font-semibold text-muted-foreground block mb-1">Student Answers:</span> 
                    <pre className="text-xs bg-black/10 dark:bg-black/35 rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-40 leading-relaxed font-mono">
                      {gradingSubmission.answers ? JSON.stringify(JSON.parse(gradingSubmission.answers), null, 2) : ""}
                    </pre>
                  </div>
                </div>
                <div className="space-y-1">
                  <label htmlFor="feedback-text" className="text-xs font-semibold text-foreground">Teacher Guidance & Feedback</label>
                  <textarea 
                    id="feedback-text"
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Good work! Focus on improving in section B next time..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="ghost" onClick={() => setGradingSubmission(null)}>Cancel</Button>
                <Button onClick={handleSaveGrade} disabled={savingGrade} className="gap-1">
                  {savingGrade ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Grade & Feedback"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
