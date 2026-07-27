import NotificationsPage from "@/app/home/notifications/page";
import { RoleGuard } from "@/components/auth/role-guard";
import { Topbar } from "@/components/layout/dashboard/topbar";

export default function MentorNotificationsPage() {
  return (
    <RoleGuard allowedRoles={["stakeholder"]}>
      <div className="min-h-screen bg-background text-foreground">
        <Topbar showDesktopLogo />
        <main className="p-6">
          <NotificationsPage />
        </main>
      </div>
    </RoleGuard>
  );
}
