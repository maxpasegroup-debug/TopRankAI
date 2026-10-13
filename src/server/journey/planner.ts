export type PlanLesson = { title: string; subject: string; href: string };
export function previewStudyPlan(start: Date, dailyMinutes: number, lessons: PlanLesson[]) {
  if (!Number.isInteger(dailyMinutes) || dailyMinutes < 30 || dailyMinutes > 720 || !lessons.length || Number.isNaN(start.getTime())) {
    throw new Error("A start date, study availability and published lessons are required");
  }
  // A seven-day draft based on selected content, not an exam-readiness estimate.
  const tasks = [];
  const distinct = [...new Map(lessons.map(lesson => [lesson.href, lesson])).values()].slice(0, 21);
  for (let day = 0; day < 7; day++) {
    const selected = distinct.filter((_, index) => index % 7 === day);
    const slots = selected.length;
    for (let slot = 0; slot < slots; slot++) {
      const lesson = selected[slot];
      const dueDate = new Date(start);
      dueDate.setUTCDate(start.getUTCDate() + day);
      tasks.push({ ...lesson, dueDate, minutes: Math.min(45, Math.floor(dailyMinutes / slots)) });
    }
  }
  return tasks;
}
