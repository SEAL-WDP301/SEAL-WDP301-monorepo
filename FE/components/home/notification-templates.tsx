import { ExternalLink, Calendar, CheckCircle2, Download, AlertCircle, XCircle, Info, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// ==========================================
// DYNAMIC TEMPLATES
// ==========================================

const ActionUrlButton = ({ url }: { url?: string }) => {
  if (!url) return null;
  const isExternal = url.startsWith('http');
  return (
    <div className="mt-6 border-t border-border pt-4">
      <h3 className="font-bold text-base text-foreground mb-3 flex items-center gap-2">
        <ExternalLink className="w-4 h-4 text-orange-500" />
        QUICK ACTION
      </h3>
      {isExternal ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold">
            Open Link
          </Button>
        </a>
      ) : (
        <Link href={url}>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold">
            View Details
          </Button>
        </Link>
      )}
    </div>
  );
};

const TeamAssignedTemplate = ({ notification }: { notification: any }) => (
  <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
    <p className="font-medium text-lg">Hello,</p>
    <p>
      The system has detected a change in your team membership. Please review the updated information below.
    </p>
    
    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
      <p className="text-blue-600 dark:text-blue-400 font-bold text-base mb-2 flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5" />
        UPDATED INFORMATION
      </p>
      <p className="whitespace-pre-wrap">{notification.content}</p>
    </div>

    <div>
      <h3 className="font-bold text-base text-foreground mb-3 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-orange-500" />
        NEXT STEPS
      </h3>
      <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
        <li>Visit the Team Management page to review the current team member list.</li>
        <li>Connect with your teammates and assign responsibilities to prepare for the upcoming round.</li>
      </ul>
    </div>
    
    <ActionUrlButton url={notification.actionUrl} />

    <div className="pt-6 border-t border-border mt-8">
      <p>Best regards,</p>
      <p className="font-bold text-orange-500 text-lg mt-1">{notification.event?.name || 'SEAL System'}</p>
    </div>
  </div>
);

const RegistrationApprovedTemplate = ({ notification }: { notification: any }) => (
  <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
    <p className="font-medium text-lg">Dear Team Leader,</p>
    
    <p>
      Congratulations! Your team registration has been successfully evaluated and approved by the Review Committee. This is an exciting first step in your journey through our event.
    </p>
    
    <div className="bg-green-500/10 border border-green-500/20 p-5 rounded-xl shadow-sm">
      <p className="text-green-600 dark:text-green-400 font-bold text-base mb-3 flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5" />
        REGISTRATION STATUS: APPROVED
      </p>
      <p className="text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: formatNotificationContent(notification.content) }} />
    </div>

    <div className="bg-muted/50 border border-border p-5 rounded-xl">
      <h3 className="font-bold text-base text-foreground mb-3 flex items-center gap-2">
        <Download className="w-4 h-4 text-orange-500" />
        Preparation & Resources
      </h3>
      <p className="text-muted-foreground mb-3">To ensure your team is fully prepared for the upcoming phases, please review the following essential resources:</p>
      <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
        <li><strong>Competition Guidelines:</strong> Familiarize yourself with the grading rubrics and ethical standards.</li>
        <li><strong>System Operations Guide:</strong> Understand the workflow for submitting your deliverables.</li>
      </ul>
    </div>

    <ActionUrlButton url={notification.actionUrl} />

    <div className="pt-6 border-t border-border mt-8">
      <p>Warm regards,</p>
      <p className="font-bold text-orange-500 text-lg mt-1">{notification.event?.name ? `Organizing Committee ${notification.event.name}` : 'Event Organizing Committee'}</p>
    </div>
  </div>
);

