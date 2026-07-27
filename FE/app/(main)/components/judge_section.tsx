import Image from "next/image";

type Stakeholder = {
  name: string;
  title: string;
  image: string;
};

const stakeholders: Stakeholder[] = [
  {
    name: "Dr. Linh Nguyen, PhD",
    title: "AI research advisor and former principal scientist for applied machine learning systems.",
    image:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?crop=faces&cs=tinysrgb&fit=crop&fm=jpg&h=720&q=85&w=720",
  },
  {
    name: "Andrew Tran, PhD",
    title: "Professor of software architecture and mentor for distributed engineering teams.",
    image:
      "https://images.unsplash.com/photo-1560250097-0b93528c311a?crop=faces&cs=tinysrgb&fit=crop&fm=jpg&h=720&q=85&w=720",
  },
  {
    name: "Toby Pham, M.Sc.",
    title: "Former CTO and product engineering leader for large-scale cloud platforms.",
    image:
      "https://images.unsplash.com/photo-1556157382-97eda2d62296?crop=faces&cs=tinysrgb&fit=crop&fm=jpg&h=720&q=85&w=720",
  },
  {
    name: "Daniel Hoang, PhD",
    title: "Innovation lead specializing in secure systems, data platforms, and startup validation.",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=faces&cs=tinysrgb&fit=crop&fm=jpg&h=720&q=85&w=720",
  },
  {
    name: "Priya Raman, MBA",
    title: "Venture partner and go-to-market coach for early-stage technology teams.",
    image:
      "https://images.unsplash.com/photo-1573496799652-408c2ac9fe98?crop=faces&cs=tinysrgb&fit=crop&fm=jpg&h=720&q=85&w=720",
  },
  {
    name: "Kevin Le, M.Eng.",
    title: "Engineering director focused on developer tooling, DevOps, and delivery excellence.",
    image:
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?crop=faces&cs=tinysrgb&fit=crop&fm=jpg&h=720&q=85&w=720",
  },
  {
    name: "Marcus Adler, PhD",
    title: "Data science reviewer guiding evidence-based scoring and technical feasibility.",
    image:
      "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?crop=faces&cs=tinysrgb&fit=crop&fm=jpg&h=720&q=85&w=720",
  },
  {
    name: "Robert Stein, M.S.",
    title: "Senior architect and mentor for cloud-native product design and team leadership.",
    image:
      "https://images.unsplash.com/photo-1566492031773-4f4e44671857?crop=faces&cs=tinysrgb&fit=crop&fm=jpg&h=720&q=85&w=720",
  },
];

export default function JudgesSection() {
  return (
    <section className="bg-[#fff9ef] px-5 py-20 text-[#2d2b2a] transition-colors duration-300 dark:bg-[#0f0d0b] dark:text-[#f5eee5] sm:px-8 lg:px-12 lg:py-24">
      <div className="mx-auto max-w-[1440px]">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="font-serif text-[clamp(3rem,7vw,6.5rem)] font-normal leading-[0.95] tracking-normal text-[#252321] dark:text-[#f6efe6]">
            Built with SEAL&apos;s{" "}
            <span className="italic text-[#b26042] dark:text-[#ff9d72]">top stakeholders</span>
          </h2>
          <p className="mt-7 text-xl font-medium text-[#3f3a36] dark:text-[#d8cfc4] md:text-2xl">
            SEAL&apos;s Mentor, Judge & Scientific Board
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 justify-items-center gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
          {stakeholders.map((person) => (
            <article key={person.name} className="group w-full max-w-[260px]">
              <div className="relative aspect-square overflow-hidden rounded-xl bg-[#eee4d8] shadow-[0_18px_45px_rgba(82,55,34,0.12)] ring-1 ring-black/5 dark:bg-[#211b17] dark:shadow-[0_18px_45px_rgba(0,0,0,0.35)] dark:ring-white/10">
                <Image
                  src={person.image}
                  alt={person.name}
                  fill
                  sizes="(min-width: 1024px) 260px, (min-width: 640px) 260px, 78vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>

              <h3 className="mt-4 text-lg font-extrabold leading-tight tracking-normal text-[#2f2d2c] dark:text-[#f5eee5] md:text-xl">
                {person.name}
              </h3>
              <p className="mt-2 text-base font-medium leading-snug text-[#4f4842] dark:text-[#c8bdb1]">
                {person.title}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
