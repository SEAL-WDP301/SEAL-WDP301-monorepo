import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Role } from "@prisma/client";
import * as bcrypt from "bcrypt";

@Injectable()
export class MockStakeholdersService {
  constructor(private readonly prisma: PrismaService) {}

  async run() {
    console.log("--- Starting Mock Stakeholders Seeding ---");

    const hashedPassword = await bcrypt.hash("12345678", 10);

    const stakeholdersData = [
      {
        name: "Lê Văn An",
        email: "mentorC@gmail.com",
        jobTitle: "Senior Solution Architect",
        organization: "FPT Software",
        experience:
          "15 năm kinh nghiệm thiết kế hệ thống phân tán và Cloud Computing. Từng dẫn dắt nhiều dự án chuyển đổi số lớn cho các tập đoàn quốc tế.",
        achievements:
          "- Kiến trúc sư trưởng dự án AKA Bot\n- AWS Certified Solutions Architect Professional\n- Google Cloud Professional Architect",
        bio: "Đam mê khám phá các công nghệ mới, thích chia sẻ kiến thức kiến trúc phần mềm với cộng đồng lập trình viên trẻ và sinh viên IT.",
      },
      {
        name: "Trần Bích Ngọc",
        email: "mentorD@gmail.com",
        jobTitle: "Senior Product Manager",
        organization: "VNG Corporation",
        experience:
          "10 năm làm việc trong lĩnh vực phát triển sản phẩm công nghệ, đặc biệt là các ứng dụng giải trí và thanh toán trực tuyến.",
        achievements:
          "- Quản lý thành công 2 sản phẩm lọt top 10 App Store Việt Nam\n- Giải thưởng Product Manager of the year 2023",
        bio: "Luôn đặt trải nghiệm người dùng lên hàng đầu. Sẵn sàng trở thành Mentor định hướng phát triển sản phẩm cho các đội thi.",
      },
      {
        name: "Phạm Hoàng Long",
        email: "mentorE@gmail.com",
        jobTitle: "Engineering Tech Lead",
        organization: "MoMo (M_Service)",
        experience:
          "8 năm xây dựng các hệ thống Core Banking và E-Wallet chịu tải cao (High Concurrency).",
        achievements:
          "- Tối ưu hóa hệ thống xử lý giao dịch chịu tải lên đến 10,000 TPS\n- Tác giả của thư viện mã nguồn mở có 2000+ stars trên Github",
        bio: "Code is poetry. Rất vui được đồng hành và hướng dẫn các bạn sinh viên vượt qua các giới hạn kỹ thuật trong Hackathon.",
      },
      {
        name: "Nguyễn Minh Tuấn",
        email: "mentorF@gmail.com",
        jobTitle: "Cybersecurity Expert",
        organization: "Viettel Cyber Security",
        experience:
          "12 năm kinh nghiệm trong lĩnh vực bảo mật thông tin, kiểm thử xâm nhập (PenTest) và rà soát lỗ hổng phần mềm.",
        achievements:
          "- Phát hiện hơn 50 lỗ hổng Zero-day\n- Top 100 Bug Bounty Hacker trên HackerOne",
        bio: "Bảo mật không phải là tính năng bổ sung, mà là cốt lõi của mọi ứng dụng. Hy vọng giúp các đội xây dựng những hệ thống an toàn nhất.",
      },
      {
        name: "Hoàng Thị Mai",
        email: "mentorG@gmail.com",
        jobTitle: "Principal Data Scientist",
        organization: "Shopee Vietnam",
        experience:
          "7 năm làm việc với Dữ liệu lớn (Big Data), Xây dựng các mô hình Recommendation System và AI dự đoán người dùng.",
        achievements:
          "- Tăng 25% tỷ lệ chuyển đổi (CR) nhờ mô hình gợi ý sản phẩm\n- Xuất bản 3 bài báo khoa học quốc tế về Machine Learning",
        bio: "Data is the new oil. Tôi mong muốn chia sẻ góc nhìn về việc khai thác và ứng dụng dữ liệu để tạo ra những sản phẩm AI có ích.",
      },
      {
        name: "Đặng Quang Huy",
        email: "judgeA@gmail.com",
        jobTitle: "Lead AI Engineer",
        organization: "VNPT AI",
        experience:
          "9 năm nghiên cứu và triển khai các hệ thống Computer Vision, NLP phục vụ nhận diện khuôn mặt và trợ lý ảo tiếng Việt.",
        achievements:
          "- Xây dựng core AI cho hệ thống eKYC hàng đầu Việt Nam\n- Giải nhất cuộc thi AI Challenge 2021",
        bio: "Trí tuệ nhân tạo đang thay đổi thế giới. Rất háo hức xem các bạn trẻ sáng tạo gì với GenAI trong thời gian tới.",
      },
      {
        name: "Ngô Thanh Hải",
        email: "judgeB@gmail.com",
        jobTitle: "Senior Backend Engineer",
        organization: "ZaloPay",
        experience:
          "6 năm lập trình Golang, Java, làm việc chuyên sâu với Microservices, Kafka, Redis và gRPC.",
        achievements:
          "- Tham gia xây dựng hệ thống Campaign có thể xử lý hàng triệu user cùng lúc vào các dịp Lễ Tết.",
        bio: "Yêu thích sự hoàn hảo trong từng dòng code. Rất sẵn lòng giúp đỡ các đội thiết kế Database và API tối ưu nhất.",
      },
      {
        name: "Vũ Đức Trí",
        email: "judgeC@gmail.com",
        jobTitle: "Cloud & DevOps Lead",
        organization: "FPT Telecom",
        experience:
          "11 năm kinh nghiệm quản trị hạ tầng server, triển khai CI/CD pipelines và quản lý hệ thống Kubernetes.",
        achievements:
          "- Triển khai toàn bộ hạ tầng K8s nội bộ phục vụ hàng nghìn dự án lớn nhỏ\n- CKA & CKS Certified",
        bio: "DevOps là chìa khóa để triển khai sản phẩm nhanh và ổn định. Các team cần hỗ trợ deploy hãy tìm tôi nhé!",
      },
      {
        name: "Đỗ Phương Thảo",
        email: "judgeD@gmail.com",
        jobTitle: "QA Manager",
        organization: "VNPAY",
        experience:
          "10 năm làm việc trong lĩnh vực Đảm bảo chất lượng (QA), chuyên gia về Automation Testing và Performance Testing.",
        achievements:
          "- Xây dựng Automation framework giúp giảm 60% thời gian Regression Test\n- Đạt chứng chỉ ISTQB Advanced Level",
        bio: "Chất lượng là danh dự của lập trình viên. Đừng quên viết test cho hệ thống của bạn!",
      },
      {
        name: "Bùi Ngọc Anh",
        email: "judgeE@gmail.com",
        jobTitle: "Scrum Master / Agile Coach",
        organization: "Sun* (Sun Asterisk)",
        experience:
          "8 năm quản lý các dự án phần mềm theo mô hình Agile/Scrum. Chuyên gia tư vấn quy trình phát triển sản phẩm linh hoạt.",
        achievements:
          "- Transform thành công quy trình Agile cho 3 tập đoàn lớn\n- Professional Scrum Master II (PSM II)",
        bio: "Cách làm việc nhóm quyết định 50% thành bại của một đội Hackathon. Hãy làm việc thông minh và có chiến lược.",
      },
    ];

    let count = 0;
    for (const st of stakeholdersData) {
      const existing = await this.prisma.user.findUnique({
        where: { email: st.email },
        include: { stakeholderProfile: true },
      });
      if (!existing) {
        await this.prisma.user.create({
          data: {
            email: st.email,
            name: st.name,
            passwordHash: hashedPassword,
            role: Role.stakeholder,
            isActive: true,
            stakeholderProfile: {
              create: {
                jobTitle: st.jobTitle,
                organization: st.organization,
                experience: st.experience,
                achievements: st.achievements,
                bio: st.bio,
                isPublic: true,
              },
            },
          },
        });
        count++;
        console.log(
          `[Stakeholder] Created: ${st.name} - ${st.jobTitle} at ${st.organization}`,
        );
      } else {
        await this.prisma.stakeholderProfile.upsert({
          where: { userId: existing.id },
          create: {
            userId: existing.id,
            jobTitle: st.jobTitle,
            organization: st.organization,
            experience: st.experience,
            achievements: st.achievements,
            bio: st.bio,
            isPublic: true,
          },
          update: {
            jobTitle: st.jobTitle,
            organization: st.organization,
            experience: st.experience,
            achievements: st.achievements,
            bio: st.bio,
          },
        });
        count++;
        console.log(`[Stakeholder] Upserted profile for: ${st.email}`);
      }
    }

    console.log(
      `--- Mock Stakeholders Seeding Completed: ${count} users created ---`,
    );
  }
}