const RegistrationRejectedTemplate = ({ notification }: { notification: any }) => (
  <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
    <p className="font-medium text-lg">Dear Team Leader,</p>
    
    <p>
       Thank you for your interest in participating. After careful consideration, we regret to inform you that your registration did not meet all the necessary criteria for this particular event.
    </p>
    
    <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-xl shadow-sm">
      <p className="text-red-600 dark:text-red-400 font-bold text-base mb-3 flex items-center gap-2">
        <XCircle className="w-5 h-5" />
        REGISTRATION STATUS: REJECTED
      </p>
      <p className="text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: formatNotificationContent(notification.content) }} />
    </div>

    <div className="bg-muted/50 border border-border p-5 rounded-xl">
      <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-orange-500" />
        Guidance & Next Actions
      </h3>
      <p className="text-muted-foreground mb-2">We deeply appreciate the effort you put into your application. Please do not be discouraged. You can still:</p>
      <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
        <li>Review the feedback provided above and identify areas for improvement.</li>
        <li>If the registration window is still open, you may address the highlighted issues and submit a new application.</li>
        <li>Stay tuned for future events and opportunities that might better align with your team's profile.</li>
      </ul>
    </div>

    <ActionUrlButton url={notification.actionUrl} />

    <div className="pt-6 border-t border-border mt-8">
      <p>Warm regards,</p>
      <p className="font-bold text-orange-500 text-lg mt-1">{notification.event?.name ? `Organizing Committee ${notification.event.name}` : 'Organizing Committee'}</p>
    </div>
  </div>
);

const formatNotificationContent = (content: string) => {
  if (!content) return "";
  let html = content;
  
  // Severe negative keywords (keep red)
  html = html.replace(/(rejected|disqualified)/gi, '<span class="text-red-600 dark:text-red-400 font-bold bg-red-500/10 px-1.5 py-0.5 rounded-md">$&</span>');

  // Mild negative keywords (no background, just red text)
  html = html.replace(/(did not advance|eliminated)/gi, '<span class="font-bold text-red-500">$&</span>');
  
  // Positive keywords (need to avoid overwriting 'did not advance')
  const placeholder = '___DID_NOT_ADVANCE___';
  html = html.replace(/<span class="font-bold text-red-500">did not advance<\/span>/gi, placeholder);
  
  html = html.replace(/(advanced|approved|finalist|winner|first prize|second prize|third prize|champion)/gi, '<span class="text-green-600 dark:text-green-400 font-bold bg-green-500/10 px-1.5 py-0.5 rounded-md">$&</span>');
  
  html = html.replace(new RegExp(placeholder, 'g'), '<span class="font-bold text-red-500">did not advance</span>');

  return html;
};

const RoundResultTemplate = ({ notification }: { notification: any }) => {
  const contentLower = notification.content.toLowerCase();
  const isAdvanced = contentLower.includes('advanced') && !contentLower.includes('did not advance');
  const isEliminated = contentLower.includes('did not advance') || contentLower.includes('eliminated');
  const isAwarded = /(winner|first prize|second prize|third prize|champion|finalist)/i.test(contentLower);
  
  const isSuccess = isAdvanced || isAwarded;

  return (
    <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
      <p className="font-medium text-lg">Dear Team,</p>
      
      <p>
        The Evaluation Committee has officially announced the results for the recent round. Thank you for your exceptional hard work, dedication, and innovative spirit throughout this phase of the competition.
      </p>
      
      <div className={cn(
        "border p-5 rounded-xl shadow-sm",
        isAwarded ? "bg-amber-500/10 border-amber-500/30" :
        isAdvanced ? "bg-green-500/5 border-green-500/20" : 
        "bg-muted/30 border-border/50"
      )}>
        <p className="font-bold text-base mb-3 flex items-center gap-2">
          {isAwarded ? <CheckCircle2 className="w-5 h-5 text-amber-500" /> : 
           isAdvanced ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : 
           <Info className="w-5 h-5 text-muted-foreground" />}
          {isAwarded ? "🏆 OUTSTANDING ACHIEVEMENT!" : isAdvanced ? "🎉 CONGRATULATIONS!" : "📋 ROUND RESULTS"}
        </p>
        <p className="text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: formatNotificationContent(notification.content) }} />
      </div>

      {isAwarded && (
        <div className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20 p-5 rounded-xl">
          <h3 className="font-bold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Hall of Fame & Next Steps
          </h3>
          <p className="text-muted-foreground mb-3">
            Your outstanding performance has earned you a place among the top teams. The Organizing Committee would like to formally acknowledge your brilliant achievements and extend our highest commendations.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li>Keep an eye on your email for the official Award Ceremony invitation.</li>
            <li>Prepare a brief presentation or showcase if requested by the committee.</li>
          </ul>
        </div>
      )}

      {isAdvanced && !isAwarded && (
        <div className="bg-muted/50 border border-border p-5 rounded-xl">
          <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-500" />
            Looking Ahead (Next Steps)
          </h3>
          <p className="text-muted-foreground mb-3">
            We are thrilled to see your team move forward. This achievement is a testament to your excellent collaboration and technical proficiency. Please prepare diligently for the upcoming challenges. The journey ahead will demand even greater innovation and resilience.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li>Review the guidelines for the next round immediately.</li>
            <li>Schedule a strategic meeting with your mentor to refine your approach.</li>
          </ul>
        </div>
      )}

      {isEliminated && (
        <div className="bg-muted/50 border border-border p-5 rounded-xl">
          <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-orange-500" />
            Acknowledgment & Encouragement
          </h3>
          <p className="text-muted-foreground">
            Although your team did not advance this time, the Organizing Committee highly values the effort, creativity, and perseverance you have demonstrated. We hope the insights and feedback gained from this competition will serve as a strong foundation for your future academic and professional endeavors. Keep striving for excellence, and we look forward to seeing you in our upcoming events!
          </p>
        </div>
      )}

      <div>
        <h3 className="font-bold text-base text-foreground mb-3 flex items-center gap-2">
          <Mail className="w-4 h-4 text-orange-500" />
          Support & Inquiries
        </h3>
        <p className="mb-2 text-muted-foreground">If you have any questions regarding the evaluation results or require further feedback, please contact us:</p>
        <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
          <li><strong>Organizer Email:</strong> support@seal.edu.vn</li>
          <li>Submit a formal inquiry through the competition Ticket System.</li>
        </ul>
      </div>

      <ActionUrlButton url={notification.actionUrl} />

      <div className="pt-6 border-t border-border mt-8">
        <p>Best regards,</p>
        <p className="font-bold text-orange-500 text-lg mt-1">{notification.event?.name ? `Evaluation Committee ${notification.event.name}` : 'Evaluation Committee'}</p>
      </div>
    </div>
  );
};

