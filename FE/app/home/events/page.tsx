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
    // Change the entire background color to characteristic warm wood black: bg-[#120F0E] 
    // Change the default font to chunky font-bold/font-black
    <div
      className="relative min-h-screen bg-background text-foreground py-16 px-6 sm:px-12 lg:px-16 transition-colors"
    >
      <div className="mx-auto max-w-[1400px] w-full px-4 sm:px-6 lg:px-8 sticky top-0">
        <Header />
      </div>

      {/* Top Banner block - Max width max-w-[1400px] */}
      <div className="mx-auto max-w-[1400px]">
        <Banner />
      </div>

      {/* Main content grid expands to max width (max-w-[1400px]) and increases gap to gap-12 */}
      <div className="mx-auto max-w-[1400px] mt-12 grid gap-12 lg:grid-cols-[1fr_420px] items-start">

        {/* Left column: Tab Bar & Content Details */}
        <main className="space-y-10 w-full">

          {/* Tab Navigation bar - Text size pushed up to text-lg, ultra-thick font-black */}
          <div
            className="sticky top-0 z-20 flex gap-4 overflow-x-auto border-b border-border bg-background/95 pb-4 backdrop-blur-md scrollbar-none"
          >
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                variant={activeTab === tab.id ? "eventTabActive" : "eventTab"}
                size="eventTab"
                // Slightly reduce font size on mobile (text-sm md:text-base) to fit tabs comfortably
                className="font-black duration-150 text-sm md:text-base flex-shrink-0"
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Dynamic Tab content */}
          <div className="w-full min-w-0">
            <TabsContent activeTab={activeTab} />
          </div>

        </main>

        {/* Right column: Sidebar (Countdown + Metrics) */}
        {/* On mobile, this block will automatically drop to the bottom of the left column due to the Grid system */}
        <div className="w-full">
          <Sidebar />
        </div>

      </div>
    </div>
  );
}
