"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

import Header from "@/components/layout/public/header";
import Banner from "./components/ui/Banner";
import TabsContent from "./components/ui/TabsContent";
import Sidebar from "./components/ui/Sidebar";

export default function EventPage() {
    const [activeTab, setActiveTab] = useState<"overview" | "prizes" | "criteria" | "submit">("overview");

    const tabs = [
        { id: "overview", label: "Overview" },
        { id: "prizes", label: "Prizes" },
        { id: "criteria", label: "Judging Criteria" },
        { id: "submit", label: "How to Submit" },
    ] as const;

    return (
        /* Smooth background that adapts to the theme system */
        <div className="relative min-h-screen w-full text-foreground bg-background transition-colors duration-300 antialiased tracking-tight">

            {/* HEADER AREA */}
            <div className="z-50 mx-auto max-w-[1400px] w-full px-4 sm:px-6 lg:px-8 sticky top-0">
                <Header />
            </div>

            {/* BANNER AREA */}
            <div className="w-full mt-4">
                <Banner />
            </div>

            {/* MAIN CONTENT GRID */}
            <main className="container mx-auto max-w-[1400px] w-full px-4 sm:px-6 lg:px-8 mt-6 md:mt-12">
                <div className="grid gap-6 md:gap-12 grid-cols-1 lg:grid-cols-[1fr_420px] items-start w-full">

                    {/* Left column: Tab Bar & Content details */}
                    <div className="space-y-6 md:space-y-10 w-full min-w-0">

                        {/* Tab Navigation Bar */}
                        <div className="flex items-center border-b border-border/60 overflow-x-auto whitespace-nowrap scrollbar-none sticky top-16 md:top-20 bg-background/95 backdrop-blur-md z-20 py-3 md:pb-4 gap-2 md:gap-4 w-full transition-colors duration-300">
                            {tabs.map((tab) => {
                                const isActive = activeTab === tab.id;

                                return (
                                    <Button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        /* FIXED: Switched variant to ghost and dynamically assigns classes based on isActive
                                           - When active in Light Mode: Light orange bg-[#FF6B2C]/10, brand orange text text-[#FF6B2C].
                                           - When active in Dark Mode: Switches to crisp white background, bold black text.
                                        */
                                        variant="ghost"
                                        className={`font-black duration-200 text-sm md:text-base flex-shrink-0 px-5 py-2.5 rounded-full transition-all border outline-none
                      ${isActive
                                                ? "bg-[#FF6B2C]/10 text-[#FF6B2C] border-[#FF6B2C]/20 dark:bg-white dark:text-zinc-950 dark:border-transparent shadow-sm"
                                                : "text-muted-foreground hover:text-foreground bg-transparent border-transparent"
                                            }`}
                                    >
                                        {tab.label}
                                    </Button>
                                );
                            })}
                        </div>

                        {/* Dynamic tab content */}
                        <div className="w-full min-w-0">
                            <TabsContent activeTab={activeTab} />
                        </div>
                    </div>

                    {/* Right column: Sidebar (Countdown + Stats) */}
                    <aside className="w-full self-start sticky top-24">
                        <Sidebar />
                    </aside>

                </div>
            </main>
        </div>
    );
}