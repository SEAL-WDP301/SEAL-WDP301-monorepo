import { Injectable, Logger } from "@nestjs/common";
import { MailerService } from "@nestjs-modules/mailer";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] as string,
  );
}

function sanitizeMailHeader(value: string) {
  return value.replace(/[\r\n<>]/g, "").trim();
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendNotificationEmail(
    to: string,
    recipientName: string,
    subject: string,
    message: string,
  ) {
    return this.mailerService.sendMail({
      to,
      subject,
      text: `Hello ${recipientName},\n\n${message}\n\nSEAL Team`,
    });
  }

  async sendOtpEmail(to: string, otp: string) {
    try {
      const response = await this.mailerService.sendMail({
        to,
        subject: "SEAL - Xác thực địa chỉ Email",
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>Chào mừng bạn đến với SEAL!</h2>
            <p>Để hoàn tất quá trình đăng ký, vui lòng nhập mã OTP dưới đây:</p>
            <h1 style="color: #ff7629; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
            <p>Mã này sẽ hết hạn sau 5 phút.</p>
            <br/>
            <p>Trân trọng,<br/>Đội ngũ SEAL</p>
          </div>
        `,
      });

      this.logger.log(
        `OTP Email sent to ${to}, MessageID: ${response?.messageId}`,
      );
      return response;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
      throw error;
    }
  }

  async sendResetPasswordEmail(to: string, resetLink: string) {
    try {
      const response = await this.mailerService.sendMail({
        to,
        subject: "SEAL - Khôi phục mật khẩu",
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>Yêu cầu khôi phục mật khẩu</h2>
            <p>Chúng tôi nhận được yêu cầu khôi phục mật khẩu cho tài khoản của bạn trên SEAL.</p>
            <p>Vui lòng click vào nút bên dưới để tạo mật khẩu mới:</p>
            <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #ff7629; color: #000; text-decoration: none; font-weight: bold; border-radius: 4px; margin: 20px 0;">
              KHÔI PHỤC MẬT KHẨU
            </a>
            <p>Link này sẽ hết hạn sau 5 phút.</p>
            <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
            <br/>
            <p>Trân trọng,<br/>Đội ngũ SEAL</p>
          </div>
        `,
      });

      this.logger.log(
        `Reset Password Email sent to ${to}, MessageID: ${response?.messageId}`,
      );
      return response;
    } catch (error) {
      this.logger.error(`Failed to send reset password email to ${to}`, error);
      throw error;
    }
  }

  async sendTeamInvitationEmail(invitation: {
    to: string;
    teamName: string;
    eventName: string;
    trackName: string;
    leaderName: string;
    invitationUrl: string;
    expiresAt: Date;
  }) {
    const {
      to,
      teamName,
      eventName,
      trackName,
      leaderName,
      invitationUrl,
      expiresAt,
    } = invitation;
    const safeTeamName = escapeHtml(teamName);
    const safeEventName = escapeHtml(eventName);
    const safeTrackName = escapeHtml(trackName);
    const safeLeaderName = escapeHtml(leaderName);
    const safeInvitationUrl = escapeHtml(invitationUrl);
    const formattedExpiry = new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(expiresAt);
    const subjectTeamName = sanitizeMailHeader(teamName);
    const plainLeaderName = sanitizeMailHeader(leaderName);
    const plainEventName = sanitizeMailHeader(eventName);
    const plainTrackName = sanitizeMailHeader(trackName);
    try {
      const response = await this.mailerService.sendMail({
        to,
        subject: `SEAL - Lời mời tham gia đội thi ${subjectTeamName}`,
        text: [
          "LỜI MỜI THAM GIA ĐỘI THI SEAL",
          "",
          `${plainLeaderName} đã mời bạn tham gia đội ${subjectTeamName}.`,
          `Sự kiện: ${plainEventName}`,
          `Track: ${plainTrackName}`,
          `Lời mời hết hạn: ${formattedExpiry} (GMT+7)`,
          "",
          `Xem và phản hồi lời mời: ${invitationUrl}`,
          "",
          "Nếu chưa có tài khoản SEAL, hãy đăng ký bằng đúng địa chỉ email nhận được lời mời này.",
          "Nếu bạn không mong đợi lời mời này, bạn có thể bỏ qua email.",
          "",
          "Đội ngũ SEAL",
        ].join("\n"),
        html: `
          <div style="margin:0;background:#0f0b0a;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#f8fafc;">
            <div style="max-width:600px;margin:0 auto;overflow:hidden;border:1px solid #3a2b24;border-radius:20px;background:#17110f;box-shadow:0 16px 40px rgba(0,0,0,.25);">
              <div style="padding:28px 32px;background:linear-gradient(135deg,#2a160c 0%,#17110f 60%,#12351f 100%);border-bottom:1px solid #3a2b24;">
                <div style="font-size:22px;font-weight:800;letter-spacing:4px;color:#ff7629;">SEAL</div>
                <div style="margin-top:8px;font-size:12px;font-weight:700;letter-spacing:2px;color:#c7b8b0;">TEAM INVITATION</div>
              </div>

              <div style="padding:32px;">
                <h1 style="margin:0 0 14px;font-size:26px;line-height:1.25;color:#ffffff;">Bạn được mời tham gia đội thi</h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#c7b8b0;">
                  <strong style="color:#ffffff;">${safeLeaderName}</strong> đã mời bạn đồng hành cùng đội
                  <strong style="color:#ff7629;">${safeTeamName}</strong> trên SEAL.
                </p>

                <div style="margin:0 0 26px;padding:20px;border:1px solid #3a2b24;border-radius:14px;background:#201714;">
                  <div style="margin-bottom:14px;">
                    <div style="margin-bottom:4px;font-size:11px;font-weight:700;letter-spacing:1px;color:#9f8f87;">SỰ KIỆN</div>
                    <div style="font-size:16px;font-weight:700;color:#ffffff;">${safeEventName}</div>
                  </div>
                  <div>
                    <div style="margin-bottom:4px;font-size:11px;font-weight:700;letter-spacing:1px;color:#9f8f87;">TRACK</div>
                    <div style="font-size:15px;color:#f8fafc;">${safeTrackName}</div>
                  </div>
                </div>

                <div style="text-align:center;">
                  <a href="${safeInvitationUrl}" style="display:inline-block;padding:14px 28px;border-radius:10px;background:#ff7629;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;">
                    XEM VÀ PHẢN HỒI LỜI MỜI
                  </a>
                </div>

                <p style="margin:24px 0 8px;text-align:center;font-size:13px;line-height:1.6;color:#c7b8b0;">
                  Lời mời hết hạn vào <strong style="color:#ffffff;">${formattedExpiry} (GMT+7)</strong>.
                </p>
                <p style="margin:0;text-align:center;font-size:13px;line-height:1.6;color:#9f8f87;">
                  Chưa có tài khoản? Hãy đăng ký bằng đúng email nhận lời mời này.
                </p>

                <div style="margin-top:28px;padding-top:20px;border-top:1px solid #3a2b24;font-size:12px;line-height:1.6;color:#81736d;">
                  Nếu nút phía trên không hoạt động, sao chép đường dẫn sau vào trình duyệt:<br/>
                  <a href="${safeInvitationUrl}" style="color:#ff9a5f;word-break:break-all;">${safeInvitationUrl}</a>
                </div>
              </div>

              <div style="padding:18px 32px;background:#120d0c;text-align:center;font-size:11px;line-height:1.6;color:#756863;">
                Đây là email tự động từ SEAL. Nếu bạn không mong đợi lời mời này, hãy bỏ qua email.
              </div>
            </div>
          </div>
        `,
      });

      this.logger.log(
        `Team invitation email sent to ${to}, MessageID: ${response?.messageId}`,
      );
      return response;
    } catch (error) {
      this.logger.error(`Failed to send team invitation email to ${to}`, error);
      throw error;
    }
  }

  async sendRoundResultEmail(
    to: string,
    teamName: string,
    roundName: string,
    trackName: string,
    isAdvanced: boolean,
    isAwarded: boolean,
    resultContext: string,
  ) {
    const subject = isAwarded
      ? `🏆 SEAL - THÔNG BÁO KẾT QUẢ ĐẶC BIỆT: ${teamName} - ${roundName}`
      : isAdvanced
        ? `🎉 SEAL - CHÚC MỪNG: ${teamName} vượt qua ${roundName}`
        : `📋 SEAL - THÔNG BÁO KẾT QUẢ: ${roundName}`;

    const themeColor = isAwarded
      ? "#f59e0b"
      : isAdvanced
        ? "#10b981"
        : "#6b7280";
    const headerTitle = isAwarded
      ? "OUTSTANDING ACHIEVEMENT"
      : isAdvanced
        ? "CONGRATULATIONS"
        : "ROUND RESULTS";

    let bodyContent = "";
    if (isAwarded) {
      bodyContent = `
        <p>Thành tích xuất sắc của đội bạn đã giúp các bạn ghi danh vào danh sách những đội xuất sắc nhất. Ban tổ chức xin chính thức ghi nhận những nỗ lực phi thường này.</p>
        <p>Vui lòng theo dõi email tiếp theo để nhận thư mời tham dự Lễ Trao Giải (Award Ceremony).</p>
      `;
    } else if (isAdvanced) {
      bodyContent = `
        <p>Thật tuyệt vời khi thấy đội của bạn tiếp tục tiến bước. Thành tích này là minh chứng cho sự hợp tác và năng lực kỹ thuật xuất sắc của toàn đội.</p>
        <p>Hãy chuẩn bị thật kỹ lưỡng cho những thử thách sắp tới, vì hành trình phía trước sẽ đòi hỏi nhiều sự đổi mới và kiên cường hơn nữa.</p>
      `;
    } else {
      bodyContent = `
        <p>Mặc dù đội của bạn không đi tiếp trong vòng này, Ban tổ chức đánh giá rất cao sự nỗ lực, sáng tạo và kiên trì mà các bạn đã thể hiện.</p>
        <p>Hy vọng những kinh nghiệm và phản hồi thu được từ cuộc thi sẽ là nền tảng vững chắc cho những thành công trong tương lai của các bạn. Đừng ngừng cố gắng nhé!</p>
      `;
    }

    try {
      const response = await this.mailerService.sendMail({
        to,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <div style="background-color: ${themeColor}; color: white; padding: 20px; text-align: center;">
              <h2 style="margin: 0; font-size: 24px; letter-spacing: 1px;">${headerTitle}</h2>
            </div>
            
            <div style="padding: 30px;">
              <p style="font-size: 16px; margin-top: 0;">Xin chào thành viên đội <strong>${teamName}</strong>,</p>
              
              <p>Hội đồng Đánh giá đã chính thức công bố kết quả cho <strong>${roundName}</strong> (Bảng thi: <strong>${trackName}</strong>).</p>
              
              <div style="background-color: #f9fafb; border-left: 4px solid ${themeColor}; padding: 15px; margin: 25px 0;">
                <p style="margin: 0; font-size: 16px;"><strong>Kết quả:</strong> ${resultContext}</p>
              </div>

              ${bodyContent}

              <div style="margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 20px; font-size: 14px; color: #6b7280;">
                <p style="margin: 0;">Nếu bạn có bất kỳ câu hỏi nào về kết quả đánh giá, vui lòng liên hệ:</p>
                <p style="margin: 5px 0 0 0;"><strong>Email:</strong> support@seal.edu.vn</p>
              </div>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #9ca3af;">
              <p style="margin: 0;">Đây là email tự động từ hệ thống SEAL. Vui lòng không trả lời trực tiếp email này.</p>
            </div>
          </div>
        `,
      });

      this.logger.log(
        `Round Result Email sent to ${to}, MessageID: ${response?.messageId}`,
      );
      return response;
    } catch (error) {
      this.logger.error(`Failed to send round result email to ${to}`, error);
    }
  }

  async sendSubmissionReminderEmail(
    to: string,
    teamName: string,
    roundName: string,
    eventName: string,
    deadline: string,
    timeRemaining: string,
    isSubmitted: boolean,
    actionUrl: string,
  ) {
    const subject = isSubmitted
      ? `ℹ️ Nhắc nhở: Rà soát bài nộp vòng ${roundName} - ${eventName}`
      : `⚠️ KHẨN CẤP: Sắp hết hạn nộp bài vòng ${roundName} - ${eventName}`;

    const themeColor = isSubmitted ? "#3b82f6" : "#ef4444";
    const headerTitle = isSubmitted ? "REVIEW SUBMISSION" : "URGENT REMINDER";

    const bodyContent = isSubmitted
      ? `<p>Hệ thống đã ghi nhận bản nộp của đội <strong>${teamName}</strong>. Tuy nhiên, Ban tổ chức khuyến nghị các bạn nên rà soát lại các file/đường link đã tải lên để đảm bảo Ban giám khảo có thể truy cập được.</p>
         <p>Bạn vẫn có thể cập nhật bài nộp của mình cho đến khi thời gian kết thúc.</p>`
      : `<p>Ban tổ chức nhận thấy đội <strong>${teamName}</strong> <span style="color: #ef4444; font-weight: bold;">VẪN CHƯA NỘP BÀI</span> cho vòng thi này.</p>
         <p>Vui lòng nhanh chóng hoàn thiện và nộp bài trước thời hạn. Các bài nộp muộn sẽ không được chấp nhận và có thể dẫn đến việc đội bạn bị loại khỏi cuộc thi.</p>`;

    try {
      const response = await this.mailerService.sendMail({
        to,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <div style="background-color: ${themeColor}; color: white; padding: 20px; text-align: center;">
              <h2 style="margin: 0; font-size: 24px; letter-spacing: 1px;">${headerTitle}</h2>
            </div>
            
            <div style="padding: 30px;">
              <p style="font-size: 16px; margin-top: 0;">Xin chào thành viên đội <strong>${teamName}</strong>,</p>
              
              ${bodyContent}
              
              <div style="background-color: #f9fafb; border-left: 4px solid ${themeColor}; padding: 15px; margin: 25px 0;">
                <p style="margin: 0 0 10px 0; font-size: 16px;"><strong>Hạn chót:</strong> ${deadline}</p>
                <p style="margin: 0; font-size: 16px;"><strong>Thời gian còn lại:</strong> ${timeRemaining}</p>
              </div>

              <div style="text-align: center; margin-top: 30px;">
                <a href="${actionUrl}" style="display: inline-block; background-color: ${themeColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  ĐI ĐẾN TRANG NỘP BÀI
                </a>
              </div>

              <div style="margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 20px; font-size: 14px; color: #6b7280;">
                <p style="margin: 0;">Nếu bạn cần hỗ trợ kỹ thuật, vui lòng liên hệ:</p>
                <p style="margin: 5px 0 0 0;"><strong>Email:</strong> support@seal.edu.vn</p>
              </div>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #9ca3af;">
              <p style="margin: 0;">Đây là email tự động từ hệ thống SEAL. Vui lòng không trả lời trực tiếp email này.</p>
            </div>
          </div>
        `,
      });

      this.logger.log(
        `Submission Reminder Email sent to ${to}, MessageID: ${response?.messageId}`,
      );
      return response;
    } catch (error) {
      this.logger.error(
        `Failed to send submission reminder email to ${to}`,
        error,
      );
    }
  }
}
