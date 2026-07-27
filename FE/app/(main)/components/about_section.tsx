"use client";

import { motion } from "framer-motion";
import { Award, Building2, Target, Users } from "lucide-react";

const threadItems = [
  {
    icon: Building2,
    title: "University collaboration",
    description:
      "Organized by the Software Engineering Department with PDP at FPT University HCMC.",
    position: "top",
  },
  {
    icon: Users,
    title: "Multi-university",
    description:
      "Open to FPT teams, mixed teams, and partner university teams nationwide.",
    position: "bottom",
  },
  {
    icon: Target,
    title: "Multiple rounds",
    description: "Qualification, Semi-final, and Final - each stage raises the bar.",
    position: "top",
  },
  {
    icon: Award,
    title: "Industry recognition",
    description: "Gain exposure to tech companies and build your professional network.",
    position: "bottom",
  },
];

export default function AboutSealSection() {
  return (
    <section
      className="relative overflow-hidden bg-[#fff8ec] px-5 py-20 text-[#1e1712] [--seal-node-bg:#fff8ec] [--seal-node-ring:#fff8ec] [--seal-satellite-stroke:#ff7a1a] [--seal-thread:rgba(180,82,12,0.32)] dark:bg-[#0a0806] dark:text-[#f5f2ec] dark:[--seal-node-bg:#14100c] dark:[--seal-node-ring:#0a0806] dark:[--seal-satellite-stroke:#ff9a3c] dark:[--seal-thread:rgba(255,154,60,0.24)] sm:px-8 lg:px-12 lg:py-24"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,154,60,0.22),transparent_28%),radial-gradient(circle_at_78%_28%,rgba(255,106,26,0.16),transparent_30%)] dark:bg-[radial-gradient(circle_at_18%_18%,rgba(255,154,60,0.1),transparent_28%),radial-gradient(circle_at_78%_28%,rgba(255,106,26,0.08),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,122,26,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,122,26,0.06)_1px,transparent_1px)] bg-[size:48px_48px] dark:bg-[linear-gradient(rgba(255,122,26,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,122,26,0.025)_1px,transparent_1px)]" />
      <div className="relative mx-auto max-w-[1360px]">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#ff9a3c] px-4 py-2 text-sm font-semibold text-[#ff9a3c]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff9a3c] shadow-[0_0_10px_#ff9a3c]" />
              About SEAL
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
              className="max-w-3xl text-[clamp(2.5rem,5vw,4.5rem)] font-extrabold leading-[1.06] tracking-normal text-[#1e1712] dark:text-[#f5f2ec]"
            >
              Software Engineering{" "}
              <span className="animate-[seal-shine_5s_linear_infinite] bg-[linear-gradient(120deg,#ff9a3c,#ff6a1a,#ff9a3c)] bg-[length:200%_auto] bg-clip-text text-transparent">
                Excellence
              </span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
              className="mt-6 max-w-[46ch] text-lg leading-[1.65] text-[#6f6258] dark:text-[#a39c8f]"
            >
              SEAL (Software Engineering Agile League) is an annual academic hackathon
              series that brings together talented students from FPT University and
              partner institutions to tackle real-world software engineering challenges
              through innovation and collaboration.
            </motion.p>
          </div>

          <HubGraphic />
        </div>

        <ThreadTimeline />
      </div>
    </section>
  );
}

