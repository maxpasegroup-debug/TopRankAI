import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { matchingSection } from "@/server/platform/syllabus-sections";

it("returns precisely the complete NEET unit for Ohm’s law", () => {
  const text = readFileSync("syllabus/NEET/syllabus-for-neet-ug-2026.txt", "utf8").replace(/\r/g, "");
  const start = text.indexOf("UNIT 12: CURRENT ELECTRICITY");
  const end = text.indexOf("UNIT 13:", start);
  expect(matchingSection(text, "NEET", "Ohm's law and resistivity", "Current Electricity", "", "Physics")?.text)
    .toBe(text.slice(start, end).trim());
});

it("retains the tail of long sections and respects the subject when headings repeat", () => {
  const unit = "UNIT 3: THERMODYNAMICS\n" + "A complete line of syllabus text.\n".repeat(150) + "Final requirement.";
  const source = "PHYSICS\n" + unit + "\nCHEMISTRY\nUNIT 1: THERMODYNAMICS\nOther requirements.";
  expect(matchingSection(source, "NEET", "Thermodynamics", "", "", "Physics")?.text).toBe(unit);
});

it("keeps pattern-only bulletins from producing topic quotations", () => {
  expect(matchingSection("Section 1: Admission\nCalculate percentages on the form.", "IBPS_PO", "Percentages")).toBeNull();
});
