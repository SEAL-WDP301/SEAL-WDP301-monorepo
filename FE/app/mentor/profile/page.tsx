import { RoleGuard } from "@/components/auth/role-guard";
import { Topbar } from "@/components/layout/dashboard/topbar";
import { ProfileManager } from "@/components/profile/profile-manager";

export default function MentorProfilePage() {
  return (
    <RoleGuard allowedRoles={["stakeholder"]}>
      <div className="min-h-screen bg-background text-foreground">
        <Topbar showDesktopLogo />
        <main className="mx-auto max-w-7xl p-6 lg:p-8">
          <ProfileManager
            mode="professional"
            title="Stakeholder Profile"
            subtitle="Manage the stakeholder profile shown to teams and used across workflows."
          />
        </main>
      </div>
    </RoleGuard>
  );
}
