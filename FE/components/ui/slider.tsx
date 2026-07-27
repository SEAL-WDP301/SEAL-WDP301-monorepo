"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

function Slider({
    className,
    defaultValue,
    value,
    min = 0,
    max = 100,
    ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
    const _values = React.useMemo(
        () =>
            Array.isArray(value)
                ? value
                : Array.isArray(defaultValue)
                    ? defaultValue
                    : [min, max],
        [value, defaultValue, min, max]
    );

    return (
        <SliderPrimitive.Root
            data-slot="slider"
            defaultValue={defaultValue}
            value={value}
            min={min}
            max={max}
            className={cn(
                "relative flex w-full touch-none select-none items-center",
                className
            )}
            {...props}
        >
            <SliderPrimitive.Track
                data-slot="slider-track"
                className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted"
            >
                <SliderPrimitive.Range
                    data-slot="slider-range"
                    className="absolute h-full bg-orange-500 shadow-[0_0_12px_rgba(243,112,33,0.6)] data-[disabled]:bg-zinc-600 data-[disabled]:shadow-none"
                />
            </SliderPrimitive.Track>

            {_values.map((_, index) => (
                <SliderPrimitive.Thumb
                    key={index}
                    data-slot="slider-thumb"
                    className="
            block h-5 w-5 rounded-full
            border-2 border-primary
            bg-primary
            shadow-lg
            transition-all

            hover:scale-110
            focus-visible:outline-none
            focus-visible:ring-4
            focus-visible:ring-primary/30

            data-[disabled]:border-zinc-500
            data-[disabled]:bg-zinc-500
            data-[disabled]:shadow-none
            data-[disabled]:pointer-events-none
            data-[disabled]:opacity-50
          "
                />
            ))}
        </SliderPrimitive.Root>
    );
}

export { Slider };