// components/NewsCallout.tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface NewsCalloutProps {
  badgeText: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  title: string;
  description: string;
  highlights: string[];
  link: string;
  buttonText?: string;
}

export function NewsCallout({
  badgeText,
  badgeVariant = "outline",
  title,
  description,
  highlights,
  link,
  buttonText = "View Proposal & Vote",
}: NewsCalloutProps) {
  return (
    <Alert className="mb-6 border border-blue-500 bg-blue-50 text-blue-800">
      <AlertTitle className="flex items-center gap-2 text-lg font-bold">
        <Badge
          variant={badgeVariant}
          className="border-green-500 text-green-600"
        >
          {badgeText}
        </Badge>
        {title}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p>{description}</p>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {highlights.map((highlight, index) => (
            <li key={index}>{highlight}</li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end">
          <Button variant="default" asChild>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1"
            >
              {buttonText} <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
