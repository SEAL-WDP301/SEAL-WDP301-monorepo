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
    [value, defaultValue, min, max],
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none select-none items-center py-2",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute top-0 h-full bg-orange-500 data-[disabled]:bg-zinc-600"
        />
      </SliderPrimitive.Track>

      {_values.map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          data-slot="slider-thumb"
          className="
            block size-5 shrink-0 rounded-full
            border-2 border-orange-500
            bg-orange-500
            shadow-md
            transition-transform

            hover:scale-110
            focus-visible:outline-none
            focus-visible:ring-4
            focus-visible:ring-orange-500/30

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
