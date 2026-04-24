"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, type ReactNode, type MouseEventHandler } from "react";

type Props = {
  href: string;
  children: ReactNode;
  className?: string;
} & Omit<React.ComponentProps<typeof Link>, "onClick">;

export default function TransitionLink({ href, children, className, ...rest }: Props) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick: MouseEventHandler<HTMLAnchorElement> = useCallback(
    (e) => {
      e.preventDefault();

      // Fade out
      document.documentElement.classList.add("page-exit");

      timer.current = setTimeout(() => {
        router.push(href);
      }, 220);
    },
    [href, router],
  );

  return (
    <Link href={href} onClick={handleClick} className={className} {...rest}>
      {children}
    </Link>
  );
}
