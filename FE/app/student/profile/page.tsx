import { ProfileManager } from "@/components/profile/profile-manager";

export default function StudentProfilePage() {
  return (
    <ProfileManager
      mode="student"
      title="My Student Profile"
      subtitle="Manage your student identity, contact details, and GitHub username for team registration and submissions."
    />
  );
}
