import { supabase } from "@/integrations/supabase/client";

export type BadgeType = 'first_lesson' | 'quiz_master' | 'weekly_learner' | 'perfect_score' | 'consistent_learner';

export async function awardBadge(studentId: string, badgeType: BadgeType) {
  try {
    // Check if already awarded
    const { data: existing, error: checkError } = await supabase
      .from('badges')
      .select('id')
      .eq('student_id', studentId)
      .eq('badge_type', badgeType)
      .maybeSingle();

    if (checkError) {
      console.error(`Error checking badge ${badgeType}:`, checkError);
      return;
    }

    if (existing) {
      return; // Already unlocked
    }

    // Award badge
    const { error: insertError } = await supabase
      .from('badges')
      .insert({
        student_id: studentId,
        badge_type: badgeType,
      });

    if (insertError) {
      console.error(`Error inserting badge ${badgeType}:`, insertError);
    }
  } catch (err) {
    console.error("awardBadge failed:", err);
  }
}

export async function calculateStreakAndPoints(studentId: string) {
  // Fetch all student progress
  const { data: progress, error } = await supabase
    .from('student_progress')
    .select('completed_at, quiz_score, quiz_total')
    .eq('student_id', studentId)
    .order('completed_at', { ascending: true });

  if (error || !progress) {
    console.error("Error fetching progress for streak/points:", error);
    return { streak: 0, points: 0, completedCount: 0 };
  }

  // Calculate points:
  // - 10 points for each completed lesson (each entry in student_progress)
  // - points equal to quiz percentage score if quiz exists (quiz_score / quiz_total * 100)
  let points = 0;
  progress.forEach(p => {
    points += 10;
    if (p.quiz_score !== null && p.quiz_total !== null && p.quiz_total > 0) {
      const percentage = Math.round((p.quiz_score / p.quiz_total) * 100);
      points += percentage;
    }
  });

  // Calculate streak
  const uniqueDates = Array.from(
    new Set(
      progress.map(p => {
        const d = new Date(p.completed_at);
        // Format to YYYY-MM-DD in student's timezone (using UTC or local)
        return d.toISOString().split('T')[0];
      })
    )
  ).sort();

  let streak = 0;
  if (uniqueDates.length > 0) {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Check if the last completion is today or yesterday
    const lastDateStr = uniqueDates[uniqueDates.length - 1];
    const lastDate = new Date(lastDateStr);
    const today = new Date(todayStr);
    const diffTime = Math.abs(today.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // If last completion was more than 1 day ago, streak is broken
    if (diffDays <= 1) {
      streak = 1;
      for (let i = uniqueDates.length - 2; i >= 0; i--) {
        const prev = new Date(uniqueDates[i]);
        const curr = new Date(uniqueDates[i + 1]);
        const diff = Math.ceil(Math.abs(curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 1) {
          streak++;
        } else if (diff > 1) {
          break; // streak broken
        }
      }
    }
  }

  return { streak, points, completedCount: progress.length };
}

export async function checkAndAwardBadges(studentId: string) {
  try {
    // 1. Fetch progress records
    const { data: progress, error } = await supabase
      .from('student_progress')
      .select('completed_at, quiz_score, quiz_total')
      .eq('student_id', studentId);

    if (error || !progress) {
      console.error("Error fetching progress for badges check:", error);
      return;
    }

    const { streak } = await calculateStreakAndPoints(studentId);

    // badge check 1: First Lesson Completed (at least 1 lesson in student_progress)
    if (progress.length >= 1) {
      await awardBadge(studentId, 'first_lesson');
    }

    // badge check 2: Quiz Master (completed 3 or more quizzes with score >= 80%)
    let quizMasterCount = 0;
    let perfectScoreUnlocked = false;

    progress.forEach(p => {
      if (p.quiz_score !== null && p.quiz_total !== null && p.quiz_total > 0) {
        const scorePct = (p.quiz_score / p.quiz_total) * 100;
        if (scorePct >= 80) {
          quizMasterCount++;
        }
        if (scorePct === 100) {
          perfectScoreUnlocked = true;
        }
      }
    });

    if (quizMasterCount >= 3) {
      await awardBadge(studentId, 'quiz_master');
    }

    // badge check 3: Perfect Score (100% on any practice quiz)
    if (perfectScoreUnlocked) {
      await awardBadge(studentId, 'perfect_score');
    }

    // badge check 4: Consistent Learner (streak of 3+ consecutive days)
    if (streak >= 3) {
      await awardBadge(studentId, 'consistent_learner');
    }

    // badge check 5: Weekly Learner (completed at least 1 lesson/quiz in current calendar week or last 7 days)
    // Checking last 7 days:
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const hasWeeklyActivity = progress.some(p => new Date(p.completed_at) >= sevenDaysAgo);
    if (hasWeeklyActivity) {
      await awardBadge(studentId, 'weekly_learner');
    }
  } catch (err) {
    console.error("checkAndAwardBadges failed:", err);
  }
}
