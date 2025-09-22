import * as React from "react";
import { MDXRemote, type MDXRemoteProps } from "next-mdx-remote/rsc";
import {
  Alert as UiAlert,
  AlertTitle,
  AlertDescription,
} from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { LiteYouTubeEmbed, Tweet } from "@/components/mdx-client";
import { StatCards } from "@/components/stats-cards";

type CodeProps = React.HTMLAttributes<HTMLElement> & {
  "data-language"?: string;
};

const Code = ({ className, children, ...props }: CodeProps) => {
  // Inline code vs block code
  const isBlock = (props as any)["data-block"] ?? false;
  if (isBlock) {
    return (
      <pre
        className={cn(
          "overflow-x-auto rounded-md border bg-black/90 p-4 text-sm text-white",
          className
        )}
      >
        <code {...props}>{children}</code>
      </pre>
    );
  }
  return (
    <code
      className={cn(
        "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]",
        className
      )}
      {...props}
    >
      {children}
    </code>
  );
};

const Pre = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLPreElement>) => {
  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-md border bg-black/90 p-4 text-sm text-white",
        className
      )}
      {...props}
    >
      {children}
    </pre>
  );
};

type AlertProps = React.ComponentProps<typeof UiAlert> & {
  title?: string;
  description?: React.ReactNode;
};
const Alert = ({ title, description, children, ...props }: AlertProps) => {
  return (
    <UiAlert {...props}>
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      {description ? (
        <AlertDescription>{description}</AlertDescription>
      ) : (
        children
      )}
    </UiAlert>
  );
};

// Simple iframe-based spec viewer for upgrade specs
type SpecViewerProps = {
  src: string;
  title?: string;
  height?: number | string;
  className?: string;
};
const SpecViewer = ({
  src,
  title = "Spec Viewer",
  height = 600,
  className,
}: SpecViewerProps) => {
  return (
    <div className={cn("my-4 overflow-hidden rounded border", className)}>
      <iframe
        src={src}
        title={title}
        style={{ width: "100%", height }}
        loading="lazy"
      />
    </div>
  );
};

// Map MDX elements to shadcn-styled components
export const mdxComponents = {
  // MDX flows code fences into <pre><code>, and inline into <code>
  pre: Pre,
  code: Code,
  Alert,
  SpecViewer,
  StatCards,
  YouTube: ({ videoId, ...props }) => (
    <div className="my-4">
      <LiteYouTubeEmbed id={videoId ?? ""} {...props} />
    </div>
  ),
  Tweet,
} satisfies MDXRemoteProps["components"];

// Convenience wrapper to render MDX source string with our components
export function Mdx({ source }: { source: string }) {
  return <MDXRemote source={source} components={mdxComponents} />;
}
