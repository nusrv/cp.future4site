import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isFuturePublicEligible, matchesClaimApplicability } from "../src/shared/knowledgeClaims";

type Scenario = {
  name: string;
  claim: Parameters<typeof isFuturePublicEligible>[0];
  applicability: Parameters<typeof matchesClaimApplicability>[0];
  context: Parameters<typeof matchesClaimApplicability>[1];
  at: string;
  expected: boolean;
};

const scenarios = JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/knowledge-retrieval-evaluation.json"), "utf8")) as Scenario[];

describe("knowledge retrieval evaluation gate", () => {
  for (const scenario of scenarios) {
    it(scenario.name, () => {
      const actual = isFuturePublicEligible(scenario.claim, new Date(scenario.at)) &&
        matchesClaimApplicability(scenario.applicability, scenario.context);
      expect(actual).toBe(scenario.expected);
    });
  }

  it("keeps semantic retrieval unimplemented until the documented evidence gate passes", () => {
    const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const runtime = [
      readFileSync(join(process.cwd(), "src/server/services/knowledgeResolver.ts"), "utf8"),
      readFileSync(join(process.cwd(), "src/server/services/knowledgeEvidence.ts"), "utf8")
    ].join("\n");
    expect(schema).not.toMatch(/embedding|vector/i);
    expect(runtime).not.toMatch(/cosine|semantic|embedding|vector/i);
  });
});
