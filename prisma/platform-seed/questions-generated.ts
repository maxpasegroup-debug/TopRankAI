import type { QuestionSeed } from "./types";

const round = (value: number, places = 2) => Number(value.toFixed(places));
const show = (value: number) => String(round(value));

function build(
  code: string,
  text: string,
  correct: number,
  distractors: number[],
  explanation: string,
  topicSlug: string,
  difficulty: QuestionSeed["difficulty"],
  tags: string[],
): QuestionSeed {
  const unique = [correct, ...distractors.filter((value) => value !== correct)].slice(0, 4);
  while (unique.length < 4) unique.push(round(correct + unique.length * 7 + 3));
  const rotation = code.charCodeAt(code.length - 1) % 4;
  const ordered = [...unique.slice(rotation), ...unique.slice(0, rotation)];
  return {
    code,
    text,
    type: "SINGLE_CHOICE",
    difficulty,
    subject: "QUANTITATIVE_APTITUDE",
    topicSlug,
    options: ordered.map((value, index) => ({ code: String.fromCharCode(65 + index), text: show(value), correct: value === correct })),
    explanation,
    sourceType: "ADMIN_CREATED",
    tags,
  };
}

const questions: QuestionSeed[] = [];

const percentages: [number, number][] = [
  [12, 250], [15, 200], [20, 350], [25, 480], [8, 625], [30, 150], [18, 500], [45, 220],
];
percentages.forEach(([rate, base], index) => {
  const correct = round((rate * base) / 100);
  questions.push(build(
    `GEN-PCT-${String(index + 1).padStart(2, "0")}`,
    `What is ${rate}% of ${base}?`,
    correct,
    [round(correct + 10), round(correct - 5), round(correct * 2)],
    `${rate}% of ${base} = (${rate}/100) × ${base} = ${show(correct)}.`,
    "percentage-basics", "EASY", ["percentage", "arithmetic"],
  ));
});

const averages: number[][] = [
  [2, 4, 6, 8], [5, 10, 15, 20], [12, 18, 24, 30], [7, 9, 11, 13], [21, 24, 27, 30], [3, 8, 13, 18],
];
averages.forEach((values, index) => {
  const correct = round(values.reduce((sum, value) => sum + value, 0) / values.length);
  questions.push(build(
    `GEN-AVG-${String(index + 1).padStart(2, "0")}`,
    `What is the average of ${values.join(", ")}?`,
    correct,
    [round(correct + 2), round(correct - 1), round(correct * 2)],
    `Sum = ${values.reduce((sum, value) => sum + value, 0)}. Average = sum / ${values.length} = ${show(correct)}.`,
    "average-basics", "EASY", ["averages", "arithmetic"],
  ));
});

const interests: [number, number, number][] = [
  [1000, 10, 2], [2500, 8, 3], [5000, 12, 2], [800, 5, 4], [12000, 6, 2], [3600, 15, 1],
];
interests.forEach(([principal, rate, years], index) => {
  const correct = round((principal * rate * years) / 100);
  questions.push(build(
    `GEN-SI-${String(index + 1).padStart(2, "0")}`,
    `Find the simple interest on ₹${principal} at ${rate}% per annum for ${years} year${years > 1 ? "s" : ""}.`,
    correct,
    [round(correct * 2), round(correct / 2), round(correct + 100)],
    `SI = PRT/100 = (${principal} × ${rate} × ${years}) / 100 = ₹${show(correct)}.`,
    "simple-interest", "EASY", ["interest", "arithmetic"],
  ));
});

const profits: [number, number][] = [
  [80, 100], [120, 150], [250, 300], [400, 460], [640, 800], [1500, 1800],
];
profits.forEach(([cost, selling], index) => {
  const correct = round(((selling - cost) / cost) * 100);
  questions.push(build(
    `GEN-PRF-${String(index + 1).padStart(2, "0")}`,
    `An article bought for ₹${cost} is sold for ₹${selling}. What is the profit percentage?`,
    correct,
    [round(correct + 5), round(((selling - cost) / selling) * 100), round(correct * 2)],
    `Profit = ${selling} − ${cost} = ₹${selling - cost}. Profit % = (profit / cost) × 100 = ${show(correct)}%.`,
    "profit-loss-basics", "MEDIUM", ["profit-loss", "arithmetic"],
  ));
});

const ratios: [number, number, number][] = [
  [3, 5, 40], [2, 3, 50], [5, 7, 72], [4, 9, 65], [7, 8, 90], [11, 14, 100],
];
ratios.forEach(([first, second, total], index) => {
  const larger = round((Math.max(first, second) * total) / (first + second));
  questions.push(build(
    `GEN-RAT-${String(index + 1).padStart(2, "0")}`,
    `Two numbers are in the ratio ${first} : ${second} and their sum is ${total}. What is the larger number?`,
    larger,
    [round(total - larger), round(larger + 10), round(larger / 2)],
    `Total parts = ${first + second} = ${first + second}. One part = ${total}/${first + second} = ${show(total / (first + second))}. Larger number = ${Math.max(first, second)} × ${show(total / (first + second))} = ${show(larger)}.`,
    "ratio-basics", "MEDIUM", ["ratio", "arithmetic"],
  ));
});

const speeds: [number, number][] = [
  [120, 2], [180, 3], [75, 1.5], [240, 4], [45, 0.75], [350, 5],
];
speeds.forEach(([distance, hours], index) => {
  const correct = round(distance / hours);
  questions.push(build(
    `GEN-SPD-${String(index + 1).padStart(2, "0")}`,
    `A vehicle covers ${distance} km in ${hours} hour${hours === 1 ? "" : "s"}. What is its average speed in km/h?`,
    correct,
    [round(distance * hours), round(correct + 15), round(correct / 2)],
    `Speed = distance / time = ${distance} / ${hours} = ${show(correct)} km/h.`,
    "speed-basics", "EASY", ["speed", "arithmetic"],
  ));
});

const works: [number, number][] = [
  [6, 12], [10, 15], [8, 24], [20, 30], [9, 18], [12, 4],
];
works.forEach(([first, second], index) => {
  const correct = round((first * second) / (first + second));
  questions.push(build(
    `GEN-WRK-${String(index + 1).padStart(2, "0")}`,
    `A can finish a task in ${first} days and B in ${second} days. Working together, how many days will they take?`,
    correct,
    [round(first + second), round(correct + 2), round(correct / 2)],
    `Combined rate = 1/${first} + 1/${second}. Time = (${first} × ${second}) / (${first} + ${second}) = ${show(correct)} days.`,
    "work-rates", "MEDIUM", ["time-work", "arithmetic"],
  ));
});

const compounds: [number, number, number][] = [
  [1000, 10, 2], [2000, 5, 2], [5000, 8, 2], [8000, 10, 2], [1500, 20, 2], [4000, 25, 2],
];
compounds.forEach(([principal, rate, years], index) => {
  const amount = principal * Math.pow(1 + rate / 100, years);
  const correct = round(amount - principal);
  questions.push(build(
    `GEN-CI-${String(index + 1).padStart(2, "0")}`,
    `Find the compound interest on ₹${principal} at ${rate}% per annum for ${years} years, compounded annually.`,
    correct,
    [round(principal * rate * years / 100), round(correct + 50), round(correct * 2)],
    `A = P(1 + R/100)^T = ${principal}(1 + ${rate}/100)^${years} = ₹${show(amount)}. CI = A − P = ₹${show(correct)}.`,
    "compound-interest", "MEDIUM", ["interest", "arithmetic"],
  ));
});

export const generatedQuestions: QuestionSeed[] = questions;
