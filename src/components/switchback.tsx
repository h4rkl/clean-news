"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type LocalizedValue<T = string> = {
  "@type": "@builder.io/core:LocalizedValue";
  Default?: T;
  [locale: string]: T | any;
};

function unwrapLocalized<T = string>(
  v: T | LocalizedValue<T> | undefined
): T | undefined {
  if (v == null) return undefined;
  if (typeof v !== "object") return v as T;
  if ((v as any)["@type"] !== "@builder.io/core:LocalizedValue") return v as T;
  const lv = v as LocalizedValue<T>;
  if (lv.Default != null) return lv.Default as T;
  const keys = Object.keys(lv).filter((k) => k !== "@type");
  return (keys.length ? (lv[keys[0]] as T) : undefined) as T | undefined;
}

type SwitchbackButton = {
  hierarchy?: string;
  size?: string;
  iconSize?: string;
  url?: string;
  label?: string | LocalizedValue<string>;
};

export type SwitchbackProps = {
  assetSide?: "left" | "right";
  image?: {
    src?: string;
    alt?: string | LocalizedValue<string>;
  };
  eyebrow?: string | LocalizedValue<string>;
  headline?: string | LocalizedValue<string>;
  body?: string | LocalizedValue<string>;
  buttons?: SwitchbackButton[];
  newsLetter?: boolean;
  formId?: string;
  placeholder?: string | LocalizedValue<string>;
  emailError?: string | LocalizedValue<string>;
  submitError?: string | LocalizedValue<string>;
  successMessge?: string | LocalizedValue<string>;
  className?: string;
  // Back-compat convenience so you can also do: <Switchback options={{...}} />
  options?: SwitchbackProps;
};

function isHtml(s?: string) {
  return !!s && /<\/?[a-z][\s\S]*>/i.test(s);
}

function ButtonFromSpec({ spec }: { spec: SwitchbackButton }) {
  const label = unwrapLocalized(spec.label) ?? "Learn more";
  const url = spec.url ?? "#";
  const variant =
    spec.hierarchy === "secondary"
      ? "secondary"
      : spec.hierarchy === "outline"
      ? "outline"
      : "default";
  const size =
    spec.size === "sm" ? "sm" : spec.size === "lg" ? "lg" : "default";
  const isExternal = /^https?:\/\//i.test(url);

  if (isExternal) {
    return (
      <Button asChild variant={variant as any} size={size as any}>
        <a href={url} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      </Button>
    );
  }
  return (
    <Button asChild variant={variant as any} size={size as any}>
      <Link href={url}>{label}</Link>
    </Button>
  );
}

export function Switchback(allProps: SwitchbackProps) {
  // Allow both flattened props and { options } wrapper
  const props = allProps.options
    ? { ...allProps.options, ...allProps }
    : allProps;

  const {
    assetSide = "right",
    image,
    eyebrow,
    headline,
    body,
    buttons = [],
    newsLetter,
    formId,
    placeholder,
    className,
  } = props;

  const eyebrowText = unwrapLocalized(eyebrow);
  const headlineText = unwrapLocalized(headline);
  const bodyText = unwrapLocalized(body);
  const placeholderText = unwrapLocalized(placeholder) ?? "Enter your email";

  const imgSrc = image?.src;
  const imgAlt = unwrapLocalized(image?.alt) ?? "";

  const textCol = (
    <div className="space-y-4">
      {eyebrowText ? (
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {eyebrowText}
        </div>
      ) : null}
      {headlineText ? (
        <h3 className="text-2xl font-semibold tracking-tight">
          {headlineText}
        </h3>
      ) : null}
      {bodyText ? (
        isHtml(bodyText) ? (
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: bodyText }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{bodyText}</p>
        )
      ) : null}

      {Boolean(buttons?.length) ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {buttons.map((b, i) => (
            <ButtonFromSpec key={i} spec={b} />
          ))}
        </div>
      ) : null}

      {newsLetter ? (
        <form
          method="post"
          action="#"
          className="mt-2 flex w-full max-w-md items-center gap-2"
          data-form-id={formId || undefined}
        >
          <input
            type="email"
            name="email"
            required
            placeholder={placeholderText}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring"
          />
          <Button type="submit" size="lg">
            Subscribe
          </Button>
        </form>
      ) : null}
    </div>
  );

  const imageCol = imgSrc ? (
    <div className="relative">
      <img
        src={imgSrc}
        alt={imgAlt}
        className="w-full rounded-lg border object-cover"
        loading="lazy"
      />
    </div>
  ) : null;

  const left = assetSide === "left" ? imageCol : textCol;
  const right = assetSide === "left" ? textCol : imageCol;

  return (
    <section
      className={cn(
        "my-8 rounded-lg border p-6",
        "grid grid-cols-1 items-center gap-6 md:grid-cols-2",
        className
      )}
    >
      {left}
      {right}
    </section>
  );
}

export default Switchback;
