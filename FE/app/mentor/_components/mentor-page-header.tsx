import type { ReactNode } from "react";

interface MentorPageHeaderProps {
  title: string | ReactNode;
  subtitle: string;
  actions?: ReactNode;
}

export function MentorPageHeader({
  title,
  subtitle,
  actions,
}: MentorPageHeaderProps) {
  return (
    <header className="border-b border-border pb-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Mentor Module
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
