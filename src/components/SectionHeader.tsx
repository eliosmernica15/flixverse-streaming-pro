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
    <div className={`section-header${className ? ` ${className}` : ""}`} id={id}>
      <div className="min-w-0">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h2 className="section-title display-title">{title}</h2>
      </div>
      {action ? <div className="section-action">{action}</div> : null}
    </div>
  );
}

export default SectionHeader;
