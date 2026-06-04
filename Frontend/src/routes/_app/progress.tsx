import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { 
  Trophy, Flame, BookOpen, Award, Sparkles, Calendar, 
  Loader2, CheckCircle2, ChevronRight, ShieldAlert, Lock
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { calculateStreakAndPoints, checkAndAwardBadges } from "@/lib/achievements";
import { generateAIRecommendations, generatePersonalizedStudyPlan } from "@/lib/webhook";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/progress")({
  component: StudentProgressDashboard,
});

type ProgressItem = {
  id: string;
  completed_at: string;
  quiz_score: number | null;
  quiz_total: number | null;
  lessons: {
    subject: string | null;
    title: string;
  } | null;
};

type LeaderboardEntry = {
  student_id: string;
  name: string;
  email: string;
  points: number;
  completedCount: number;
};

function StudentProgressDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Progress States
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [avgQuizScore, setAvgQuizScore] = useState(0);
  const [unlockedBadges, setUnlockedBadges] = useState<string[]>([]);
  const [quizMasterCount, setQuizMasterCount] = useState(0);
  const [maxQuizScore, setMaxQuizScore] = useState(0);
  const [hasWeeklyActivity, setHasWeeklyActivity] = useState(false);
  
  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  
  // AI helpers States
  const [aiRec, setAiRec] = useState<string | null>(null);
  const [studyPlan, setStudyPlan] = useState<string | null>(null);
  const [generatingRec, setGeneratingRec] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const loadDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Run badges engine to make sure they are up-to-date
      await checkAndAwardBadges(user.id);

      // 2. Fetch progress with joined lessons info
      const { data: progressData, error: progressErr } = await supabase
        .from("student_progress")
        .select(`
          id,
          completed_at,
          quiz_score,
          quiz_total,
          lessons (
            subject,
            title
          )
        `)
        .eq("student_id", user.id)
        .order("completed_at", { ascending: false });

      if (progressErr) throw progressErr;

      const typedProgress = (progressData || []).map(p => ({
        id: p.id,
        completed_at: p.completed_at,
        quiz_score: p.quiz_score,
        quiz_total: p.quiz_total,
        lessons: Array.isArray(p.lessons) ? p.lessons[0] : p.lessons,
      })) as ProgressItem[];

      setProgress(typedProgress);

      // Calculate streak & points
      const stats = await calculateStreakAndPoints(user.id);
      setPoints(stats.points);
      setStreak(stats.streak);
      setCompletedCount(stats.completedCount);
 
      // Calculate Average Quiz Score, Quiz Master count, Perfect Score max, and Weekly Activity
      const quizzes = typedProgress.filter(p => p.quiz_score !== null && p.quiz_total !== null && p.quiz_total > 0);
      if (quizzes.length > 0) {
        const totalPct = quizzes.reduce((sum, q) => sum + ((q.quiz_score || 0) / (q.quiz_total || 1)) * 100, 0);
        setAvgQuizScore(Math.round(totalPct / quizzes.length));
      } else {
        setAvgQuizScore(0);
      }

      let qmCount = 0;
      let maxScore = 0;
      let weeklyAct = false;
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      typedProgress.forEach(p => {
        if (p.quiz_score !== null && p.quiz_total !== null && p.quiz_total > 0) {
          const scorePct = (p.quiz_score / p.quiz_total) * 100;
          if (scorePct >= 80) qmCount++;
          if (scorePct > maxScore) maxScore = Math.round(scorePct);
        }
        if (new Date(p.completed_at) >= sevenDaysAgo) {
          weeklyAct = true;
        }
      });

      setQuizMasterCount(qmCount);
      setMaxQuizScore(maxScore);
      setHasWeeklyActivity(weeklyAct);

      // 3. Fetch unlocked badges
      const { data: badgesData } = await supabase
        .from("badges")
        .select("badge_type")
        .eq("student_id", user.id);
      setUnlockedBadges((badgesData || []).map(b => b.badge_type));

      // 4. Fetch AI Recommendations and Study Plans
      const { data: recData } = await supabase
        .from("learning_recommendations")
        .select("recommendations")
        .eq("student_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recData) setAiRec(recData.recommendations);

      const { data: planData } = await supabase
        .from("study_plans")
        .select("schedule")
        .eq("student_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (planData) setStudyPlan(planData.schedule);

      // 5. Build leaderboard
      // Fetch all progress data to sum points
      let allProgress = null;
      const { data: progressWithEmail, error: progressErrWithEmail } = await supabase
        .from("student_progress")
        .select(`
          student_id,
          quiz_score,
          quiz_total,
          profiles (
            full_name,
            email
          )
        `);

      if (progressErrWithEmail) {
        console.warn("Leaderboard with email failed, trying fallback query:", progressErrWithEmail);
        const { data: progressFallback, error: progressErrFallback } = await supabase
          .from("student_progress")
          .select(`
            student_id,
            quiz_score,
            quiz_total,
            profiles (
              full_name
            )
          `);

        if (progressErrFallback) throw progressErrFallback;
        allProgress = progressFallback;
      } else {
        allProgress = progressWithEmail;
      }

      const scoreMap: Record<string, { name: string; email: string; points: number; completedCount: number }> = {};
      
      (allProgress || []).forEach(p => {
        const studentId = p.student_id;
        const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
        const name = profile?.full_name || profile?.email?.split("@")[0] || "Student";
        const email = profile?.email || "";

        if (!scoreMap[studentId]) {
          scoreMap[studentId] = { name, email, points: 0, completedCount: 0 };
        }

        scoreMap[studentId].completedCount += 1;
        scoreMap[studentId].points += 10; // 10 points per completion
        if (p.quiz_score !== null && p.quiz_total !== null && p.quiz_total > 0) {
          scoreMap[studentId].points += Math.round((p.quiz_score / p.quiz_total) * 100);
        }
      });

      const board: LeaderboardEntry[] = Object.entries(scoreMap).map(([studentId, data]) => ({
        student_id: studentId,
        ...data
      })).sort((a, b) => b.points - a.points);

      setLeaderboard(board);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const handleGenerateRecommendations = async () => {
    if (!user) return;
    setGeneratingRec(true);
    try {
      const log = progress.map(p => 
        `- Subject: ${p.lessons?.subject || 'General'}, Lesson: ${p.lessons?.title || 'Unknown'}, Quiz Score: ${p.quiz_score !== null ? `${p.quiz_score}/${p.quiz_total} (${Math.round((p.quiz_score / (p.quiz_total || 1)) * 100)}%)` : 'No Quiz'}`
      ).join('\n');
      
      const newRec = await generateAIRecommendations(log);
      
      // Upsert recommendation
      const { error } = await supabase
        .from("learning_recommendations")
        .insert({
          student_id: user.id,
          recommendations: newRec
        });

      if (error) throw error;
      setAiRec(newRec);
    } catch (err) {
      console.error("Error generating recommendations:", err);
    } finally {
      setGeneratingRec(false);
    }
  };

  const handleGenerateStudyPlan = async () => {
    if (!user) return;
    setGeneratingPlan(true);
    try {
      const log = progress.map(p => 
        `- Subject: ${p.lessons?.subject || 'General'}, Lesson: ${p.lessons?.title || 'Unknown'}, Quiz Score: ${p.quiz_score !== null ? `${p.quiz_score}/${p.quiz_total} (${Math.round((p.quiz_score / (p.quiz_total || 1)) * 100)}%)` : 'No Quiz'}`
      ).join('\n');

      const newPlan = await generatePersonalizedStudyPlan(log);

      // Save to database
      const { error } = await supabase
        .from("study_plans")
        .insert({
          student_id: user.id,
          schedule: newPlan
        });

      if (error) throw error;
      setStudyPlan(newPlan);
    } catch (err) {
      console.error("Error generating study plan:", err);
    } finally {
      setGeneratingPlan(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your learning profile...</p>
        </div>
      </div>
    );
  }

  // Pre-process Subject Mastery
  const subjectScores: Record<string, { totalPct: number; count: number }> = {};
  progress.forEach(p => {
    const sub = p.lessons?.subject || "General";
    if (p.quiz_score !== null && p.quiz_total !== null && p.quiz_total > 0) {
      const pct = (p.quiz_score / p.quiz_total) * 100;
      if (!subjectScores[sub]) {
        subjectScores[sub] = { totalPct: 0, count: 0 };
      }
      subjectScores[sub].totalPct += pct;
      subjectScores[sub].count += 1;
    }
  });

  const chartData = Object.entries(subjectScores).map(([subject, data]) => ({
    subject,
    score: Math.round(data.totalPct / data.count)
  }));

  const badgesList = [
    { type: "first_lesson", name: "First Steps", desc: "Marked your first lesson complete", icon: "🌐", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
    { type: "quiz_master", name: "Quiz Master", desc: "Scored 80%+ on at least 3 quizzes", icon: "🎓", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
    { type: "weekly_learner", name: "Weekly Learner", desc: "Studied at least once this week", icon: "📅", color: "bg-green-500/10 text-green-500 border-green-500/20" },
    { type: "perfect_score", name: "Perfect Score", desc: "Scored 100% on any practice quiz", icon: "💯", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
    { type: "consistent_learner", name: "Consistent Learner", desc: "Maintained a 3+ day learning streak", icon: "🔥", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("myProgress")}</h1>
        <p className="text-muted-foreground">Monitor your streaks, points, achievements, and customized AI learning guides.</p>
      </div>

      {/* Onboarding Callout when progress is empty */}
      {progress.length === 0 && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-accent/5 to-background hover:border-primary/30 transition-all duration-300 shadow-md">
          <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex gap-4 items-center flex-col md:flex-row text-center md:text-left">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
                <Trophy className="h-6 w-6 text-primary animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-foreground">Kickstart Your Learning Adventure!</h3>
                <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                  You haven't completed any lessons or quizzes yet. Complete quizzes inside your classroom assignments to earn experience points (XP), climb the leaderboard, maintain daily streaks, and unlock achievements.
                </p>
              </div>
            </div>
            <Link to="/explore">
              <Button size="sm" className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]">
                <BookOpen className="h-4 w-4" />
                Browse Lessons Library
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-border bg-card/45 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">{t("streak")}</CardTitle>
            <Flame className="h-4 w-4 text-orange-500 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{streak} {streak === 1 ? "Day" : "Days"}</div>
            <p className="text-xs text-muted-foreground">Keep studying daily to maintain your streak!</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/45 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Completed Lessons</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
            <p className="text-xs text-muted-foreground">Total study materials finished</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/45 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Quiz Average</CardTitle>
            <Award className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgQuizScore}%</div>
            <p className="text-xs text-muted-foreground">Based on quiz submissions</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/45 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">{t("points")}</CardTitle>
            <Trophy className="h-4 w-4 text-amber-500 animate-bounce" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{points} XP</div>
            <p className="text-xs text-muted-foreground">10 XP per lesson + Quiz % scores</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left column (Mastery + Badges) */}
        <div className="space-y-6 md:col-span-2">
          {/* Recharts Mastery Chart */}
          <Card className="border-border bg-card/45 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Subject Mastery</CardTitle>
              <CardDescription>Average quiz performance across different fields of study</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center text-muted-foreground border border-dashed rounded-lg border-border p-6">
                  <Award className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium">No quiz metrics yet</p>
                  <p className="text-xs text-muted-foreground">Complete quizzes in lessons to populate this graph.</p>
                </div>
              ) : isMounted ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="subject" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                        labelStyle={{ fontWeight: "bold", color: "hsl(var(--foreground))" }}
                        formatter={(value) => [`${value}% Score`, "Mastery"]}
                      />
                      <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={45} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">Loading chart...</div>
              )}
            </CardContent>
          </Card>

          {/* Badges Checklist */}
          <Card className="border-border bg-card/45 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t("achievements")}</CardTitle>
              <CardDescription>Earn rewards and badges by completing goals and staying consistent.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {badgesList.map((badge) => {
                  const isUnlocked = unlockedBadges.includes(badge.type);
                  
                  // Calculate progress values for each badge
                  let currentVal = 0;
                  let targetVal = 1;
                  let progressPct = 0;
                  let statusText = "";

                  if (badge.type === "first_lesson") {
                    currentVal = completedCount;
                    targetVal = 1;
                    progressPct = completedCount >= 1 ? 100 : 0;
                    statusText = `${Math.min(currentVal, targetVal)} / ${targetVal} Lesson`;
                  } else if (badge.type === "quiz_master") {
                    currentVal = quizMasterCount;
                    targetVal = 3;
                    progressPct = Math.min(Math.round((quizMasterCount / 3) * 100), 100);
                    statusText = `${Math.min(currentVal, targetVal)} / ${targetVal} Quizzes`;
                  } else if (badge.type === "weekly_learner") {
                    currentVal = hasWeeklyActivity ? 1 : 0;
                    targetVal = 1;
                    progressPct = hasWeeklyActivity ? 100 : 0;
                    statusText = hasWeeklyActivity ? "1 / 1 Completed" : "0 / 1 Complete";
                  } else if (badge.type === "perfect_score") {
                    currentVal = maxQuizScore;
                    targetVal = 100;
                    progressPct = maxQuizScore;
                    statusText = `${currentVal}% / 100%`;
                  } else if (badge.type === "consistent_learner") {
                    currentVal = streak;
                    targetVal = 3;
                    progressPct = Math.min(Math.round((streak / 3) * 100), 100);
                    statusText = `${Math.min(currentVal, targetVal)} / ${targetVal} Days`;
                  }

                  return (
                    <div 
                      key={badge.type} 
                      className={`flex flex-col p-4 rounded-xl border transition-all duration-300 relative ${
                        isUnlocked 
                          ? `${badge.color} border-primary/20 shadow-md translate-y-0 scale-100` 
                          : "bg-card/45 border-border/50 text-muted-foreground"
                      }`}
                    >
                      <div className="flex gap-3 items-center">
                        <div className={`text-3xl filter drop-shadow ${isUnlocked ? "" : "opacity-60 grayscale"}`}>
                          {badge.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
                            {badge.name}
                            {isUnlocked ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 fill-green-500/10 shrink-0" />
                            ) : (
                              <Lock className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                            )}
                          </h4>
                          <p className="text-xs text-muted-foreground leading-normal mt-0.5">{badge.desc}</p>
                        </div>
                      </div>
                      
                      {/* Interactive Progress Bar */}
                      <div className="mt-3.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-medium">
                          <span>{isUnlocked ? "Unlocked" : "Progress"}</span>
                          <span className={isUnlocked ? "text-primary font-bold animate-pulse" : ""}>{statusText}</span>
                        </div>
                        <Progress value={progressPct} className="h-1.5 bg-secondary" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column (Leaderboard) */}
        <div className="space-y-6">
          <Card className="border-border bg-card/45 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t("leaderboard")}</CardTitle>
              <CardDescription>Top students based on study activity and quiz mastery</CardDescription>
            </CardHeader>
            <CardContent className="px-2">
              {leaderboard.length === 0 ? (
                <div className="text-center text-muted-foreground py-6">No entries yet.</div>
              ) : (
                <div className="space-y-1">
                  {leaderboard.slice(0, 10).map((entry, index) => {
                    const isSelf = entry.student_id === user.id;
                    return (
                      <div 
                        key={entry.student_id} 
                        className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                          isSelf 
                            ? "bg-primary/10 border border-primary/20" 
                            : "hover:bg-card/30"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            index === 0 ? "bg-amber-500 text-amber-950" :
                            index === 1 ? "bg-slate-400 text-slate-950" :
                            index === 2 ? "bg-amber-700 text-amber-50" :
                            "bg-secondary text-secondary-foreground"
                          }`}>
                            {index + 1}
                          </span>
                          <div className="leading-tight">
                            <div className="text-sm font-semibold flex items-center gap-1.5">
                              {entry.name}
                              {isSelf && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">You</span>}
                            </div>
                            <span className="text-[11px] text-muted-foreground">{entry.completedCount} lessons</span>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-foreground">{entry.points} XP</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Recommendation Center & Study Plan */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-border bg-card/45 backdrop-blur-sm flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {t("aiRecommendations")}
              </CardTitle>
            </div>
            <CardDescription>Get personalized learning topics and revision summaries tailored to your score trends.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            {aiRec ? (
              <div className="prose prose-sm dark:prose-invert max-w-none border border-border/40 rounded-xl bg-card/25 p-4 overflow-y-auto max-h-72 leading-relaxed text-foreground/90 whitespace-pre-line text-sm">
                {aiRec}
              </div>
            ) : (
              <div className="flex h-36 flex-col items-center justify-center border border-dashed rounded-xl border-border/80 bg-card/10 text-muted-foreground p-4">
                <Sparkles className="h-6 w-6 text-muted-foreground/40 mb-1" />
                <p className="text-xs text-center">No recommendations loaded. Click below to request AI assessment.</p>
              </div>
            )}
          </CardContent>
          <div className="p-6 pt-0 mt-auto">
            <Button 
              className="w-full flex items-center justify-center gap-1.5" 
              onClick={handleGenerateRecommendations} 
              disabled={generatingRec || progress.length === 0}
            >
              {generatingRec ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t("generateRecommendations")}
                </>
              )}
            </Button>
            {progress.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center mt-2">
                * You need to study at least one lesson first.
              </p>
            )}
          </div>
        </Card>

        <Card className="border-border bg-card/45 backdrop-blur-sm flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {t("studyPlan")}
              </CardTitle>
            </div>
            <CardDescription>Generate an interactive weekly study schedule tailored to balance your weaker subjects.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            {studyPlan ? (
              <div className="prose prose-sm dark:prose-invert max-w-none border border-border/40 rounded-xl bg-card/25 p-4 overflow-y-auto max-h-72 leading-relaxed text-foreground/90 whitespace-pre-line text-sm">
                {studyPlan}
              </div>
            ) : (
              <div className="flex h-36 flex-col items-center justify-center border border-dashed rounded-xl border-border/80 bg-card/10 text-muted-foreground p-4">
                <Calendar className="h-6 w-6 text-muted-foreground/40 mb-1" />
                <p className="text-xs text-center">No plan generated yet. Generate your customized weekly schedule.</p>
              </div>
            )}
          </CardContent>
          <div className="p-6 pt-0 mt-auto">
            <Button 
              className="w-full flex items-center justify-center gap-1.5" 
              onClick={handleGenerateStudyPlan} 
              disabled={generatingPlan || progress.length === 0}
            >
              {generatingPlan ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating Plan...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  {t("generateStudyPlan")}
                </>
              )}
            </Button>
            {progress.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center mt-2">
                * Complete a lesson to analyze and build schedule.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
