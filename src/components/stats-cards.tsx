// src/components/rich-text-stats.tsx
import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatCardsItem = {
  stat: React.ReactNode;
  description?: React.ReactNode;
};

export type StatCardsProps = {
  stats: StatCardsItem[];
  columns?: number;
  className?: string;
};

export function StatCards({ stats = [], columns, className }: StatCardsProps) {
  const count = stats.length || 1;
  const cols = Math.max(1, columns ?? count);

  return (
    <div
      className={cn("grid gap-4", className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {stats.map((item, idx) => (
        <Card key={idx} className="text-center">
          <CardHeader>
            <CardTitle className="text-3xl md:text-4xl">{item.stat}</CardTitle>
            {item.description ? (
              <CardDescription>{item.description}</CardDescription>
            ) : null}
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
