import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  collapsed?: boolean;
  href?: string;
}

export default function Logo({
  size = "md",
  showText = true,
  collapsed = false,
  href = "/home",
}: LogoProps) {
  const sizes = {
    sm: {
      wrapper: "h-12 w-12",
      text: "text-lg",
      title: "text-lg",
      subtitle: "text-[9px]",
    },
    md: {
      wrapper: "h-14 w-14",
      text: "text-xl",
      title: "text-xl",
      subtitle: "text-[10px]",
    },
    lg: {
      wrapper: "h-[72px] w-[72px]",
      text: "text-2xl",
      title: "text-2xl",
      subtitle: "text-xs",
    },
  };

  const current = sizes[size];

  return (
    <Link href={href} className={cn("flex items-center", collapsed ? "justify-center" : "gap-2.5")}>
      <div className={cn("relative shrink-0", current.wrapper)}>
        <Image
          src="/brand/seal-emblem-512.png"
          alt="SEAL"
          fill
          priority
          sizes={size === "lg" ? "72px" : size === "md" ? "56px" : "48px"}
          className="object-contain drop-shadow-[0_4px_10px_rgba(249,115,22,0.4)]"
        />
      </div>

      {/* Text */}
      {showText && !collapsed && (
        <div className="leading-tight transition-all duration-300">
          <h1
            className={cn(`${current.title} font-bold tracking-tight text-foreground`)}
          >
            SEAL
          </h1>

          <p
            className={cn(`${current.subtitle} font-medium tracking-[0.3em] text-orange-400`)}
          >
            FPTU · HCMC
          </p>
        </div>
      )}
    </Link>
  );
}
