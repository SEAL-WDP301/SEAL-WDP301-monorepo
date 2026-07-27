"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Banner from "./components/Banner";
import TabsContent from "./components/TabsContent";
import Sidebar from "./components/Sidebar";
import Header from "@/components/layout/public/header";

export default function EventPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "prizes" | "criteria" | "submit">("overview");

  useEffect(() => {
    const eventId = new URLSearchParams(window.location.search).get("id");
    if (eventId && /^\d+$/.test(eventId)) {
      router.replace(`/home/events/${eventId}`);
    }
  }, [router]);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "prizes", label: "Prizes" },
    { id: "criteria", label: "Judging Criteria" },
    { id: "submit", label: "How to Submit" },
  ] as const;

  return (
    // Đổi toàn bộ màu nền sang Đen gỗ ấm đặc trưng: bg-[#120F0E] 
    // Thay đổi toàn bộ font chữ mặc định thành font-bold/font-black dầy cộm
    <div
      className="relative min-h-screen bg-background text-foreground py-16 px-6 sm:px-12 lg:px-16 transition-colors"
    >
      <div className="mx-auto max-w-[1400px] w-full px-4 sm:px-6 lg:px-8 sticky top-0">
        <Header />
      </div>

      {/* Khối Banner phía trên - Cho rộng tối đa max-w-[1400px] */}
      <div className="mx-auto max-w-[1400px]">
        <Banner />
      </div>

      {/* Grid nội dung chính bung rộng tối đa (max-w-[1400px]) và tăng khoảng cách gap-12 */}
      <div className="mx-auto max-w-[1400px] mt-12 grid gap-12 lg:grid-cols-[1fr_420px] items-start">

        {/* Cột trái: Tab Bar & Chi tiết nội dung */}
        <main className="space-y-10 w-full">

          {/* Thanh Tab Navigation - Size chữ đẩy lên text-lg, font-black siêu dày */}
          <div
            className="sticky top-0 z-20 flex gap-4 overflow-x-auto border-b border-border bg-background/95 pb-4 backdrop-blur-md scrollbar-none"
          >
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                variant={activeTab === tab.id ? "eventTabActive" : "eventTab"}
                size="eventTab"
                // Thu nhỏ font-size một chút trên mobile (text-sm md:text-base) để các tab vừa vặn tầm mắt
                className="font-black duration-150 text-sm md:text-base flex-shrink-0"
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Nội dung động của Tab */}
          <div className="w-full min-w-0">
            <TabsContent activeTab={activeTab} />
          </div>

        </main>

        {/* Cột phải: Sidebar (Countdown + Thông số) */}
        {/* Khi ở mobile, khối này sẽ tự động xếp hàng rơi xuống dưới cùng của cột trái nhờ cơ chế Grid hệ thống */}
        <div className="w-full">
          <Sidebar />
        </div>

      </div>
    </div>
  );
}
