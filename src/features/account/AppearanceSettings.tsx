import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { setLocale, type Locale } from "@/core/i18n";
import { Segmented } from "@/core/ui/components";
import { useTheme, type ThemePreference } from "@/core/ui/theme";
import { SettingsPage } from "./SettingsLayout";

export function AppearanceSettings() {
  const { t, i18n } = useTranslation();
  const { preference, setPreference } = useTheme();
  return (
    <SettingsPage title={t("settings.appearance")}>
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t("settings.theme")}</h2>
          <Segmented<ThemePreference>
            label={t("settings.theme")}
            value={preference}
            onValueChange={(v) => setPreference(v)}
            options={[
              { value: "system", label: t("settings.themeSystem"), icon: <Monitor /> },
              { value: "light", label: t("settings.themeLight"), icon: <Sun /> },
              { value: "dark", label: t("settings.themeDark"), icon: <Moon /> },
            ]}
            className="self-start"
          />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t("settings.language")}</h2>
          <Segmented<Locale>
            label={t("settings.language")}
            value={i18n.language === "en" ? "en" : "vi"}
            onValueChange={(v) => setLocale(v)}
            options={[
              { value: "vi", label: t("settings.languageVi") },
              { value: "en", label: t("settings.languageEn") },
            ]}
            className="self-start"
          />
        </section>
      </div>
    </SettingsPage>
  );
}
