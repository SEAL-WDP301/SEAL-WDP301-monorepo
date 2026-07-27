"use client";

import OverviewTab from "../tabs/OverviewTab";
import PrizesTab from "../tabs/PrizesTab";
import CriteriaTab from "../tabs/CriteriaTab";
import SubmitTab from "../tabs/SubmitTab";

interface TabsContentProps {
    activeTab: "overview" | "prizes" | "criteria" | "submit";
}

export default function TabsContent({ activeTab }: TabsContentProps) {
    // Hàm helper trả về Component tương ứng với Tab đang được chọn
    const renderContent = () => {
        switch (activeTab) {
            case "overview":
                return <OverviewTab />;
            case "prizes":
                return <PrizesTab />;
            case "criteria":
                return <CriteriaTab />;
            case "submit":
                return <SubmitTab />;
            default:
                return null;
        }
    };

    return (
        /* ĐÃ SỬA: 
           - Thay đổi 'px-4 md:px-0' thành 'px-0' để triệt tiêu lỗi double-padding, giúp nội dung tab thẳng hàng tắp với thanh Tab Bar.
           - Thêm 'w-full overflow-hidden' để bao bọc an toàn cho các hiệu ứng fadeIn bên trong không làm nứt layout.
           - Điều chỉnh khoảng cách 'mt-2 md:mt-4' nhẹ nhàng để đẩy nội dung sát lại thanh điều hướng, tạo cảm giác liền mạch.
        */
        <div className="w-full px-0 pb-16 mt-2 md:mt-4 overflow-hidden text-foreground bg-transparent transition-colors duration-300">
            {renderContent()}
        </div>
    );
}