const TeamInvitationTemplate = ({ notification }: { notification: any }) => {
  const isAccepted = notification.type === "team_invite_accepted";
  const isRejected = notification.type === "team_invite_rejected";
  
  return (
    <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
      <p className="font-medium text-lg">Dear Team Leader,</p>
      
      <p>
        There is an update regarding a recent invitation you sent out for your team.
      </p>
      
      <div className={cn(
        "border p-5 rounded-xl shadow-sm",
        isAccepted ? "bg-green-500/5 border-green-500/20" : 
        isRejected ? "bg-muted/30 border-border/50" : 
        "bg-blue-500/5 border-blue-500/20"
      )}>
        <p className="font-bold text-base mb-3 flex items-center gap-2">
          {isAccepted ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : 
           isRejected ? <XCircle className="w-5 h-5 text-muted-foreground" /> : 
           <Info className="w-5 h-5 text-blue-500" />}
          {isAccepted ? "INVITATION ACCEPTED" : 
           isRejected ? "INVITATION DECLINED" : "TEAM UPDATE"}
        </p>
        <p className="text-base leading-relaxed">
          {notification.content}
        </p>
      </div>

      <ActionUrlButton url={notification.actionUrl} />

      <div className="pt-6 border-t border-border mt-8">
        <p>Best regards,</p>
        <p className="font-bold text-orange-500 text-lg mt-1">{notification.event?.name ? `SEAL System - ${notification.event.name}` : 'SEAL System'}</p>
      </div>
    </div>
  );
};

const GenericTemplate = ({ notification }: { notification: any }) => (
  <div className="space-y-4 text-sm text-foreground/90 leading-relaxed">
    <p>Hello,</p>
    <div className="bg-muted/30 border border-border/50 p-4 rounded-lg">
      <p className="whitespace-pre-wrap">{notification.content}</p>
    </div>
    
    <ActionUrlButton url={notification.actionUrl} />
    
    <div className="pt-6 border-t border-border mt-8">
      <p>Best regards,</p>
      <p className="font-bold">SEAL System</p>
    </div>
  </div>
);

