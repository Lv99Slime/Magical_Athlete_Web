import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  RACERS,
  createGame,
  projectState,
  seededRandom,
} from "../packages/engine/src/index";
import {
  RACER_TRANSLATIONS,
  racerLabel,
  racerTranslation,
  translateEvent,
  translateGameText,
} from "../apps/web/src/racerTranslations";

describe("Traditional Chinese gameplay presentation", () => {
  it("covers exactly the supplied 36 racers while preserving bilingual identity", () => {
    expect(Object.keys(RACER_TRANSLATIONS).sort()).toEqual(
      RACERS.map((r) => r.id).sort(),
    );
    for (const racer of RACERS) {
      const zh = racerTranslation(racer.id, "zh-Hant")!;
      expect(zh.name).toMatch(/[\u3400-\u9fff]/);
      expect(zh.powerName).toMatch(/[\u3400-\u9fff]/);
      expect(zh.uiSummary).toMatch(/[\u3400-\u9fff]/);
      expect(racerLabel(racer.id, "zh-Hant")).toContain(racer.name);
      expect(racerTranslation(racer.id, "en")).toEqual(racer);
    }
  });

  it("distinguishes modifying movement from retaining a finalized die face", () => {
    const amount = translateGameText(
      "Use 4 as the main-move amount?",
      "zh-Hant",
    );
    const face = translateGameText("Alchemist keeps 1.", "zh-Hant");
    expect(amount).toContain("步數");
    expect(amount).toContain("4");
    expect(amount).not.toContain("骰點改");
    expect(face).toContain("骰點 1");
    expect(face).not.toContain("步數");
    expect(RACER_TRANSLATIONS.gunk.uiSummary).toContain("不會改變骰點");
    expect(RACER_TRANSLATIONS.alchemist.uiSummary).toContain("骰點本身不變");
  });

  it("translates every current static engine prompt and choice without source-language leftovers", () => {
    const strings = new Set<string>();
    for (const filename of ["runtime.ts", "powers.ts"]) {
      const source = ts.createSourceFile(
        filename,
        readFileSync(
          new URL(`../packages/engine/src/${filename}`, import.meta.url),
          "utf8",
        ),
        ts.ScriptTarget.Latest,
        true,
      );
      function visit(node: ts.Node) {
        if (ts.isCallExpression(node)) {
          const callee = node.expression;
          const prompt =
            ts.isPropertyAccessExpression(callee) && callee.name.text === "ask"
              ? node.arguments[2]
              : ts.isIdentifier(callee) && callee.text === "optional"
                ? node.arguments[3]
                : undefined;
          if (prompt && ts.isStringLiteral(prompt)) strings.add(prompt.text);
        }
        if (
          ts.isPropertyAssignment(node) &&
          node.name.getText(source) === "label" &&
          ts.isStringLiteral(node.initializer)
        )
          strings.add(node.initializer.text);
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect(strings.size).toBeGreaterThan(20);
    for (const english of strings) {
      const translated = translateGameText(english, "zh-Hant");
      expect(translated, english).toMatch(/[\u3400-\u9fff]/);
      expect(translated, english).not.toMatch(/[A-Za-z]{2,}/);
    }
    for (const message of [
      "Keep 6",
      "POOF reroll (1 left)",
      "Follow Suckerfish for its complete move?",
      "Swap with Huge Baby",
      "Duel Magician",
      "Space 29",
    ]) {
      expect(translateGameText(message, "zh-Hant"), message).not.toMatch(
        /[A-Za-z]{2,}/,
      );
    }
  });

  it("never translates player nicknames or mutates stored event records", () => {
    const s = createGame(
      { names: ["Egg", "Banana", "Genius"], randomTeams: true },
      seededRandom(5),
    );
    const view = projectState(s, s.players[0].id);
    const events = [
      { id: 1, type: "RACER_DRAFTED", message: "Egg drafts Banana." },
      { id: 2, type: "POINTS", message: "Banana +1: Star." },
      { id: 3, type: "DIE_ROLLED", message: "Genius rolled 6." },
    ];
    const original = structuredClone(events);
    for (const event of events) Object.freeze(event);
    expect(translateEvent(events[0], "zh-Hant", view)).toBe("Egg選擇了香蕉。");
    expect(translateEvent(events[1], "zh-Hant", view)).toBe(
      "Banana +1 分：星星格。",
    );
    expect(translateEvent(events[2], "zh-Hant", view)).toBe("Genius擲出 6。");
    expect(events).toEqual(original);
    for (const event of events)
      expect(translateEvent(event, "en", view)).toBe(event.message);
  });
});
