import { MailerService } from "@nestjs-modules/mailer";
import { MailService } from "./mail.service";

describe("MailService team invitation", () => {
  const mailerService = { sendMail: jest.fn() };
  const service = new MailService(mailerService as unknown as MailerService);

  beforeEach(() => {
    jest.clearAllMocks();
    mailerService.sendMail.mockResolvedValue({ messageId: "message-1" });
  });

  it("sends a complete invitation email with a safe action link", async () => {
    await service.sendTeamInvitationEmail({
      to: "student@example.com",
      teamName: '<script>alert("x")</script>',
      eventName: "SEAL 2026",
      trackName: "AI Track",
      leaderName: "John Tran",
      invitationUrl: "https://seal.example/team-invitations/token-123",
      expiresAt: new Date("2026-08-03T12:00:00.000Z"),
    });

    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "student@example.com",
        subject: expect.stringContaining("SEAL"),
        text: expect.stringContaining(
          "https://seal.example/team-invitations/token-123",
        ),
        html: expect.stringContaining(
          'href="https://seal.example/team-invitations/token-123"',
        ),
      }),
    );
    const email = mailerService.sendMail.mock.calls[0][0];
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain('<script>alert("x")</script>');
  });
});
