import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ locale }) => {
  const l = locale ?? "en";
  return {
    messages: (await import(`./messages/${l}.json`)).default,
    locale: l,
  };
});
