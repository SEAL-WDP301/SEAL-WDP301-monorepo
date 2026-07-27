"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

const steps = [
  {
    marker: "START",
    title: "Registration",
    description:
      "Create your SEAL profile, choose your track, and confirm eligibility before the event opens.",
  },
  {
    marker: "TEAM",
    title: "Team Formation",
    description:
      "Build a balanced team of makers, engineers, designers, and presenters ready for the hackathon sprint.",
  },
  {
    marker: "ROUND 1",
    title: "Qualification Round",
    description:
      "Submit your first prototype and receive the initial review that decides who advances to deeper rounds.",
  },
  {
    marker: "MENTOR",
    title: "Mentoring",
    description:
      "Work with mentors on architecture, product scope, code quality, pitching, and execution risks.",
  },
  {
    marker: "FINAL",
    title: "Final Round",
    description:
      "Present your complete solution to judges with a live demo, technical evidence, and product story.",
  },
  {
    marker: "AWARDS",
    title: "Awards Ceremony",
    description:
      "Celebrate winners, publish rankings, and turn the best projects into future opportunities.",
  },
];

export default function CompetitionFlowSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [maxTranslate, setMaxTranslate] = useState(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const x = useTransform(scrollYProgress, [0, 1], [0, -maxTranslate]);

  useEffect(() => {
    const updateMeasurements = () => {
      const viewportWidth = viewportRef.current?.clientWidth ?? 0;
      const trackWidth = trackRef.current?.scrollWidth ?? 0;
      setMaxTranslate(Math.max(trackWidth - viewportWidth, 0));
    };

    updateMeasurements();
    window.addEventListener("resize", updateMeasurements);
    return () => window.removeEventListener("resize", updateMeasurements);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#f9f5ec] text-[#111111] transition-colors duration-300 dark:bg-[#0f0d0b] dark:text-[#f5eee5]"
      style={{ height: `calc(100vh + ${maxTranslate}px)` }}
    >
      <div
        ref={viewportRef}
        className="sticky top-0 flex h-screen w-full flex-col justify-center overflow-hidden px-5 py-10 sm:px-8 lg:px-12"
      >
        <div className="mb-14 text-center">
          <h2 className="text-[clamp(3.4rem,9vw,8rem)] font-black leading-[0.85] tracking-normal text-[#111111] dark:text-[#f5eee5]">
            Competition Flow
          </h2>
        </div>

        <motion.div
          ref={trackRef}
          style={{ x }}
          className="flex w-max items-start gap-14 pr-[20vw] will-change-transform"
        >
          {steps.map((step, index) => (
            <article
              key={step.marker}
              className="relative w-[78vw] max-w-[470px] shrink-0 sm:w-[430px] lg:w-[520px]"
            >
              {index < steps.length - 1 ? (
                <FlowConnector />
              ) : null}

              <div className="relative">
                <FlowMarker label={step.marker} />
              </div>

              <h3 className="text-2xl font-black leading-none tracking-normal md:text-3xl">
                {step.title}
              </h3>
              <p className="mt-5 max-w-[390px] text-base font-black leading-tight text-[#73706c] dark:text-[#b3aaa1] md:text-lg">
                {step.description}
              </p>
            </article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FlowMarker({ label }: { label: string }) {
  return (
    <div className="relative mb-5 h-[138px] w-[250px]">
      <svg
        viewBox="0 0 250 138"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <path
          d="M22 78 C26 25 99 18 170 26 C226 33 237 60 218 94 C198 127 112 130 57 118 C21 110 10 95 22 78 Z"
          fill="none"
          stroke="#ff7300"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M174 25 C198 28 219 36 231 49"
          fill="none"
          stroke="#ff7300"
          strokeWidth="12"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pb-2">
        <span
          className={cn(
            "rotate-[-4deg] font-black leading-none tracking-normal text-[#111111] dark:text-[#f5eee5]",
            label.length > 6 ? "text-[1.85rem]" : "text-[2.45rem]",
          )}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

function FlowConnector() {
  return (
    <svg
      viewBox="0 0 300 165"
      className="pointer-events-none absolute left-[250px] top-[-18px] z-0 hidden h-[165px] w-[300px] overflow-visible lg:block"
      aria-hidden="true"
    >
      <path
        d="M0 96 C65 96 125 94 150 62 C171 35 168 8 144 8 C115 8 114 50 143 73 C178 101 224 98 253 98"
        fill="none"
        stroke="#ff7300"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M241 72 L284 98 L241 124"
        fill="none"
        stroke="#ff7300"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
