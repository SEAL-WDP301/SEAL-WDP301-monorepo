import OverviewTab from "./tabs/OverviewTab";
import PrizesTab from "./tabs/PrizesTab";
import CriteriaTab from "./tabs/CriteriaTab";
import SubmitTab from "./tabs/SubmitTab";

interface TabsContentProps {
    activeTab: "overview" | "prizes" | "criteria" | "submit";
}

export default function TabsContent({ activeTab }: TabsContentProps) {
    // Hàm helper để bọc layout chuẩn Responsive cho tất cả các Tab con
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
       
        <div className="w-full px-4 md:px-0 pb-16 mt-6 md:mt-8">
            {renderContent()}
        </div>
    );
}