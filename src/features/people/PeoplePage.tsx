import { useTranslation } from "react-i18next";
import { PageHeader } from "@/features/shared/PageHeader";
import { useProfileSheet } from "./profile-store";
import { UserPicker } from "./UserPicker";

/** Danh bạ (màn 21): tìm người theo tên / email → hồ sơ (nhắn tin, biệt danh, chặn). */
export function PeoplePage() {
  const { t } = useTranslation();
  const open = useProfileSheet((s) => s.open);
  return (
    <div className="flex h-full flex-col bg-background">
      <PageHeader title={t("people.title")} />
      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col p-3">
        <UserPicker mode="single" onPick={(u) => open(u._id)} />
      </div>
    </div>
  );
}
