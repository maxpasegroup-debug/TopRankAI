import { Prisma } from "@/generated/prisma/client";
import { ValidationApiError } from "@/server/api/errors";

export const decimalPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
type Config = { type: string; mode: string | null; marks: string; negativeMarks: string;
  numericalAnswer: string | null; options: { id: string; isCorrect: boolean }[] };
export function scoreAnswer(config: Config, answer: { optionIds?: string[]; numerical?: string }) {
  const invalid = () => new ValidationApiError("This question cannot be scored right now");
  let marks: Prisma.Decimal, penalty: Prisma.Decimal;
  try { marks = new Prisma.Decimal(config.marks); penalty = new Prisma.Decimal(config.negativeMarks); } catch { throw invalid(); }
  if (!marks.isFinite() || !penalty.isFinite() || marks.lte(0) || penalty.lt(0)) throw invalid();
  let correct: boolean;
  if (config.type === "NUMERICAL") {
    if (config.mode !== "DECIMAL_EXACT" || !config.numericalAnswer || !decimalPattern.test(config.numericalAnswer) || config.numericalAnswer.length > 60) throw invalid();
    if (answer.optionIds !== undefined || !answer.numerical || !decimalPattern.test(answer.numerical) || answer.numerical.length > 60) throw new ValidationApiError("Enter a valid numerical answer");
    correct = new Prisma.Decimal(answer.numerical).eq(new Prisma.Decimal(config.numericalAnswer));
  } else {
    if (config.mode !== "EXACT_SET" || !["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(config.type)) throw invalid();
    const expected = config.options.filter((o) => o.isCorrect).map((o) => o.id);
    if (!expected.length || (config.type === "SINGLE_CHOICE" && expected.length !== 1)) throw invalid();
    const selected = answer.optionIds;
    if (answer.numerical !== undefined || !selected?.length || new Set(selected).size !== selected.length ||
      selected.some((id) => !config.options.some((o) => o.id === id)) || (config.type === "SINGLE_CHOICE" && selected.length !== 1)) {
      throw new ValidationApiError("Choose valid answer options");
    }
    correct = selected.length === expected.length && selected.every((id) => expected.includes(id));
  }
  return { correct, score: correct ? marks : penalty.negated(), maximumScore: marks };
}
