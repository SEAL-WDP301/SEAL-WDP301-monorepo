import Header from "@/components/layout/public/header";
import Footer from "@/components/layout/public/footer";
import { ProfileChecker } from "@/components/layout/public/profile-checker";

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header />

            <main>
                <ProfileChecker />
                {children}
            </main>

            <Footer />
        </div>
    );
}