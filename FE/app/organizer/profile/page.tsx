import { ProfileManager } from "@/components/profile/profile-manager";

export default function OrganizerProfilePage() {
  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <ProfileManager
        mode="professional"
        title="Organizer Profile"
        subtitle="Manage the professional profile attached to organizer, admin, and event coordination activity."
      />
    </div>
  );
}
