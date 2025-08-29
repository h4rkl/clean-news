"use client";

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@radix-ui/react-navigation-menu";
import { useTranslations } from "next-intl";

export function Nav() {
  const t = useTranslations("Nav");
  return (
    <NavigationMenu className="w-full flex justify-center bg-white shadow-md py-1 mb-4">
      <NavigationMenuList className="flex space-x-6">
        <NavigationMenuItem>
          <NavigationMenuLink className="text-gray-700 hover:text-blue-500 px-3 py-2 rounded-md transition-colors">
            {t("link1")}
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink className="text-gray-700 hover:text-blue-500 px-3 py-2 rounded-md transition-colors">
            {t("link2")}
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink className="text-gray-700 hover:text-blue-500 px-3 py-2 rounded-md transition-colors">
            {t("link3")}
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
