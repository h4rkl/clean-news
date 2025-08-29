"use client";

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@radix-ui/react-navigation-menu";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const NAV_ITEMS = [
  { key: "developers", href: "/news/developers" },
  { key: "finance", href: "/news/finance" },
  { key: "governance", href: "/news/governance" },
  { key: "upgrades", href: "/news/upgrades" },
] as const;

export function Nav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  const localePrefix = new RegExp(`^/(${routing.locales.join("|")})(?=(/|$))`);
  const pathnameNoLocale = pathname.replace(localePrefix, "");

  const isHomeActive = pathnameNoLocale === "/news";

  return (
    <NavigationMenu className="w-full flex justify-center bg-white shadow-md py-1 mb-4">
      <NavigationMenuList className="flex space-x-6">
        <NavigationMenuItem>
          <NavigationMenuLink
            asChild
            className={[
              "px-3 py-2 rounded-md transition-colors",
              isHomeActive
                ? "text-blue-600 font-semibold"
                : "text-gray-700 hover:text-blue-500",
            ].join(" ")}
            aria-current={isHomeActive ? "page" : undefined}
          >
            <Link href="/news" aria-label={t("all")} title={t("all")}>
              {t("all")}
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathnameNoLocale === item.href ||
            pathnameNoLocale.startsWith(item.href + "/");

          const className = [
            "px-3 py-2 rounded-md transition-colors",
            isActive
              ? "text-blue-600 font-semibold"
              : "text-gray-700 hover:text-blue-500",
          ].join(" ");

          return (
            <NavigationMenuItem key={item.href}>
              <NavigationMenuLink
                asChild
                className={className}
                aria-current={isActive ? "page" : undefined}
              >
                <Link href={item.href}>{t(item.key)}</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
