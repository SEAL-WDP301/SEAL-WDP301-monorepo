import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';

export default function FAQSection() {
    const faqs = [
        {
            question: 'How to participate in SEAL?',
            answer: 'Register individually through our platform, then form a team of 3-5 members before the deadline. You can team up with FPT students or create mixed teams with partner universities.'
        },
        {
            question: 'What are the team requirements?',
            answer: 'Teams must have 3-5 members. Teams can be: (1) All FPT University students, (2) Mixed teams between FPT and external students, or (3) Teams from partner universities.'
        },
        {
            question: 'Can external students join?',
            answer: 'Yes! SEAL welcomes students from partner universities including HCMUS, HCMUT, UIT, and other institutions. You can form teams with FPT students or compete as an external university team.'
        },
        {
            question: 'What is the competition format?',
            answer: 'Each SEAL season has multiple rounds: Registration & Idea Submission, Qualification Round (submit prototype), Semi-final Round (top teams advance), and Final Round (live presentations to judges).'
        },
        {
            question: 'How does the judging process work?',
            answer: 'Judges evaluate projects based on: Innovation & Creativity (25%), Technical Complexity (25%), Design & UX (20%), Real-world Impact (20%), and Presentation Quality (10%). Industry experts and faculty members serve as judges.'
        },
        {
            question: 'What are the prizes?',
            answer: 'Each SEAL season offers a prize pool of ₫45-50M VND, distributed among category winners, overall champions, and special awards. Winners also receive internship opportunities and mentorship programs.'
        },
        {
            question: 'Which technologies can I use?',
            answer: 'You can use any programming language, framework, library, or API. Categories include AI/ML, Web Development, Mobile App, IoT, Cybersecurity, and Cloud Computing. Choose what fits your project best.'
        },
        {
            question: 'Is there mentorship support?',
            answer: 'Yes! Industry experts and senior faculty members provide mentorship throughout the competition. You\'ll have access to technical guidance, code reviews, and presentation coaching.'
        },
    ];

    return (
        <section className="relative overflow-hidden bg-background py-24">
            {/* Background Glow */}
            <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-orange-500/10 blur-[150px]" />

            <div className="container relative z-10 mx-auto px-4">
                {/* Header */}
                <div className="mb-16 text-center">
                    <h2 className="mb-4 text-4xl font-black md:text-5xl">
                        <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                            Frequently Asked Questions
                        </span>
                    </h2>

                    <p className="text-lg text-muted-foreground">
                        Find answers to common questions
                    </p>
                </div>

                {/* Accordion */}
                <div className="mx-auto max-w-4xl">
                    <Accordion.Root
                        type="single"
                        collapsible
                        className="space-y-5"
                    >
                        {faqs.map((faq, index) => (
                            <Accordion.Item
                                key={index}
                                value={`faq-${index}`}
                                className="group overflow-hidden rounded-3xl border border-border bg-card backdrop-blur-xl transition-all duration-300 hover:border-orange-500/40"
                            >
                                {/* Trigger */}
                                <Accordion.Header>
                                    <Accordion.Trigger className="flex w-full items-center justify-between px-6 py-5 text-left transition-colors duration-300 hover:bg-orange-500/5">
                                        <span className="pr-5 text-lg font-semibold text-foreground">
                                            {faq.question}
                                        </span>

                                        <ChevronDown className="flex-shrink-0 text-orange-500 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                                    </Accordion.Trigger>
                                </Accordion.Header>

                                {/* Content */}
                                <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                                    <div className="border-t border-orange-500/10 px-6 pb-6 pt-5">
                                        <p className="leading-8 text-muted-foreground">
                                            {faq.answer}
                                        </p>
                                    </div>
                                </Accordion.Content>
                            </Accordion.Item>
                        ))}
                    </Accordion.Root>
                </div>
            </div>
        </section>
    );
}
