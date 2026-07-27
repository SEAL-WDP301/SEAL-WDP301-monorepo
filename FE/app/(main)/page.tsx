import HeroSection from "./components/hero_section";
import StatsSection from "./components/stats_section";
import AboutSealSection from "./components/about_section";
import CategoriesSection from "./components/categories_section";
import FAQSection from "./components/FAQ_section";
import CompetitionFlowSection from "./components/flow_section";
import JudgesSection from "./components/judge_section";
import { ScrollReveal } from "./components/scroll_reveal";

export default function Home() {
  return (
    <div>
      <HeroSection />
      <ScrollReveal>
        <StatsSection />
      </ScrollReveal>
      <section id="about">
        <ScrollReveal>
          <AboutSealSection />
        </ScrollReveal>
      </section>
      <CompetitionFlowSection />
      <section id="categories">
        <ScrollReveal>
          <CategoriesSection />
        </ScrollReveal>
      </section>
      <section id="stakeholder">
        <ScrollReveal y={40}>
          <JudgesSection />
        </ScrollReveal>
      </section>
      <section id="FAQ">
        <ScrollReveal>
          <FAQSection />
        </ScrollReveal>
      </section>
    </div>
  );
}
