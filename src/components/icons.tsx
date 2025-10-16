import type { SVGProps } from "react";

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9 12l2 2 4-4" />
      <path d="M21.3 15.3a2.4 2.4 0 0 1 0-2.6l-1-1.7a2.4 2.4 0 0 0-2.6 0l-1.7 1-2.6.1a2.4 2.4 0 0 1-2.6 2.6l-.1 2.6-1 1.7a2.4 2.4 0 0 0 0 2.6l1 1.7a2.4 2.4 0 0 0 2.6 0l1.7-1 2.6-.1a2.4 2.4 0 0 1 2.6-2.6l.1-2.6Z" />
      <path d="m3.3 8.7.1-2.6a2.4 2.4 0 0 1 2.6-2.6l2.6-.1 1.7-1a2.4 2.4 0 0 1 2.6 0l1.7 1 2.6.1a2.4 2.4 0 0 1 2.6 2.6l.1 2.6-1 1.7a2.4 2.4 0 0 0 0 2.6l1 1.7-.1 2.6a2.4 2.4 0 0 1-2.6 2.6l-2.6.1-1.7 1a2.4 2.4 0 0 1-2.6 0l-1.7-1-2.6-.1a2.4 2.4 0 0 1-2.6-2.6l-.1-2.6 1-1.7a2.4 2.4 0 0 0 0-2.6Z" />
    </svg>
  );
}
