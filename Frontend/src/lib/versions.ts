import { supabase } from "@/integrations/supabase/client";

/**
 * Creates a version history snapshot for a lesson.
 * Call this before making edits, on save, or after a regeneration.
 */
export async function createVersionSnapshot(lessonId: string, createdByUserId?: string): Promise<number> {
  try {
    // 1. Fetch current lesson contents
    const { data: lesson, error: fetchErr } = await supabase
      .from("lessons")
      .select("*")
      .eq("id", lessonId)
      .maybeSingle();

    if (fetchErr || !lesson) {
      throw new Error(fetchErr?.message || "Lesson not found for snapshotting.");
    }

    // 2. Fetch maximum current version number for this lesson
    const { data: versions, error: verErr } = await supabase
      .from("lesson_versions")
      .select("version_number")
      .eq("lesson_id", lessonId)
      .order("version_number", { ascending: false })
      .limit(1);

    if (verErr) throw verErr;

    const nextVerNum = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;

    // 3. Insert snapshot
    const { error: insErr } = await supabase.from("lesson_versions").insert({
      lesson_id: lessonId,
      version_number: nextVerNum,
      title: lesson.title,
      subject: lesson.subject,
      grade: lesson.grade,
      topic: lesson.topic,
      duration: lesson.duration,
      language: lesson.language,
      objectives: lesson.objectives,
      lesson_plan: lesson.lesson_plan,
      worksheet: lesson.worksheet,
      quiz: lesson.quiz,
      answer_key: lesson.answer_key,
      rubric: lesson.rubric,
      homework: lesson.homework,
      created_by: createdByUserId || lesson.user_id,
    });

    if (insErr) throw insErr;
    return nextVerNum;
  } catch (e: any) {
    console.warn("Failed to create lesson version snapshot (proceeding gracefully):", e);
    return -1;
  }
}

/**
 * Restores a historical version to the active lesson.
 * Creates a snapshot of the current state before overwriting.
 */
export async function restoreVersion(versionId: string, lessonId: string, userId?: string) {
  try {
    // 1. Create a version snapshot of current active state first
    await createVersionSnapshot(lessonId, userId);

    // 2. Get the historical version content
    const { data: ver, error: verErr } = await supabase
      .from("lesson_versions")
      .select("*")
      .eq("id", versionId)
      .maybeSingle();

    if (verErr || !ver) {
      throw new Error(verErr?.message || "Version record not found.");
    }

    // 3. Overwrite current active lesson
    const { error: updErr } = await supabase
      .from("lessons")
      .update({
        title: ver.title,
        subject: ver.subject,
        grade: ver.grade,
        topic: ver.topic,
        duration: ver.duration,
        language: ver.language,
        objectives: ver.objectives,
        lesson_plan: ver.lesson_plan,
        worksheet: ver.worksheet,
        quiz: ver.quiz,
        answer_key: ver.answer_key,
        rubric: ver.rubric,
        homework: ver.homework,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lessonId);

    if (updErr) throw updErr;
  } catch (e: any) {
    console.error("Failed to restore lesson version:", e);
    throw e;
  }
}
