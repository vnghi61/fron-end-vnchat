import { describe, expect, it } from "vitest";
import { http } from "./http";
import { tokenStore } from "./token";
import { isolateSession, transport, WIDGET_TOKEN_SCOPE } from "./transport";

describe("isolateSession (widget, contract map B15)", () => {
  it("switches to bearer with its own token key and stops sending/storing cookies", () => {
    expect(transport.cookies()).toBe(true);
    isolateSession(WIDGET_TOKEN_SCOPE);
    expect(transport.auth()).toBe("bearer");
    expect(transport.cookies()).toBe(false);
    // fetch adapter + withCredentials=false → credentials "omit": Set-Cookie của /api/widget/sessions bị bỏ qua
    expect(http.defaults.adapter).toBe("fetch");
    expect(http.defaults.withCredentials).toBe(false);
    tokenStore.set("visitor-token");
    expect(window.localStorage.getItem("vnchat.widget.token")).toBe("visitor-token");
    expect(window.localStorage.getItem("vnchat.auth.token")).toBeNull();
    tokenStore.clear();
  });
});