const formatReminderContent = (content: string, type: string) => {
  if (!content) return "";
  let html = content;
  
  if (type === 'bulk_reminder_unsubmitted') {
    html = html.replace(/(HAS NOT YET SUBMITTED)/g, '<span class="text-red-600 dark:text-red-400 font-bold bg-red-500/10 px-1.5 py-0.5 rounded-md">$&</span>');
  } else if (type === 'bulk_reminder_submitted') {
    html = html.replace(/(We have received your submission)/i, '<span class="text-green-600 dark:text-green-400 font-bold bg-green-500/10 px-1.5 py-0.5 rounded-md">$&</span>');
  }
  
  html = html.replace(/(Deadline:|The system will close at:)/g, '<span class="font-bold text-orange-500">$&</span>');
  html = html.replace(/(Time Remaining:)/g, '<span class="font-bold text-blue-500">$&</span>');
  
  // Highlight team name in "Hello [TeamName] team members"
  html = html.replace(/Hello (.*?) team members/g, 'Hello <span class="font-bold text-foreground text-[15px]">$1</span> team members');
  
  // Replace newlines with <br/> for html rendering
  html = html.replace(/\n/g, '<br/>');

  return html;
};

const SubmissionReminderTemplate = ({ notification }: { notification: any }) => {
  const isUnsubmitted = notification.type === 'bulk_reminder_unsubmitted';
  
  return (
    <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
      <div className={cn(
        "border p-6 rounded-xl shadow-sm",
        isUnsubmitted ? "bg-red-500/5 border-red-500/20" : "bg-blue-500/5 border-blue-500/20"
      )}>
        <p className="font-bold text-base mb-4 flex items-center gap-2">
          {isUnsubmitted ? <AlertCircle className="w-5 h-5 text-red-500" /> : <Info className="w-5 h-5 text-blue-500" />}
          {isUnsubmitted ? "URGENT ACTION REQUIRED" : "SUBMISSION INFORMATION"}
        </p>
        <p className="text-[15px] leading-relaxed" dangerouslySetInnerHTML={{ __html: formatReminderContent(notification.content, notification.type) }} />
      </div>

      <ActionUrlButton url={notification.actionUrl} />

      <div className="pt-6 border-t border-border mt-8">
        <p>Best regards,</p>
        <p className="font-bold text-orange-500 text-lg mt-1">{notification.event?.name ? `Organizing Committee ${notification.event.name}` : 'Organizing Committee'}</p>
      </div>
    </div>
  );
};

const StakeholderAssignedTemplate = ({ notification }: { notification: any }) => {
  const isMentor = notification.type === "mentor_assigned";
  const roleText = isMentor ? "Mentor" : "Judge";
  const basePath = isMentor ? `/mentor/events/${notification.eventId}` : `/judge/events/${notification.eventId}`;
  const actionUrl = notification.actionUrl || basePath;

  return (
    <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
      <p className="font-medium text-lg">Dear {roleText},</p>
      
      <p>
        We are thrilled to welcome you to the evaluation committee. You have been officially assigned as a {roleText.toLowerCase()} for the upcoming phases of our event.
      </p>
      
      <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
        <p className="text-blue-600 dark:text-blue-400 font-bold text-base mb-2 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          ASSIGNMENT DETAILS
        </p>
        <p className="whitespace-pre-wrap">{notification.content}</p>
      </div>

      <ActionUrlButton url={actionUrl} />

      <div className="pt-6 border-t border-border mt-8">
        <p>Best regards,</p>
        <p className="font-bold text-orange-500 text-lg mt-1">{notification.event?.name ? `Organizing Committee ${notification.event.name}` : 'Event Organizing Committee'}</p>
      </div>
    </div>
  );
};

export const NotificationDynamicTemplate = ({ notification }: { notification: any }) => {
  switch (notification.type) {
    case 'team_assigned':
      return <TeamAssignedTemplate notification={notification} />;
    case 'registration_approved':
      return <RegistrationApprovedTemplate notification={notification} />;
    case 'registration_rejected':
      return <RegistrationRejectedTemplate notification={notification} />;
    case 'round_result':
    case 'final_result':
    case 'finalist':
      return <RoundResultTemplate notification={notification} />;
    case 'mentor_assigned':
    case 'judge_assigned':
      return <StakeholderAssignedTemplate notification={notification} />;
    case 'team_invite_accepted':
    case 'team_invite_rejected':
    case 'team_leadership_transfer':
      return <TeamInvitationTemplate notification={notification} />;
    case 'bulk_reminder_unsubmitted':
    case 'bulk_reminder_submitted':
      return <SubmissionReminderTemplate notification={notification} />;
    default:
      return <GenericTemplate notification={notification} />;
  }
};
