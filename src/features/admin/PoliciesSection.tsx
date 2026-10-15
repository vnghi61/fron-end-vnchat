import { useQueryClient } from "@tanstack/react-query";
import { Plus, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { qk } from "@/core/api/query";
import { useSession } from "@/core/auth/session";
import { cn } from "@/core/lib/cn";
import { Button, Input, Select, Skeleton } from "@/core/ui/components";
import { toast } from "@/core/ui/toast";
import { AdminError, AdminPage } from "./AdminPage";
import { adminApi, usePolicies } from "./api";
import {
  adminKeepsPolicyWrite,
  ROLE_PATTERN,
  sameRules,
  toMatrix,
  toRules,
  type Cell,
  type Matrix,
} from "./policy-matrix";

/** Ma trận phân quyền (màn 20): vai trò × đối tượng, sửa rồi lưu một lần (PUT /api/admin/policies). */
export function PoliciesSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const query = usePolicies();
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [newRole, setNewRole] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (query.data) setMatrix(toMatrix(query.data.rules, query.data.objects));
  }, [query.data]);

  const rules = useMemo(() => (matrix ? toRules(matrix) : []), [matrix]);
  const dirty = !!query.data && !!matrix && !sameRules(rules, query.data.rules);
  const lockout = !!matrix && !adminKeepsPolicyWrite(rules);

  const cellLabel: Record<Cell, string> = {
    none: t("admin.policies.none"),
    read: t("admin.policies.read"),
    write: t("admin.policies.write"),
    "*": t("admin.policies.all"),
  };

  const save = async () => {
    setBusy(true);
    try {
      const res = await adminApi.savePolicies(rules);
      qc.setQueryData(qk.admin("policies"), res);
      // quyền của chính mình có thể vừa đổi (menu admin/agent) → tải lại bootstrap
      void useSession
        .getState()
        .refreshBootstrap()
        .catch(() => undefined);
      toast.success(t("admin.saved"));
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  };

  const addRole = () => {
    const role = newRole.trim();
    if (!matrix || !ROLE_PATTERN.test(role) || matrix[role] || !query.data) return;
    setMatrix({ ...matrix, [role]: Object.fromEntries(query.data.objects.map((o) => [o, "none" as Cell])) });
    setNewRole("");
  };

  return (
    <AdminPage
      wide
      title={t("admin.nav.policies")}
      actions={
        matrix && (
          <>
            {dirty && (
              <Button
                variant="ghost"
                onClick={() => query.data && setMatrix(toMatrix(query.data.rules, query.data.objects))}
              >
                {t("admin.reset")}
              </Button>
            )}
            <Button onClick={() => void save()} loading={busy} disabled={!dirty || lockout}>
              {t("admin.policies.save")}
            </Button>
          </>
        )
      }
    >
      {query.isPending ? (
        <Skeleton className="h-64 w-full rounded-md" />
      ) : query.isError ? (
        <AdminError error={query.error} onRetry={() => void query.refetch()} />
      ) : matrix ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t("admin.policies.intro")}</p>
          {lockout && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-md border border-danger/40 px-3 py-2 text-sm text-danger"
            >
              <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
              {t("admin.policies.lockout")}
            </p>
          )}
          {dirty && !lockout && <p className="text-sm text-warning">{t("admin.unsaved")}</p>}
          <div className="overflow-x-auto rounded-md border border-border bg-surface scrollbar-thin">
            <table className="w-max min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="sticky left-0 bg-surface px-3 py-2 text-left font-medium">
                    {t("admin.policies.role")}
                  </th>
                  {query.data.objects.map((obj) => (
                    <th
                      key={obj}
                      scope="col"
                      className="px-2 py-2 text-left font-mono text-xs font-medium text-muted-foreground"
                    >
                      {obj}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(matrix).map(([role, cells]) => (
                  <tr key={role} className="border-b border-border last:border-0">
                    <th scope="row" className="sticky left-0 bg-surface px-3 py-2 text-left font-medium">
                      {role}
                    </th>
                    {query.data.objects.map((obj) => (
                      <td key={obj} className="px-2 py-1.5">
                        <Select
                          aria-label={t("admin.policies.cell", { role, object: obj })}
                          value={cells[obj] ?? "none"}
                          onChange={(e) =>
                            setMatrix({ ...matrix, [role]: { ...cells, [obj]: e.target.value as Cell } })
                          }
                          className={cn(
                            "h-9 w-32 pr-8",
                            cells[obj] === "none" && "text-muted-foreground",
                            cells[obj] === "*" && "border-primary/50 bg-primary-soft font-medium text-primary-strong",
                            (cells[obj] === "read" || cells[obj] === "write") && "font-medium",
                          )}
                        >
                          {(Object.keys(cellLabel) as Cell[]).map((c) => (
                            <option key={c} value={c}>
                              {cellLabel[c]}
                            </option>
                          ))}
                        </Select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addRole();
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("admin.policies.newRole")}</span>
              <Input
                value={newRole}
                onChange={(e) => setNewRole(e.target.value.toLowerCase())}
                maxLength={32}
                aria-invalid={!!newRole && !ROLE_PATTERN.test(newRole)}
                aria-describedby="new-role-hint"
              />
            </label>
            <Button type="submit" variant="secondary" disabled={!ROLE_PATTERN.test(newRole) || !!matrix[newRole]}>
              <Plus aria-hidden="true" />
              {t("admin.policies.addRole")}
            </Button>
            <p id="new-role-hint" className="w-full text-xs text-muted-foreground">
              {t("admin.policies.roleInvalid")}
            </p>
          </form>
        </div>
      ) : null}
    </AdminPage>
  );
}
