import { getSubscription } from "@/server/platform/subscriptions";
import { mockMonthlyActive } from "@/shared/daily-workload";
import { planForSubscription } from "@/shared/plans";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/platform/app/AppShell";
import { getUnreadNotificationCount } from "@/server/platform/notifications";
import { requireAuth } from "@/server/auth/session";
import { getCandidateExams } from "@/server/platform/candidate";
import { getActiveExam } from "@/server/platform/active";
import { RevealProvider } from "@/components/platform/RevealProvider";

export const dynamic = "force-dynamic";

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  if (user.role === "PLATFORM_ADMIN") redirect("/admin");

  const [exams, active, subscription] = await Promise.all([
    getCandidateExams(user.id),
    getActiveExam(user.id),
    getSubscription(user.id),
  ]);

  const unread = await getUnreadNotificationCount(user.id);

  return (
    <>
      <AppShell
        user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl ?? null }}
        exams={exams.map((exam) => ({ code: exam.code, label: exam.shortName ?? exam.name, level: exam.level }))}
        activeCode={active?.code ?? null}
        unread={unread}
        pro={mockMonthlyActive(subscription)}
        planName={mockMonthlyActive(subscription) ? planForSubscription(subscription).name : null}
      >
        {children}
      </AppShell>
      <RevealProvider />
    </>
  );
}
