# SEAL – Software Engineering Hackathon Management System

## 1. Project Overview (Tổng quan dự án)
**Tên tiếng Việt:** Hệ thống quản lý cuộc thi SEAL Hackathon ngành Kỹ thuật Phần mềm.
**Tên tiếng Anh:** SEAL – Software Engineering Hackathon Management System

"Software Engineering Agile League (SEAL)" là cuộc thi hackathon học thuật thường niên do Khoa Kỹ thuật Phần mềm phối hợp với PDP tổ chức tại Trường Đại học FPT TP.HCM. Mỗi năm, SEAL tổ chức ba sự kiện hackathon tương ứng với ba học kỳ (Spring, Summer, Fall).
Mỗi sự kiện hackathon có thể bao gồm nhiều vòng thi (ví dụ: Vòng sơ khảo và Vòng chung kết).

Các sự kiện SEAL mở cửa cho nhiều trường đại học cùng tham gia: đội thi có thể gồm toàn sinh viên FPT, hỗn hợp sinh viên FPT và sinh viên ngoài trường, hoặc toàn sinh viên từ các trường đối tác.

Hiện tại, công tác quản lý sự kiện chủ yếu được thực hiện thủ công, dễ xảy ra sai sót và thiếu minh bạch. Bên cạnh việc phát triển hệ thống quản lý, đề tài còn nghiên cứu tính nhất quán trong chấm điểm của giám khảo tại các cuộc thi hackathon - một yếu tố quan trọng nhưng chưa được nghiên cứu đầy đủ liên quan đến sự công bằng trong thi cử. Hệ thống đóng vai trò vừa là nền tảng quản lý cuộc thi, vừa là công cụ thu thập dữ liệu cho nghiên cứu về độ tin cậy liên đánh giá viên trong đánh giá kỹ thuật phần mềm.

## 2. Vấn đề hiện tại (Current Problems)
Quy trình quản lý sự kiện hiện tại đang tồn tại nhiều vấn đề:
- **Đăng ký và Quản lý thủ công:** Đăng ký đội thi và quản lý hạng mục thực hiện thủ công dẫn đến chậm trễ và sai sót dữ liệu.
- **Quy trình chấm điểm phân mảnh:** Chấm điểm thực hiện qua file Excel riêng lẻ của từng giám khảo; phải thu thập và nhập lại toàn bộ kết quả thủ công, dẫn đến chậm trễ và dễ xảy ra sai sót.
- **Giao tiếp hạn chế:** Kênh thông tin liên lạc hạn chế giữa ban tổ chức, mentor, đội thi và người tham gia.
- **Thiếu tính minh bạch:** Không có nhật ký kiểm tra cho các quyết định chấm điểm, làm giảm tính minh bạch và độ tin cậy của kết quả.

## 3. Đối tượng người dùng (Actors)
- Team Member (Thành viên đội thi)
- Team Leader (Trưởng đội thi)
- Mentor (Người hướng dẫn)
- Judge (Giám khảo - Nội bộ hoặc Khách mời)
- Event Coordinator (Điều phối viên sự kiện - SE Dept / PDP Staff)

## 4. Chức năng chính (Main Features)

### 4.1. Quản lý sự kiện & Vòng thi (Event & Round Management)
- Tạo và quản lý sự kiện hackathon.
- Cấu hình nhiều vòng thi trong mỗi sự kiện (ví dụ: Vòng loại và Vòng chung kết).
- Thiết lập cho từng vòng: hạn nộp bài, phân công giám khảo và tiêu chí chấm điểm.
- Định nghĩa quy tắc thăng vòng: top N đội mỗi Hạng mục sẽ vào vòng tiếp theo.

### 4.2. Quản lý tiêu chí chấm điểm (Criteria Management)
- Duy trì mẫu tiêu chí mặc định (dùng lại qua các sự kiện).
- Mỗi sự kiện kế thừa mẫu và có thể thêm, bỏ hoặc điều chỉnh tiêu chí và trọng số.

### 4.3. Quản lý hạng mục (Track Management)
- Tạo Hạng mục (danh mục thi đấu) trong mỗi sự kiện.
- Phân công Mentor cho Hạng mục (một giảng viên có thể làm Mentor một Hạng mục và Giám khảo Hạng mục khác trong cùng sự kiện).

