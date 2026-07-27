import FeaturedHero from "@/components/home/featured-hero";
import PastEvents from "@/components/home/past-events";

export default function HomePage() {
    return (
        <div className="flex flex-col min-h-screen bg-background">
            <FeaturedHero />
            <PastEvents />
        </div>
    );
}
