import type { ReactNode } from "react";

type SectionHeaderProps = {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
  id?: string;
};

export function SectionHeader({
  title,
  eyebrow,
  action,
  className = "",
  id,
}: SectionHeaderProps) {
  return (
    <div className={`flex items-end justify-between gap-4${className ? ` ${className}` : ""}`} id={id}>
      <div className="min-w-0">
        {eyebrow ? (
          <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-red-500 mb-1">
            {eyebrow}
          </span>
        ) : null}
        <h2 className="row-title truncate">
          {title}
        </h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export default SectionHeader;
