"use client";

import OverviewTab from "../tabs/OverviewTab";
import PrizesTab from "../tabs/PrizesTab";
import CriteriaTab from "../tabs/CriteriaTab";
import SubmitTab from "../tabs/SubmitTab";

interface TabsContentProps {
    activeTab: "overview" | "prizes" | "criteria" | "submit";
}

export default function TabsContent({ activeTab }: TabsContentProps) {
    // Helper function that returns the Component corresponding to the active Tab
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
        /* FIXED:
           - Changed 'px-4 md:px-0' to 'px-0' to eliminate double-padding issues, aligning tab content with the Tab Bar.
           - Added 'w-full overflow-hidden' to safely contain inner fadeIn effects without breaking the layout.
           - Adjusted spacing 'mt-2 md:mt-4' to bring content closer to the navigation bar for a seamless feel.
        */
        <div className="w-full px-0 pb-16 mt-2 md:mt-4 overflow-hidden text-foreground bg-transparent transition-colors duration-300">
            {renderContent()}
        </div>
    );
}