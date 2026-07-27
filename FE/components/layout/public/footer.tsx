import Link from 'next/link';
import { FaGithub, FaTwitter, FaLinkedin, FaYoutube, FaFacebook } from 'react-icons/fa';
import { Mail } from 'lucide-react'
import Logo from '@/components/ui/logo';

export default function Footer() {
    return (
        <footer className="relative mt-24 border-t border-border bg-background">
            {/* Glow */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent" />

            <div className="container mx-auto px-4 py-16">
                <div className="mb-12 grid gap-12 md:grid-cols-2 lg:grid-cols-4">
                    {/* Brand */}
                    <div>
                        <div className="mb-4">
                            <Logo size="md" href="/" />
                        </div>

                        <p className="mb-6 text-sm leading-7 text-muted-foreground">
                            Annual academic hackathon series bringing
                            together talented students to tackle
                            real-world challenges.
                        </p>

                        <div className="flex gap-3">
                            <Link
                                href="#"
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all duration-300 hover:-translate-y-1 hover:border-orange-500 hover:bg-orange-500 hover:text-foreground"
                            >
                                <FaFacebook size={16} />
                            </Link>

                            <Link
                                href="#"
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all duration-300 hover:-translate-y-1 hover:border-orange-500 hover:bg-orange-500 hover:text-foreground"
                            >
                                <FaTwitter size={16} />
                            </Link>

                            <Link
                                href="#"
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all duration-300 hover:-translate-y-1 hover:border-orange-500 hover:bg-orange-500 hover:text-foreground"
                            >
                                <FaGithub size={16} />
                            </Link>

                            <Link
                                href="#"
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all duration-300 hover:-translate-y-1 hover:border-orange-500 hover:bg-orange-500 hover:text-foreground"
                            >
                                <FaLinkedin size={16} />
                            </Link>

                            <Link
                                href="#"
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all duration-300 hover:-translate-y-1 hover:border-orange-500 hover:bg-orange-500 hover:text-foreground"
                            >
                                <FaYoutube size={16} />
                            </Link>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="mb-4 text-sm font-semibold text-orange-500">
                            Quick Links
                        </h3>

                        <div className="flex flex-col gap-3">
                            <Link
                                href="#"
                                className="text-sm text-muted-foreground transition-all hover:translate-x-1 hover:text-orange-500"
                            >
                                About SEAL
                            </Link>

                            <Link
                                href="#"
                                className="text-sm text-muted-foreground transition-all hover:translate-x-1 hover:text-orange-500"
                            >
                                Past Seasons
                            </Link>

                            <Link
                                href="#"
                                className="text-sm text-muted-foreground transition-all hover:translate-x-1 hover:text-orange-500"
                            >
                                Rules & Guidelines
                            </Link>

                            <Link
                                href="#"
                                className="text-sm text-muted-foreground transition-all hover:translate-x-1 hover:text-orange-500"
                            >
                                Hall of Fame
                            </Link>
                        </div>
                    </div>

                    {/* Resources */}
                    <div>
                        <h3 className="mb-4 text-sm font-semibold text-orange-500">
                            Resources
                        </h3>

                        <div className="flex flex-col gap-3">
                            <Link
                                href="#"
                                className="text-sm text-muted-foreground transition-all hover:translate-x-1 hover:text-orange-500"
                            >
                                Documentation
                            </Link>

                            <Link
                                href="#"
                                className="text-sm text-muted-foreground transition-all hover:translate-x-1 hover:text-orange-500"
                            >
                                FAQ
                            </Link>

                            <Link
                                href="#"
                                className="text-sm text-muted-foreground transition-all hover:translate-x-1 hover:text-orange-500"
                            >
                                Support
                            </Link>

                            <Link
                                href="#"
                                className="text-sm text-muted-foreground transition-all hover:translate-x-1 hover:text-orange-500"
                            >
                                Privacy Policy
                            </Link>
                        </div>
                    </div>

                    {/* Contact */}
                    <div>
                        <h3 className="mb-4 text-sm font-semibold text-orange-500">
                            Contact
                        </h3>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="text-orange-500" />

                                <span>seal@fpt.edu.vn</span>
                            </div>

                            <p className="text-sm leading-7 text-muted-foreground">
                                Software Engineering Department
                                <br />
                                FPT University HCMC
                                <br />
                                Lot E2a-7, D1 Street, Hi-Tech Park
                                <br />
                                Long Thanh My, District 9, HCMC
                            </p>
                        </div>
                    </div>
                </div>

                {/* Bottom */}
                <div className="flex flex-col items-center justify-between gap-4 border-t border-orange-500/20 pt-8 md:flex-row">
                    <p className="text-sm text-muted-foreground">
                        © 2026 SEAL - Software Engineering Agile
                        League. All rights reserved.
                    </p>

                    <p className="text-sm text-muted-foreground">
                        Organized by{' '}
                        <span className="text-orange-500">
                            SE Department
                        </span>{' '}
                        &{' '}
                        <span className="text-orange-500">
                            PDP
                        </span>
                    </p>
                </div>
            </div>
        </footer>
    );
}
