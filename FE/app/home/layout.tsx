import HomeHeader from "@/components/layout/dashboard/home-header";
import Footer from "@/components/layout/public/footer";
import { ProfileChecker } from "@/components/layout/public/profile-checker";

export default function HomeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <HomeHeader />

            <main>
                <ProfileChecker />
                {children}
            </main>

            <Footer />
        </div>
    );
}
