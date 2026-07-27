"use client";

import { useRef } from "react";
import VariableProximity from "@/components/VariableProximity";

export function HeroVariableTitle() {
    const containerRef = useRef<HTMLHeadingElement | null>(null);

    return (
        <h1
            ref={containerRef}
            data-scroll-float="false"
            className="mt-8 text-5xl font-bold leading-[0.95] tracking-[-0.04em] text-foreground sm:text-6xl md:text-7xl lg:text-[88px]"
        >
            <VariableProximity
                label="Software Engineering"
                containerRef={containerRef}
                radius={170}
                falloff="gaussian"
                fromFontVariationSettings="'wght' 760"
                toFontVariationSettings="'wght' 980"
                className="block"
                style={{ fontFamily: "inherit" }}
            />
            <VariableProximity
                label="Agile League."
                containerRef={containerRef}
                radius={190}
                falloff="gaussian"
                fromFontVariationSettings="'wght' 780"
                toFontVariationSettings="'wght' 1000"
                className="block text-gradient-orange"
                style={{ fontFamily: "inherit" }}
            />
        </h1>
    );
}
