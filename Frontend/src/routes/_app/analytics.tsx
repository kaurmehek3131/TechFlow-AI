import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend
} from "recharts";
import { BookOpen, Globe, Eye, Share2, ChartBar, TrendingUp, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/_app/analytics")({
  component: AnalyticsDashboard,
});

type LessonStat = {
  created_at: string;
  subject: string | null;
  grade: string | null;
  is_published: boolean;
  views_count: number;
  shares_count: number;
};

const COLORS = [
  "hsl(var(--primary))",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#06b6d4"
];

function AnalyticsDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState<LessonStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("lessons")
          .select("created_at, subject, grade, is_published, views_count, shares_count")
          .eq("user_id", user.id);
        
        if (error) throw error;
        setStats((data as LessonStat[]) || []);
      } catch (err) {
        console.error("Error loading analytics data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (loading || !isMounted) {
    return <div className="text-muted-foreground text-center py-12">Loading analytics…</div>;
  }

  // Calculate Metrics
  const totalLessons = stats.length;
  const publishedLessons = stats.filter((s) => s.is_published).length;
  const totalViews = stats.reduce((acc, s) => acc + (s.views_count || 0), 0);
  const totalShares = stats.reduce((acc, s) => acc + (s.shares_count || 0), 0);

  // Group by Subject for Pie Chart
  const subjectMap: Record<string, number> = {};
  stats.forEach((s) => {
    const subj = s.subject || "Unknown";
    subjectMap[subj] = (subjectMap[subj] || 0) + 1;
  });
  const subjectData = Object.keys(subjectMap).map((name) => ({
    name,
    value: subjectMap[name]
  })).sort((a, b) => b.value - a.value);

  // Group by Grade for Bar Chart
  const gradeMap: Record<string, number> = {};
  stats.forEach((s) => {
    const gr = s.grade ? `Grade ${s.grade}` : "Other";
    gradeMap[gr] = (gradeMap[gr] || 0) + 1;
  });
  const gradeData = Object.keys(gradeMap).map((name) => ({
    name,
    count: gradeMap[name]
  })).sort((a, b) => {
    // Basic sorting for K-12 grades
    const getNum = (n: string) => {
      const match = n.match(/\d+/);
      if (n.includes("K")) return 0;
      return match ? parseInt(match[0]) : 99;
    };
    return getNum(a.name) - getNum(b.name);
  });

  // Group by Date for Line Chart (Usage Trends - creations over last 30 days)
  const trendMap: Record<string, number> = {};
  // Initialize last 7 days to ensure chart has some points
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    trendMap[dateStr] = 0;
  }

  stats.forEach((s) => {
    const dateObj = new Date(s.created_at);
    // Group in a local date format
    const dateStr = dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (trendMap[dateStr] !== undefined) {
      trendMap[dateStr] += 1;
    } else {
      // Also track older dates up to 30 days if they exist
      const diffTime = Math.abs(new Date().getTime() - dateObj.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 30) {
        trendMap[dateStr] = (trendMap[dateStr] || 0) + 1;
      }
    }
  });

  const trendData = Object.keys(trendMap).map((date) => ({
    date,
    count: trendMap[date]
  }));

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("analytics")}</h1>
        <p className="text-muted-foreground">Monitor your content usage, student engagement, and teaching portfolio insights.</p>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/40 border-border/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("lessonsCreated")}</CardTitle>
            <BookOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLessons}</div>
            <p className="text-xs text-muted-foreground mt-1">Total materials generated</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("lessonsPublished")}</CardTitle>
            <Globe className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{publishedLessons}</div>
            <p className="text-xs text-muted-foreground mt-1">Available in the public library</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("studentViews")}</CardTitle>
            <Eye className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalViews}</div>
            <p className="text-xs text-muted-foreground mt-1">Times public pages were visited</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("lessonsShared")}</CardTitle>
            <Share2 className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalShares}</div>
            <p className="text-xs text-muted-foreground mt-1">Times copy/email was triggered</p>
          </CardContent>
        </Card>
      </div>

      {/* Visualizations Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Usage Trend Line Chart */}
        <Card className="md:col-span-2 bg-card/30 border-border/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> {t("usageTrends")}
            </CardTitle>
            <CardDescription>Lessons generated over the last few days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              {totalLessons === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="date" stroke="currentColor" fontSize={10} className="text-muted-foreground" />
                    <YAxis stroke="currentColor" fontSize={10} className="text-muted-foreground" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        borderColor: "var(--border)",
                        borderRadius: "var(--radius)"
                      }}
                    />
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2.5} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Subject Distribution Pie Chart */}
        <Card className="bg-card/30 border-border/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <ChartBar className="h-4 w-4 text-purple-500" /> {t("subjectDistribution")}
            </CardTitle>
            <CardDescription>Lesson counts categorized by subject area</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full flex flex-col items-center justify-center">
              {totalLessons === 0 ? (
                <div className="text-muted-foreground">No data available</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="80%">
                    <PieChart>
                      <Pie
                        data={subjectData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {subjectData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--background)",
                          borderColor: "var(--border)",
                          borderRadius: "var(--radius)"
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Legend Labels */}
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2 text-xs">
                    {subjectData.slice(0, 5).map((entry, index) => (
                      <div key={entry.name} className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-muted-foreground">{entry.name} ({entry.value})</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Grade Distribution Bar Chart */}
        <Card className="bg-card/30 border-border/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-emerald-500" /> {t("gradeDistribution")}
            </CardTitle>
            <CardDescription>Number of lessons per class level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              {totalLessons === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="name" stroke="currentColor" fontSize={9} className="text-muted-foreground" />
                    <YAxis stroke="currentColor" fontSize={10} className="text-muted-foreground" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        borderColor: "var(--border)",
                        borderRadius: "var(--radius)"
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                      {gradeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
