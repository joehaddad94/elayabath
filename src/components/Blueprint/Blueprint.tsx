import type { ElementType, ReactNode } from "react";

/**
 * A blueprint object: square corners, a hairline border and a "+"
 * registration mark at each corner. The system's signature gesture.
 *
 * The marks are four empty elements because the system draws each one as two
 * 1px pseudo-element bars — a glyph would not match the line weight of the
 * border it sits on. `.blueprint` and `.corner` are global classes from
 * system.css, so this component only owns the markup.
 */
export function Marks() {
  return (
    <>
      <i className="corner tl" aria-hidden="true" />
      <i className="corner tr" aria-hidden="true" />
      <i className="corner bl" aria-hidden="true" />
      <i className="corner br" aria-hidden="true" />
    </>
  );
}

type BlueprintProps = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>;

export function Blueprint({
  as: Tag = "div",
  className,
  children,
  ...rest
}: BlueprintProps) {
  return (
    <Tag className={className ? `blueprint ${className}` : "blueprint"} {...rest}>
      {children}
      <Marks />
    </Tag>
  );
}
