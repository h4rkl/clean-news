import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@radix-ui/react-navigation-menu";

export function Nav() {
  return (
    <NavigationMenu className="w-full flex justify-center bg-white shadow-md py-1 mb-4">
      <NavigationMenuList className="flex space-x-6">
        <NavigationMenuItem>
          <NavigationMenuLink className="text-gray-700 hover:text-blue-500 px-3 py-2 rounded-md transition-colors">
            Link 1
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink className="text-gray-700 hover:text-blue-500 px-3 py-2 rounded-md transition-colors">
            Link 2
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink className="text-gray-700 hover:text-blue-500 px-3 py-2 rounded-md transition-colors">
            Link 3
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
