import { Brain, Code, Smartphone, Cpu, Shield, Cloud } from 'lucide-react';

export default function CategoriesSection() {
    const categories = [
        {
            icon: Brain,
            title: 'AI & Machine Learning',
            description: 'Build intelligent systems using ML, NLP, Computer Vision, and AI models',
            teams: 42,
            color: 'from-[#F37021] to-[#fb923c]'
        },
        {
            icon: Code,
            title: 'Web Development',
            description: 'Create modern web applications with cutting-edge frameworks and technologies',
            teams: 58,
            color: 'from-[#fb923c] to-[#fdba74]'
        },
        {
            icon: Smartphone,
            title: 'Mobile App',
            description: 'Develop innovative mobile solutions for iOS and Android platforms',
            teams: 37,
            color: 'from-[#fdba74] to-[#fed7aa]'
        },
        {
            icon: Cpu,
            title: 'IoT & Hardware',
            description: 'Design smart devices and embedded systems for real-world problems',
            teams: 25,
            color: 'from-[#fed7aa] to-[#F37021]'
        },
        {
            icon: Shield,
            title: 'Cybersecurity',
            description: 'Solve security challenges and build tools for a safer digital world',
            teams: 28,
            color: 'from-[#F37021] to-[#fb923c]'
        },
        {
            icon: Cloud,
            title: 'Cloud Computing',
            description: 'Build scalable cloud-native applications and distributed systems',
            teams: 32,
            color: 'from-[#fb923c] to-[#fdba74]'
        },
    ];

    return (
        <section className="relative overflow-hidden bg-background py-24">
            {/* Background Glow */}
            <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/5 blur-[200px]" />

            <div className="container relative z-10 mx-auto px-4">
                {/* Header */}
                <div className="mb-16 text-center">
                    <h2 className="mb-4 text-4xl font-black md:text-5xl">
                        <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                            Competition Categories
                        </span>
                    </h2>

                    <p className="text-lg text-muted-foreground">
                        Choose your track and start building
                    </p>
                </div>

                {/* Categories */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {categories.map((category, index) => {
                        const Icon = category.icon;

                        return (
                            <div
                                key={index}
                                className="group relative overflow-hidden rounded-3xl border border-border bg-card p-8 backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:border-orange-500/50 hover:shadow-2xl hover:shadow-orange-500/10"
                            >
                                {/* Gradient Overlay */}
                                <div
                                    className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-0 transition-opacity duration-300 group-hover:opacity-5`}
                                />

                                {/* Glow */}
                                <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-orange-500 blur-[60px] opacity-0 transition-opacity duration-300 group-hover:opacity-20" />

                                <div className="relative z-10">
                                    {/* Icon */}
                                    <div
                                        className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${category.color} shadow-lg shadow-orange-500/20 transition-transform duration-300 group-hover:scale-110`}
                                    >
                                        <Icon className="text-3xl text-foreground" />
                                    </div>

                                    {/* Title */}
                                    <h3 className="mb-3 text-2xl font-bold text-foreground">
                                        {category.title}
                                    </h3>

                                    {/* Description */}
                                    <p className="mb-6 text-sm leading-7 text-muted-foreground">
                                        {category.description}
                                    </p>

                                    {/* Footer */}
                                    <div className="flex items-center justify-between border-t border-orange-500/20 pt-4">
                                        <span className="text-sm text-muted-foreground">
                                            Active Teams
                                        </span>

                                        <span
                                            className={`bg-gradient-to-r ${category.color} bg-clip-text text-3xl font-black text-transparent`}
                                        >
                                            {category.teams}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