### 4.4. Quản lý đội thi (Team Management)
- Thành lập đội (3–5 Thành viên).
- Đăng ký đội vào một Hạng mục cụ thể.

### 4.5. Đăng ký & Xác thực người dùng (Auth & User Management)
- Tất cả người tham gia sử dụng Email/Mật khẩu với JWT.
- Phân loại người tham gia khi đăng ký:
  - Sinh viên FPT (cung cấp mã số SV FPT).
  - Sinh viên ngoài trường (cung cấp mã số SV + tên trường).
- Tất cả tài khoản cần Ban tổ chức phê duyệt trước khi được tham gia thi.
- Giám khảo khách mời: tài khoản tạm thời do Ban tổ chức tạo, chỉ có quyền chấm điểm cho các vòng được phân công.

### 4.6. Nộp bài (Submission)
- Đội nộp bài theo từng vòng bằng cách cung cấp các đường dẫn URL (repository dự án, demo, link báo cáo/slide).
- Tích hợp GitHub/GitLab API để tự động lấy metadata repository (Optional).

### 4.7. Đánh giá (Evaluation)
- Giám khảo chấm điểm theo tiêu chí của từng sự kiện; điểm số từng tiêu chí của từng giám khảo được ghi lại riêng biệt.
- Ban tổ chức phân công Giám khảo nội bộ và Giám khảo khách mời vào các vòng theo nhu cầu.

### 4.8. Chấm điểm, Xếp hạng & Loại (Scoring, Ranking & Elimination)
- Tự động xếp hạng đội theo từng vòng, từng Hạng mục và toàn bộ sự kiện.
- Tính toán thăng vòng: hệ thống xác định đội đủ điều kiện vào vòng tiếp theo.
- Loại: Ban tổ chức có thể loại đội/bài nộp vi phạm quy chế (kết quả bị hủy và ghi lại lý do).
- Nhật ký kiểm tra (Audit log) cho tất cả hành động chấm điểm và loại bỏ.

### 4.9. Thu thập dữ liệu nghiên cứu (RBL Direction)
- Ghi lại điểm số của từng giám khảo theo từng tiêu chí cho từng bài nộp (không gộp chung).
- Vòng hiệu chuẩn: giám khảo chấm bài mẫu; hệ thống hiển thị phân bố điểm để hỗ trợ đồng thuận giữa các giám khảo.
- Xuất bộ dữ liệu chấm điểm đã ẩn danh (CSV) để phân tích độ tin cậy liên đánh giá viên.
- Dashboard: hiển thị phương sai điểm giữa các giám khảo theo từng tiêu chí. *(Nhóm SV làm thêm tính năng này thì được cộng điểm)*

### 4.10. Giải thưởng (Prizes)
- Trao giải dựa trên kết quả xếp hạng.
- Thông báo và công bố kết quả đến tất cả người tham gia.
- Xếp hạng và báo cáo điểm xuất được dưới dạng CSV/Excel.

## 5. Các thực thể cốt lõi (Key Entities)
- **Hackathon Event**: Sự kiện Hackathon
- **Track**: Hạng mục thi đấu (ví dụ: AI, Web, Mobile...)
- **Round**: Vòng thi trong sự kiện (Vòng loại, Chung kết...)
- **Team**: Đội thi
- **Team Member**: Thành viên đội
- **Mentor**: Người hướng dẫn
- **Judge**: Giám khảo (Nội bộ / Khách mời)
- **Submission**: Bài nộp
- **Score/Ranking**: Điểm số / Xếp hạng
- **Prize**: Giải thưởng

## 6. Câu hỏi nghiên cứu (Research Questions - RQ)
**Câu hỏi chính (Main RQ):** How consistent are hackathon evaluation scores across different judges evaluating the same submission in academic software engineering competitions?

**Câu hỏi phụ (Sub-RQs):**
- **RQ1:** What is the overall inter-rater reliability (ICC, Krippendorff's α) of SEAL hackathon scoring?
- **RQ2:** Which scoring criteria show the highest and lowest inter-rater agreement (Technical criteria vs. Soft/subjective criteria)?
- **RQ3:** Does judge type (SE Faculty vs. Guest Judge) affect scoring consistency?
