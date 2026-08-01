import { axiosClient } from "@/lib/axios";

export type AssistantCard = {
  type: "event" | "action" | "info";
  title: string;
  subtitle?: string;
  href: string;
  primary?: boolean;
};

export type AssistantAudience =
  | "guest"
  | "student"
  | "mentor"
  | "judge"
  | "mentor_judge"
  | "organizer"
  | "admin";

export type AssistantChatResult = {
  reply: string;
  intent: string;
  audience?: AssistantAudience;
  usedAi: { intent: boolean; wording: boolean };
  factsUsed: Record<string, unknown>;
  cards: AssistantCard[];
  quickReplies: string[];
  needsLogin?: boolean;
  focusEventId?: number | null;
};

export async function postAssistantChat(input: {
  message: string;
  locale?: "vi" | "en";
  context?: {
    eventId?: number;
    focusEventId?: number;
    path?: string;
  };
  history?: Array<{ role: "user" | "assistant"; text: string }>;
}) {
  const response = await axiosClient.post("/assistant/chat", input);
  return (response.data?.data || response.data) as AssistantChatResult;
}

export function quickRepliesForAudience(audience?: AssistantAudience | null) {
  switch (audience) {
    case "mentor":
    case "mentor_judge":
      return [
        "Team của tôi",
        "Team nào thiếu feedback",
        "Event đang mở",
        "Round tôi được assign",
      ];
    case "judge":
      return [
        "Round tôi được assign",
        "Bài chưa chấm",
        "Rubric round của tôi",
        "Event đang mở",
      ];
    case "organizer":
    case "admin":
      return [
        "Event của tôi",
        "Tình trạng event này",
        "Rubric/criteria event",
        "Event đang mở",
      ];
    case "student":
      return [
        "Thông tin của tôi",
        "Event của tôi",
        "Giải tôi đã đạt",
        "Điểm đã công bố",
      ];
    default:
      return [
        "Event đang mở",
        "Cách đăng ký",
        "Mentor/Judge event này",
        "Deadline gần nhất",
      ];
  }
}

export function welcomeForAudience(audience?: AssistantAudience | null) {
  switch (audience) {
    case "mentor":
      return "Hi! Mình là SEAL Assistant cho Mentor — giúp bạn xem team được assign, submission thiếu feedback và điều hướng mentoring. Không gửi feedback hộ bạn.";
    case "judge":
      return "Hi! Mình là SEAL Assistant cho Judge — giúp bạn xem round được assign, bài chưa chấm và rubric của round bạn phụ trách.";
    case "mentor_judge":
      return "Hi! Mình là SEAL Assistant — bạn đang vừa mentor vừa judge. Có thể hỏi team mentoring, bài chưa chấm, hoặc rubric round được assign.";
    case "organizer":
    case "admin":
      return "Hi! Mình là SEAL Assistant cho Organizer — giúp bạn xem event đang quản lý, tình trạng vận hành và criteria/rubric đã setup.";
    case "student":
      return "Hi! Mình là SEAL Assistant — giúp bạn tìm event, đọc thông tin công khai, điều hướng đăng ký/nộp bài/kết quả đã công bố. Không đăng ký hộ và không tiết lộ cấu hình chấm nội bộ.";
    default:
      return "Hi! Mình là SEAL Assistant — giúp tìm event và điều hướng trên SEAL theo quyền tài khoản của bạn.";
  }
}
