import type { PolicyRule } from "@/core/api/types";

// Ma trận phân quyền ↔ danh sách rule {sub, obj, act} của backend (lib/permissions.js, kiểu Casbin).
// Hiển thị đúng những gì server trả – không suy quyền từ tên vai trò (spec §10).

export type Cell = "none" | "read" | "write" | "*";
export type Matrix = Record<string, Record<string, Cell>>;

export const BASE_ROLES = ["admin", "agent", "member"];
export const ROLE_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;

export function toMatrix(rules: PolicyRule[], objects: string[], extraRoles: string[] = []): Matrix {
  const roles = [...new Set([...BASE_ROLES, ...rules.map((r) => r.sub), ...extraRoles])];
  const matrix: Matrix = {};
  for (const role of roles) {
    matrix[role] = {};
    for (const obj of objects) {
      const acts = new Set(rules.filter((r) => r.sub === role && r.obj === obj).map((r) => r.act));
      // read + write = mọi hành động (backend chỉ có read/write) → hiển thị là toàn quyền
      matrix[role][obj] =
        acts.has("*") || (acts.has("read") && acts.has("write"))
          ? "*"
          : acts.has("write")
            ? "write"
            : acts.has("read")
              ? "read"
              : "none";
    }
  }
  return matrix;
}

export function toRules(matrix: Matrix): PolicyRule[] {
  const rules: PolicyRule[] = [];
  for (const [sub, cells] of Object.entries(matrix))
    for (const [obj, cell] of Object.entries(cells)) if (cell !== "none") rules.push({ sub, obj, act: cell });
  return rules;
}

const keyMatch = (reqObj: string, policyObj: string) =>
  policyObj.endsWith("*") ? reqObj.startsWith(policyObj.slice(0, -1)) : reqObj === policyObj;

/** Cùng điều kiện backend kiểm tra trước khi lưu: admin phải còn quyền ghi admin:policies (tránh tự khoá). */
export function adminKeepsPolicyWrite(rules: PolicyRule[]): boolean {
  return rules.some(
    (r) => r.sub === "admin" && keyMatch("admin:policies", r.obj) && (r.act === "*" || r.act === "write"),
  );
}

/** So sánh không phụ thuộc thứ tự (để biết có thay đổi chưa lưu). */
export const sameRules = (a: PolicyRule[], b: PolicyRule[]) => {
  const key = (rules: PolicyRule[]) =>
    toRules(toMatrix(rules, [...new Set(rules.map((r) => r.obj))]))
      .map((r) => `${r.sub}|${r.obj}|${r.act}`)
      .sort()
      .join(",");
  return key(a) === key(b);
};