function HubGraphic() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: false, amount: 0.35 }}
      transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
      className="relative mx-auto aspect-square w-full max-w-[420px]"
    >
      <svg viewBox="0 0 400 400" className="h-full w-full overflow-visible">
        <defs>
          <radialGradient id="sealCoreGrad" cx="35%" cy="30%">
            <stop offset="0%" stopColor="#ffb45c" />
            <stop offset="100%" stopColor="#ff6a1a" />
          </radialGradient>
        </defs>

        {[
          ["200", "200", "340", "200"],
          ["200", "200", "243", "333"],
          ["200", "200", "87", "282"],
          ["200", "200", "87", "118"],
          ["200", "200", "243", "67"],
        ].map(([x1, y1, x2, y2]) => (
          <motion.line
            key={`${x2}-${y2}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            fill="none"
            stroke="var(--seal-thread)"
            strokeWidth="1.4"
            strokeDasharray="6 6"
            animate={{ strokeDashoffset: -60 }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
          />
        ))}

        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 200 200"
            to="360 200 200"
            dur="14s"
            repeatCount="indefinite"
          />
          {[
            [340, 200],
            [243, 333],
            [87, 282],
            [87, 118],
            [243, 67],
          ].map(([x, y]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
              <circle r="16" fill="var(--seal-node-bg)" stroke="var(--seal-satellite-stroke)" strokeWidth="1.9" />
              <circle r="5" fill="#ff9a3c" />
            </g>
          ))}
        </g>

        <motion.circle
          cx="200"
          cy="200"
          fill="url(#sealCoreGrad)"
          filter="drop-shadow(0 0 22px rgba(255,122,26,0.35))"
          animate={{ r: [34, 38, 34] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <text
          x="200"
          y="204"
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fill="#1a0e04"
        >
          SEAL
        </text>
        <text
          x="200"
          y="240"
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fill="currentColor"
          className="text-[#6f6258] dark:text-[#6f685c]"
        >
          20+ partner universities
        </text>
      </svg>
    </motion.div>
  );
}

function ThreadTimeline() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: false, amount: 0.35 }}
      className="relative mt-14 grid grid-cols-1 gap-9 py-5 md:mt-16 md:grid-cols-4 md:grid-rows-[auto_64px_auto] md:gap-0 md:py-16"
    >
      <motion.div
        variants={{
          hidden: { scaleX: 0 },
          visible: { scaleX: 1 },
        }}
        transition={{ duration: 1.4, ease: [0.22, 0.61, 0.36, 1] }}
        className="absolute left-0 right-0 top-1/2 z-0 hidden h-0.5 origin-left bg-[linear-gradient(90deg,transparent,rgba(255,154,60,0.65),#ff6a1a,rgba(255,154,60,0.65),transparent)] md:block"
      />

      {threadItems.map((item, index) => {
        const Icon = item.icon;
        const isTop = item.position === "top";

        return (
          <div
            key={item.title}
            className="grid items-center gap-4 text-center md:contents"
          >
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 14 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.6, delay: 0.2 + index * 0.2 }}
              className={
                isTop
                  ? "md:col-start-auto md:row-start-1 md:self-end md:px-5 md:pb-6"
                  : "md:col-start-auto md:row-start-3 md:self-start md:px-5 md:pt-6"
              }
              style={{ gridColumnStart: index + 1 }}
            >
              {isTop ? (
                <TimelineText title={item.title} description={item.description} />
              ) : null}
            </motion.div>

            <motion.div
              variants={{
                hidden: { scale: 0 },
                visible: { scale: 1 },
              }}
              transition={{
                duration: 0.5,
                delay: 0.15 + index * 0.2,
                type: "spring",
                bounce: 0.45,
              }}
              className="relative z-10 mx-auto flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[linear-gradient(145deg,#ff9a3c,#ff6a1a)] shadow-[0_0_0_8px_var(--seal-node-ring),0_0_0_10px_rgba(255,122,26,0.28),0_10px_28px_rgba(255,122,26,0.22)] transition-shadow hover:shadow-[0_0_0_8px_var(--seal-node-ring),0_0_0_10px_#ff9a3c,0_0_28px_-2px_rgba(255,122,26,0.38)] md:row-start-2"
              style={{ gridColumnStart: index + 1 }}
            >
              <Icon className="h-5 w-5 text-[#1a0e04]" />
            </motion.div>

            <motion.div
              variants={{
                hidden: { opacity: 0, y: 14 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.6, delay: 0.2 + index * 0.2 }}
              className={
                !isTop
                  ? "md:col-start-auto md:row-start-3 md:self-start md:px-5 md:pt-6"
                  : "md:col-start-auto md:row-start-1 md:self-end md:px-5 md:pb-6"
              }
              style={{ gridColumnStart: index + 1 }}
            >
              {!isTop ? (
                <TimelineText title={item.title} description={item.description} />
              ) : null}
            </motion.div>
          </div>
        );
      })}
    </motion.div>
  );
}

function TimelineText({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <h3 className="text-base font-bold text-[#241812] dark:text-[#f5f2ec]">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-[#74675d] dark:text-[#a39c8f]">{description}</p>
    </>
  );
}
