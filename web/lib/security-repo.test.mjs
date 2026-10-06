import { expect, test } from "bun:test";
import { parseTarget, pickProject } from "./security-repo.ts";
import { selectTop } from "./security-jobs.ts";

const projects = ["", "00_hello", "01_sell_nft", "bank/01", "bank/02", "common/solution_recording"];

test("parseTarget accepts root, .git, tree and scheme-less forms", () => {
  expect(parseTarget("https://github.com/Invariant-0/cardano-ctf")).toEqual({ owner: "Invariant-0", repo: "cardano-ctf", treeRest: "", subdir: "" });
  expect(parseTarget("https://github.com/o/r.git/").repo).toBe("r");
  expect(parseTarget("github.com/o/r/tree/feat/x/01_sell_nft").treeRest).toBe("feat/x/01_sell_nft");
  expect(parseTarget("https://github.com/o/r", "/01_sell_nft/").subdir).toBe("01_sell_nft");
});

test("parseTarget rejects traversal and non-github input", () => {
  expect(() => parseTarget("https://github.com/o/r", "../../etc")).toThrow();
  expect(() => parseTarget("https://evil.example/o/r")).toThrow();
  expect(() => parseTarget("https://github.com/o/r/blob/main/a.ak")).toThrow();
});

test("pickProject: exact, ancestor, descendants, and the empty case", () => {
  expect(pickProject(projects, "01_sell_nft")).toEqual({ project: "01_sell_nft" });
  expect(pickProject(projects, "01_sell_nft/validators")).toEqual({ project: "01_sell_nft" });
  expect(pickProject(["a/x", "a/y", "b"], "a")).toEqual({ choose: ["a/x", "a/y"] });
  expect(pickProject(["a/x", "b"], "")).toEqual({ choose: ["a/x", "b"] });
  expect(pickProject(["only"], "")).toEqual({ project: "only" });
  expect(() => pickProject([], "")).toThrow();
});

test("selectTop returns three distinct (rule,file) slots, highest impact first", () => {
  const c = (rule, file) => ({ rule, file, line: 1, why: "", attackSketch: "" });
  const list = [c("dust-value-check", "a"), c("else", "a"), c("double-satisfaction", "a"), c("double-satisfaction", "a"), c("missing-signer-check", "b"), c("other", "c")];
  const top = selectTop(list);
  expect(top.length).toBe(3);
  expect(top.slice(0, 2).map((i) => list[i].rule)).toEqual(["double-satisfaction", "missing-signer-check"]);
});
