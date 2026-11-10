import type { routing } from "./i18n/routing";
import type bg from "./messages/bg.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof bg;
  }
}
