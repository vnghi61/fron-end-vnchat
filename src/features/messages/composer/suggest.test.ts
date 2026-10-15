import { describe, expect, it } from "vitest";
import { activeToken, applySuggestion, collectMentions, filterCommands, filterMembers, fold } from "./suggest";

describe("activeToken", () => {
  it("detects a command only at the start of the message", () => {
    expect(activeToken("/ta", 3)).toEqual({ kind: "command", query: "ta", start: 0, end: 3 });
    expect(activeToken("hi /ta", 6)).toBeNull();
    expect(activeToken("/task do it", 11)).toBeNull();
  });

  it("detects a mention after whitespace or at the start", () => {
    expect(activeToken("@cu", 3)).toEqual({ kind: "mention", query: "cu", start: 0, end: 3 });
    expect(activeToken("chào @Cường", 11)).toEqual({ kind: "mention", query: "Cường", start: 5, end: 11 });
    expect(activeToken("mail@test", 9)).toBeNull();
  });

  it("allows two-word names but not a newline", () => {
    expect(activeToken("@Nguyen Van", 11)?.query).toBe("Nguyen Van");
    expect(activeToken("@abc\nx", 6)).toBeNull();
  });
});

describe("filters", () => {
  const people = [
    { id: "1", name: "Trần Cường" },
    { id: "2", name: "Lê Bình" },
    { id: "3", name: "Đặng Dũng" },
  ];

  it("folds Vietnamese accents and đ", () => {
    expect(fold("Đặng Dũng")).toBe("dang dung");
  });

  it("matches the start of any word", () => {
    expect(filterMembers(people, "cuong").map((p) => p.id)).toEqual(["1"]);
    expect(filterMembers(people, "d").map((p) => p.id)).toEqual(["3"]);
    expect(filterMembers(people, "")).toHaveLength(3);
  });

  it("lists only enabled commands by prefix", () => {
    const rules = [
      { name: "task", description: "", enabled: true },
      { name: "todo", description: "", enabled: false },
      { name: "help", description: "", enabled: true },
    ];
    expect(filterCommands(rules, "t").map((r) => r.name)).toEqual(["task"]);
    expect(filterCommands(rules, "").map((r) => r.name)).toEqual(["task", "help"]);
  });
});

describe("applySuggestion / collectMentions", () => {
  it("replaces the token and places the caret after a space", () => {
    const token = activeToken("hi @cu", 6)!;
    expect(applySuggestion("hi @cu", token, "@Trần Cường")).toEqual({ text: "hi @Trần Cường ", caret: 15 });
  });

  it("keeps only mentions still present in the text", () => {
    const picked = new Map([
      ["1", "Trần Cường"],
      ["2", "Lê Bình"],
    ]);
    expect(collectMentions("hello @Trần Cường", picked)).toEqual(["1"]);
  });
});
