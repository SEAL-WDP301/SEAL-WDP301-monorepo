import { Crown } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type MemberListItemProps = {
  member: {
    userId: number;
    role: string;
    user?: {
      name?: string | null;
      email?: string | null;
      avatarUrl?: string | null;
    } | null;
  };
  currentUserId?: number;
};

export function MemberListItem({ member, currentUserId }: MemberListItemProps) {
  const isMemberLeader = member.role === "leader";
  const isCurrentUser = member.userId === currentUserId;
  const name = member.user?.name || "Unknown User";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-4 rounded-[16px] border border-border bg-card p-4 transition-colors hover:bg-muted/50">
      <Avatar
        className={`h-12 w-12 border ${isMemberLeader ? "border-orange-500/50" : "border-border"}`}
      >
        {member.user?.avatarUrl && (
          <AvatarImage
            src={member.user.avatarUrl}
            alt={name}
            className="object-cover"
          />
        )}
        <AvatarFallback
          className={
            isMemberLeader
              ? "bg-orange-500/10 font-bold text-orange-500"
              : "bg-muted font-semibold text-muted-foreground"
          }
        >
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="flex items-center gap-1.5 truncate text-base font-semibold text-foreground">
            {isMemberLeader && <Crown className="h-4 w-4 text-orange-500" />}
            {name}
          </p>
          {isCurrentUser && (
            <span className="rounded-full border border-white/5 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              You
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {member.user?.email}
        </p>
      </div>
    </div>
  );
}
