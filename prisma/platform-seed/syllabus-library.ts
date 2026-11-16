import { physics, chemistry, biology, type UnitSeed } from "./syllabus-core";

export type { TopicSeed, ChapterSeed, UnitSeed } from "./syllabus-core";

const t = (slug: string, title: string, description: string, extra: Partial<import("./syllabus-core").TopicSeed> = {}) => ({
  slug, title, description, ...extra,
});
const c = (slug: string, title: string, description: string, topics: ReturnType<typeof t>[]) => ({
  slug, title, description, topics,
});
const u = (slug: string, title: string, description: string, chapters: ReturnType<typeof c>[]) => ({
  slug, title, description, chapters,
});

export const mathematics: UnitSeed[] = [
  u("algebra", "Algebra", "Sets, functions, equations, sequences and complex numbers.", [
    c("sets-relations-functions", "Sets, Relations and Functions", "Set operations, relations and function properties.", [
      t("set-operations", "Set operations", "Apply union, intersection, complement and De Morgan's laws.", {
        content: "For sets A and B, the union A ∪ B contains every element in either set. The intersection A ∩ B contains elements common to both. The complement A′ contains elements of the universal set not in A. De Morgan's laws state (A ∪ B)′ = A′ ∩ B′ and (A ∩ B)′ = A′ ∪ B′.",
        formulas: "n(A ∪ B) = n(A) + n(B) − n(A ∩ B)\\n(A ∪ B)′ = A′ ∩ B′",
        difficulty: "EASY",
      }),
      t("domain-range", "Domain and range", "Find valid inputs and outputs for functions.", { difficulty: "MEDIUM" }),
      t("composition", "Composition and inverse functions", "Analyse fog and f⁻¹.", { difficulty: "HARD" }),
    ]),
    c("quadratic-equations", "Quadratic Equations", "Roots, discriminant and transformations.", [
      t("nature-of-roots", "Nature of roots", "Use the discriminant to classify roots.", { difficulty: "EASY" }),
      t("root-relations", "Sum and product of roots", "Apply α + β = −b/a and αβ = c/a.", { difficulty: "MEDIUM" }),
      t("quadratic-inequalities", "Quadratic inequalities", "Solve inequalities using sign schemes.", { difficulty: "MEDIUM" }),
    ]),
    c("sequences-series", "Sequences and Series", "Arithmetic, geometric and special series.", [
      t("arithmetic-progression", "Arithmetic progression", "Find nth terms, sums and inserted means.", { difficulty: "EASY" }),
      t("geometric-progression", "Geometric progression", "Find sums of finite and infinite GPs.", { difficulty: "MEDIUM" }),
      t("special-series", "Special series", "Sum squares, cubes and telescoping series.", { difficulty: "HARD" }),
    ]),
    c("complex-numbers", "Complex Numbers", "Algebra and geometry of complex numbers.", [
      t("modulus-argument", "Modulus, argument and polar form", "Convert between Cartesian and polar forms.", { difficulty: "MEDIUM" }),
      t("roots-of-unity", "Cube roots of unity", "Use 1, ω and ω² identities.", { difficulty: "MEDIUM" }),
    ]),
  ]),
  u("trigonometry", "Trigonometry", "Identities, equations and inverse trigonometric functions.", [
    c("trigonometric-functions", "Trigonometric Functions", "Ratios, identities and graphs.", [
      t("identities", "Trigonometric identities", "Simplify expressions with Pythagorean and sum formulas.", { difficulty: "MEDIUM" }),
      t("graphs", "Graphs of trigonometric functions", "Sketch sine, cosine and tangent graphs.", { difficulty: "EASY" }),
      t("inverse", "Inverse trigonometric functions", "Evaluate principal values and simplify expressions.", { difficulty: "HARD" }),
    ]),
    c("trigonometric-equations", "Trigonometric Equations", "General solutions and interval restrictions.", [
      t("general-solutions", "General solutions", "Solve equations such as sin θ = k.", { difficulty: "MEDIUM" }),
      t("interval-solutions", "Solutions in an interval", "Restrict general solutions to a given range.", { difficulty: "MEDIUM" }),
    ]),
  ]),
  u("calculus", "Calculus", "Limits, derivatives and integrals.", [
    c("limits-continuity", "Limits and Continuity", "Evaluate limits and test continuity.", [
      t("limits", "Limits", "Evaluate algebraic and trigonometric limits.", { difficulty: "MEDIUM" }),
      t("continuity", "Continuity", "Test continuity at a point.", { difficulty: "MEDIUM" }),
      t("differentiability", "Differentiability", "Relate continuity and differentiability.", { difficulty: "HARD" }),
    ]),
    c("differentiation", "Differentiation", "Rules, applications and maxima.", [
      t("rules", "Differentiation rules", "Apply product, quotient and chain rules.", { difficulty: "MEDIUM" }),
      t("tangents", "Tangents and normals", "Find slopes and equations of tangents.", { difficulty: "MEDIUM" }),
      t("maxima-minima", "Maxima and minima", "Use derivatives to optimise functions.", { difficulty: "HARD" }),
    ]),
    c("integration", "Integration", "Indefinite and definite integrals with applications.", [
      t("standard-integrals", "Standard integrals", "Integrate common algebraic and trigonometric forms.", { difficulty: "MEDIUM" }),
      t("definite-integrals", "Definite integrals", "Evaluate definite integrals and use properties.", { difficulty: "HARD" }),
      t("areas", "Area under curves", "Compute areas between curves.", { difficulty: "HARD" }),
    ]),
  ]),
  u("coordinate-geometry", "Coordinate Geometry", "Lines, circles and conic sections.", [
    c("straight-lines", "Straight Lines", "Slopes, equations and distances.", [
      t("line-equations", "Equations of a line", "Write lines in slope, intercept and general forms.", { difficulty: "EASY" }),
      t("distance", "Distance and angle formulas", "Find distances and angles between lines.", { difficulty: "MEDIUM" }),
      t("family-of-lines", "Family of lines", "Use concurrent lines and line pairs.", { difficulty: "HARD" }),
    ]),
    c("circles", "Circles", "Equations, tangents and chords.", [
      t("circle-equation", "Equation of a circle", "Find centre and radius from general form.", { difficulty: "MEDIUM" }),
      t("tangents", "Tangents and normals to a circle", "Use the perpendicular-distance condition.", { difficulty: "HARD" }),
    ]),
    c("conic-sections", "Conic Sections", "Parabola, ellipse and hyperbola.", [
      t("parabola", "Parabola", "Identify focus, directrix and latus rectum.", { difficulty: "MEDIUM" }),
      t("ellipse-hyperbola", "Ellipse and hyperbola", "Find eccentricity, axes and foci.", { difficulty: "HARD" }),
    ]),
  ]),
  u("vectors-3d", "Vectors and 3D Geometry", "Vector algebra and three-dimensional lines and planes.", [
    c("vectors", "Vector Algebra", "Dot and cross products with geometric applications.", [
      t("dot-product", "Dot product", "Compute angles and projections.", { difficulty: "MEDIUM" }),
      t("cross-product", "Cross product", "Find areas and perpendicular vectors.", { difficulty: "MEDIUM" }),
      t("triple-product", "Scalar triple product", "Compute volumes of parallelepipeds.", { difficulty: "HARD" }),
    ]),
    c("three-dimensional-geometry", "Three-Dimensional Geometry", "Lines and planes in space.", [
      t("lines-in-space", "Lines in space", "Write vector and Cartesian equations of lines.", { difficulty: "MEDIUM" }),
      t("planes", "Planes", "Find plane equations, angles and distances.", { difficulty: "HARD" }),
    ]),
  ]),
  u("probability-statistics", "Probability and Statistics", "Probability rules and descriptive statistics.", [
    c("probability", "Probability", "Conditional probability and Bayes' theorem.", [
      t("conditional-probability", "Conditional probability", "Apply P(A|B) = P(A∩B)/P(B).", { difficulty: "MEDIUM" }),
      t("bayes", "Bayes' theorem", "Update probabilities with new evidence.", { difficulty: "HARD" }),
      t("distributions", "Binomial and Poisson distributions", "Compute probabilities for standard distributions.", { difficulty: "HARD" }),
    ]),
    c("statistics", "Statistics", "Mean, variance and standard deviation.", [
      t("central-tendency", "Measures of central tendency", "Compute mean, median and mode.", { difficulty: "EASY" }),
      t("dispersion", "Measures of dispersion", "Compute variance and standard deviation.", { difficulty: "MEDIUM" }),
    ]),
  ]),
];

export const english: UnitSeed[] = [
  u("grammar", "Grammar", "Sentence structure, tense and usage.", [
    c("tenses", "Tenses", "Present, past and future forms.", [
      t("present-tense", "Present tenses", "Choose simple, continuous and perfect forms.", { difficulty: "EASY" }),
      t("past-tense", "Past tenses", "Use past simple, continuous and perfect correctly.", { difficulty: "MEDIUM" }),
      t("future-tense", "Future forms", "Distinguish will, going to and present continuous.", { difficulty: "MEDIUM" }),
    ]),
    c("agreement", "Subject-Verb Agreement", "Singular and plural agreement rules.", [
      t("basic-agreement", "Basic agreement", "Match subjects and verbs in number.", { difficulty: "EASY" }),
      t("tricky-agreement", "Tricky agreement cases", "Handle collective nouns and compound subjects.", { difficulty: "MEDIUM" }),
    ]),
    c("articles-prepositions", "Articles and Prepositions", "Determiners and prepositional usage.", [
      t("articles", "Articles", "Choose a, an and the correctly.", { difficulty: "EASY" }),
      t("prepositions", "Prepositions", "Use prepositions of time, place and direction.", { difficulty: "MEDIUM" }),
    ]),
  ]),
  u("vocabulary", "Vocabulary", "Word meaning and idiomatic usage.", [
    c("synonyms-antonyms", "Synonyms and Antonyms", "Build precise word knowledge.", [
      t("synonyms", "Synonyms", "Choose the closest meaning in context.", { difficulty: "MEDIUM" }),
      t("antonyms", "Antonyms", "Choose the opposite meaning in context.", { difficulty: "MEDIUM" }),
    ]),
    c("idioms", "Idioms and Phrases", "Figurative expressions in standard English.", [
      t("common-idioms", "Common idioms", "Interpret frequently tested idioms.", { difficulty: "MEDIUM" }),
      t("phrasal-verbs", "Phrasal verbs", "Distinguish meanings of verb-particle combinations.", { difficulty: "MEDIUM" }),
    ]),
  ]),
  u("comprehension", "Reading Comprehension", "Main idea, inference and structure.", [
    c("reading-comprehension", "Reading Comprehension", "Read passages for explicit and implicit meaning.", [
      t("main-idea", "Main idea and tone", "Identify the central claim and author's tone.", { difficulty: "MEDIUM" }),
      t("inference", "Inference", "Draw conclusions supported by the passage.", { difficulty: "HARD" }),
      t("vocabulary-in-context", "Vocabulary in context", "Infer word meaning from surrounding text.", { difficulty: "MEDIUM" }),
    ]),
    c("para-jumbles", "Para Jumbles", "Reconstruct coherent paragraphs.", [
      t("sentence-order", "Sentence ordering", "Use connectors and pronoun reference to order sentences.", { difficulty: "HARD" }),
      t("odd-sentence", "Odd sentence out", "Identify the sentence that breaks paragraph unity.", { difficulty: "HARD" }),
    ]),
  ]),
];

export const logicalReasoning: UnitSeed[] = [
  u("verbal-reasoning", "Verbal Reasoning", "Patterns, codes and series.", [
    c("series-analogy", "Series and Analogy", "Number, letter and figure patterns.", [
      t("number-series", "Number series", "Find the rule behind a number sequence.", { difficulty: "MEDIUM" }),
      t("letter-series", "Letter and symbol series", "Complete alphabet and symbol patterns.", { difficulty: "MEDIUM" }),
      t("analogy", "Analogy", "Identify the relationship between pairs.", { difficulty: "EASY" }),
    ]),
    c("coding-decoding", "Coding-Decoding", "Letter, number and substitution codes.", [
      t("letter-coding", "Letter coding", "Decode shifted and reversed alphabets.", { difficulty: "MEDIUM" }),
      t("conditional-coding", "Conditional coding", "Apply rule-based symbol substitution.", { difficulty: "HARD" }),
    ]),
  ]),
  u("analytical-reasoning", "Analytical Reasoning", "Puzzles, arrangements and deductions.", [
    c("puzzles-arrangements", "Puzzles and Arrangements", "Linear, circular and matrix arrangements.", [
      t("linear-arrangement", "Linear arrangement", "Place people or objects using constraints.", { difficulty: "MEDIUM" }),
      t("circular-arrangement", "Circular arrangement", "Handle facing-inside and facing-outside puzzles.", { difficulty: "HARD" }),
      t("blood-relations", "Blood relations", "Trace family relationships through clues.", { difficulty: "MEDIUM" }),
    ]),
    c("syllogisms", "Syllogisms and Deduction", "Valid conclusions from given statements.", [
      t("syllogism-basics", "Syllogism basics", "Use Venn diagrams to test conclusions.", { difficulty: "MEDIUM" }),
      t("assumptions", "Statement and assumption", "Identify implicit assumptions.", { difficulty: "HARD" }),
    ]),
  ]),
  u("critical-reasoning", "Critical Reasoning", "Arguments, assumptions and evidence.", [
    c("argument-analysis", "Argument Analysis", "Evaluate reasoning structure.", [
      t("strengthen-weaken", "Strengthen and weaken", "Judge how evidence affects an argument.", { difficulty: "HARD" }),
      t("assumption", "Necessary assumptions", "Find the unstated premise an argument needs.", { difficulty: "HARD" }),
    ]),
    c("conclusions", "Conclusions and Inference", "Decide what follows from a passage.", [
      t("valid-conclusion", "Valid conclusions", "Separate supported conclusions from speculation.", { difficulty: "MEDIUM" }),
      t("cause-effect", "Cause and effect", "Distinguish correlation from causation.", { difficulty: "HARD" }),
    ]),
  ]),
];

export const quantitativeAptitude: UnitSeed[] = [
  u("arithmetic", "Arithmetic", "Percentages, ratios, interest and speed.", [
    c("percentages", "Percentages", "Percentage change and applications.", [
      t("percentage-basics", "Percentage basics", "Convert between fractions, decimals and percentages.", { difficulty: "EASY" }),
      t("percentage-change", "Percentage increase and decrease", "Compute successive percentage changes.", { difficulty: "MEDIUM" }),
      t("applications", "Applications of percentages", "Solve population, marks and discount problems.", { difficulty: "MEDIUM" }),
    ]),
    c("profit-loss", "Profit and Loss", "Cost price, selling price and discounts.", [
      t("profit-loss-basics", "Profit and loss basics", "Compute profit percentage and selling price.", { difficulty: "EASY" }),
      t("discount", "Discount and marked price", "Combine discounts with profit margins.", { difficulty: "MEDIUM" }),
      t("successive-discount", "Successive discounts", "Use the net-discount formula.", { difficulty: "HARD" }),
    ]),
    c("ratio-proportion", "Ratio and Proportion", "Ratios, proportions and partnerships.", [
      t("ratio-basics", "Ratio basics", "Simplify and compare ratios.", { difficulty: "EASY" }),
      t("proportion", "Proportion", "Solve direct and inverse proportion problems.", { difficulty: "MEDIUM" }),
      t("partnership", "Partnership", "Divide profit by investment ratio.", { difficulty: "MEDIUM" }),
    ]),
    c("time-speed-distance", "Time, Speed and Distance", "Relative speed, trains and boats.", [
      t("speed-basics", "Speed basics", "Use distance = speed × time.", { difficulty: "EASY" }),
      t("relative-speed", "Relative speed", "Solve trains and two-body problems.", { difficulty: "MEDIUM" }),
      t("boats-streams", "Boats and streams", "Handle upstream and downstream speeds.", { difficulty: "MEDIUM" }),
    ]),
    c("time-work", "Time and Work", "Work rates and pipes.", [
      t("work-rates", "Work rates", "Combine individual rates to find total time.", { difficulty: "MEDIUM" }),
      t("pipes-cisterns", "Pipes and cisterns", "Solve filling and emptying problems.", { difficulty: "MEDIUM" }),
    ]),
    c("interest", "Simple and Compound Interest", "Interest formulas and growth.", [
      t("simple-interest", "Simple interest", "Apply SI = PRT/100.", { difficulty: "EASY" }),
      t("compound-interest", "Compound interest", "Apply A = P(1 + R/100)ⁿ.", { difficulty: "MEDIUM" }),
    ]),
    c("averages", "Averages", "Mean, weighted mean and replacement.", [
      t("average-basics", "Average basics", "Compute average and total.", { difficulty: "EASY" }),
      t("weighted-average", "Weighted average", "Combine groups with different averages.", { difficulty: "MEDIUM" }),
    ]),
  ]),
  u("algebra-aptitude", "Algebra for Aptitude", "Equations, surds and indices.", [
    c("linear-equations", "Linear Equations", "One and two variable systems.", [
      t("one-variable", "One-variable equations", "Solve and interpret linear equations.", { difficulty: "EASY" }),
      t("two-variable", "Two-variable systems", "Use elimination and substitution.", { difficulty: "MEDIUM" }),
    ]),
    c("surds-indices", "Surds and Indices", "Laws of exponents and simplification.", [
      t("indices", "Laws of indices", "Simplify expressions with exponents.", { difficulty: "MEDIUM" }),
      t("surds", "Surds", "Rationalise denominators and compare surds.", { difficulty: "MEDIUM" }),
    ]),
  ]),
  u("geometry-mensuration", "Geometry and Mensuration", "Triangles, circles, area and volume.", [
    c("triangles", "Triangles", "Properties, similarity and Pythagoras.", [
      t("triangle-properties", "Triangle properties", "Apply angle-sum and inequality rules.", { difficulty: "EASY" }),
      t("similarity", "Similarity and Pythagoras", "Use ratios and the Pythagorean theorem.", { difficulty: "MEDIUM" }),
    ]),
    c("circles-mensuration", "Circles and Mensuration", "Perimeter, area and volume.", [
      t("circle-mensuration", "Circle mensuration", "Compute circumference, area and sector area.", { difficulty: "MEDIUM" }),
      t("volume", "Volumes of solids", "Find volumes of cubes, cylinders and spheres.", { difficulty: "MEDIUM" }),
    ]),
  ]),
  u("data-interpretation", "Data Interpretation", "Tables, charts and caselets.", [
    c("tables", "Tables and Caselets", "Read and compute from tabular data.", [
      t("table-reading", "Table reading", "Extract values and compute ratios.", { difficulty: "MEDIUM" }),
      t("caselets", "Caselets", "Solve multi-step data cases.", { difficulty: "HARD" }),
    ]),
    c("charts", "Charts", "Bar, line and pie charts.", [
      t("pie-charts", "Pie charts", "Convert angles and percentages.", { difficulty: "MEDIUM" }),
      t("line-charts", "Line and bar charts", "Compare trends across categories.", { difficulty: "MEDIUM" }),
    ]),
  ]),
];

export const generalAwareness: UnitSeed[] = [
  u("indian-polity", "Indian Polity", "Constitution, institutions and rights.", [
    c("constitution", "The Constitution", "Foundations, fundamental rights and duties.", [
      t("preamble", "Preamble and features", "Recall the ideals and structure of the Constitution.", { difficulty: "EASY" }),
      t("fundamental-rights", "Fundamental rights", "Identify the six categories of rights.", { difficulty: "MEDIUM" }),
      t("amendments", "Amendments", "Trace important constitutional amendments.", { difficulty: "HARD" }),
    ]),
    c("parliament", "Parliament and Executive", "Legislature, executive and federal structure.", [
      t("parliament", "Parliament", "Compare the Lok Sabha and Rajya Sabha.", { difficulty: "MEDIUM" }),
      t("president", "President and Council of Ministers", "Explain executive powers and procedures.", { difficulty: "MEDIUM" }),
    ]),
    c("judiciary", "Judiciary", "Courts, jurisdiction and judicial review.", [
      t("supreme-court", "Supreme Court", "Describe jurisdiction and writ powers.", { difficulty: "MEDIUM" }),
      t("high-courts", "High Courts and subordinate courts", "Explain the court hierarchy.", { difficulty: "MEDIUM" }),
    ]),
  ]),
  u("geography", "Geography", "Physical and human geography of India and the world.", [
    c("physical-geography", "Physical Geography", "Earth systems, landforms and climate.", [
      t("earth-structure", "Earth structure and plate tectonics", "Explain layers and plate movement.", { difficulty: "MEDIUM" }),
      t("climate", "Climate and monsoon", "Describe controls of climate and the Indian monsoon.", { difficulty: "MEDIUM" }),
      t("rivers", "Rivers and drainage", "Compare Himalayan and peninsular drainage.", { difficulty: "MEDIUM" }),
    ]),
    c("indian-geography", "Indian Geography", "Regions, resources and agriculture.", [
      t("physiographic-divisions", "Physiographic divisions", "Locate mountains, plateaus and plains.", { difficulty: "MEDIUM" }),
      t("resources", "Resources and agriculture", "Relate crops and minerals to regions.", { difficulty: "MEDIUM" }),
    ]),
  ]),
  u("history", "History", "Ancient, medieval and modern India.", [
    c("ancient-medieval", "Ancient and Medieval India", "Civilisations, empires and cultural developments.", [
      t("indus-valley", "Indus Valley Civilisation", "Describe urban planning and trade.", { difficulty: "EASY" }),
      t("mauryas-guptas", "Mauryas and Guptas", "Compare administration and achievements.", { difficulty: "MEDIUM" }),
      t("delhi-sultanate", "Delhi Sultanate and Mughals", "Trace political and cultural change.", { difficulty: "MEDIUM" }),
    ]),
    c("modern-india", "Modern India", "Colonial rule and the freedom movement.", [
      t("revolt-1857", "Revolt of 1857", "Explain causes and consequences.", { difficulty: "MEDIUM" }),
      t("national-movement", "National movement", "Sequence major Congress and mass movements.", { difficulty: "MEDIUM" }),
      t("independence", "Partition and independence", "Explain the transfer of power.", { difficulty: "HARD" }),
    ]),
  ]),
  u("economy", "Indian Economy", "Macroeconomic basics, budget and policy.", [
    c("economy-basics", "Economy Basics", "GDP, inflation and monetary policy.", [
      t("gdp", "GDP and national income", "Distinguish nominal and real GDP.", { difficulty: "MEDIUM" }),
      t("inflation", "Inflation", "Explain types, causes and measurement.", { difficulty: "MEDIUM" }),
      t("rbi", "Reserve Bank and monetary policy", "Describe repo rate and liquidity tools.", { difficulty: "HARD" }),
    ]),
    c("budget-taxation", "Budget and Taxation", "Public finance and the tax system.", [
      t("budget", "Union Budget", "Identify revenue and capital components.", { difficulty: "MEDIUM" }),
      t("taxation", "Direct and indirect taxes", "Compare tax types and GST structure.", { difficulty: "MEDIUM" }),
    ]),
  ]),
  u("environment", "Environment and Ecology", "Ecosystems, biodiversity and climate.", [
    c("ecology", "Ecology", "Ecosystem structure and energy flow.", [
      t("food-chains", "Food chains and webs", "Trace energy transfer between trophic levels.", { difficulty: "EASY" }),
      t("biodiversity", "Biodiversity and conservation", "Explain hotspots and protected areas.", { difficulty: "MEDIUM" }),
      t("pollution", "Pollution", "Classify air, water and soil pollutants.", { difficulty: "MEDIUM" }),
    ]),
    c("climate-change", "Climate Change", "Global warming, mitigation and agreements.", [
      t("greenhouse-effect", "Greenhouse effect", "Explain radiative forcing and warming.", { difficulty: "MEDIUM" }),
      t("climate-policy", "Climate policy", "Recall key international agreements.", { difficulty: "MEDIUM" }),
    ]),
  ]),
  u("current-affairs", "Current Affairs", "Recent national and international developments.", [
    c("national", "National Affairs", "Policy, institutions and economy in the news.", [
      t("national-policy", "National policy developments", "Track significant government initiatives.", { difficulty: "MEDIUM" }),
      t("national-events", "National events", "Review major events and appointments.", { difficulty: "MEDIUM" }),
    ]),
    c("international", "International Affairs", "Global institutions and relations.", [
      t("global-institutions", "Global institutions", "Know the mandate of major international bodies.", { difficulty: "MEDIUM" }),
      t("international-events", "International events", "Review summits and agreements.", { difficulty: "MEDIUM" }),
    ]),
  ]),
];

export const legalReasoning: UnitSeed[] = [
  u("legal-aptitude", "Legal Aptitude", "Principles, rules and legal reasoning.", [
    c("legal-principles", "Legal Principles", "Apply given principles to fact situations.", [
      t("principle-application", "Applying legal principles", "Decide cases from stated principles.", { difficulty: "HARD" }),
      t("torts", "Law of torts", "Identify negligence, nuisance and liability.", { difficulty: "HARD" }),
      t("contracts", "Contract law", "Test offer, acceptance and consideration.", { difficulty: "HARD" }),
    ]),
    c("legal-maxims", "Legal Maxims", "Latin maxims and their meaning.", [
      t("common-maxims", "Common legal maxims", "Match maxims to their legal meaning.", { difficulty: "MEDIUM" }),
      t("maxim-application", "Maxim application", "Apply maxims to short scenarios.", { difficulty: "HARD" }),
    ]),
  ]),
  u("legal-current-affairs", "Legal Current Affairs", "Recent legal developments and institutions.", [
    c("recent-developments", "Recent Developments", "Case law and legislative updates.", [
      t("landmark-cases", "Landmark judgments", "Recall constitutional principles from key cases.", { difficulty: "MEDIUM" }),
      t("legal-institutions", "Legal institutions", "Know the roles of courts and commissions.", { difficulty: "MEDIUM" }),
    ]),
  ]),
];

export const designAptitude: UnitSeed[] = [
  u("design-thinking", "Design Thinking", "Elements, principles and visual communication.", [
    c("elements-of-design", "Elements of Design", "Line, shape, colour, texture and space.", [
      t("colour-theory", "Colour theory", "Apply colour wheels, harmony and contrast.", { difficulty: "MEDIUM" }),
      t("composition", "Composition and balance", "Analyse visual balance and hierarchy.", { difficulty: "MEDIUM" }),
    ]),
    c("visualisation", "Visualisation", "Spatial reasoning and mental rotation.", [
      t("spatial-reasoning", "Spatial reasoning", "Reason about 2D views of 3D objects.", { difficulty: "HARD" }),
      t("isometric-views", "Isometric and orthographic views", "Match views to objects.", { difficulty: "HARD" }),
    ]),
  ]),
  u("observation", "Observation and Drawing", "Sketching, pattern and observation skills.", [
    c("drawing", "Drawing", "Proportion, perspective and rendering.", [
      t("perspective", "Perspective", "Apply one-point and two-point perspective.", { difficulty: "MEDIUM" }),
      t("proportion", "Proportion and scale", "Maintain proportion in observed drawings.", { difficulty: "MEDIUM" }),
    ]),
    c("pattern", "Pattern and Sequence", "Visual patterns and logical sequences.", [
      t("visual-patterns", "Visual patterns", "Complete and identify design sequences.", { difficulty: "MEDIUM" }),
      t("figure-series", "Figure series", "Reason about transformations in figures.", { difficulty: "HARD" }),
    ]),
  ]),
];

export const computerAwareness: UnitSeed[] = [
  u("computer-fundamentals", "Computer Fundamentals", "Hardware, software and networks.", [
    c("hardware", "Hardware", "Components and storage.", [
      t("computer-components", "Computer components", "Identify CPU, memory and input/output devices.", { difficulty: "EASY" }),
      t("memory", "Memory and storage", "Compare RAM, ROM and secondary storage.", { difficulty: "EASY" }),
    ]),
    c("software", "Software", "Operating systems and applications.", [
      t("operating-systems", "Operating systems", "Describe process and file management.", { difficulty: "MEDIUM" }),
      t("databases", "Databases", "Understand tables, keys and queries.", { difficulty: "MEDIUM" }),
    ]),
  ]),
  u("digital-awareness", "Digital Awareness", "Internet and cyber safety.", [
    c("internet", "Internet", "Networks, protocols and services.", [
      t("internet-basics", "Internet basics", "Explain IP, DNS and HTTP.", { difficulty: "MEDIUM" }),
      t("web-services", "Web services", "Distinguish websites, email and cloud services.", { difficulty: "EASY" }),
    ]),
    c("cyber-security", "Cyber Security", "Threats and safe practices.", [
      t("threats", "Common cyber threats", "Recognise phishing and malware.", { difficulty: "MEDIUM" }),
      t("safe-practices", "Safe digital practices", "Apply password and privacy hygiene.", { difficulty: "EASY" }),
    ]),
  ]),
];

export const engineeringMathematics: UnitSeed[] = [
  u("discrete-mathematics", "Discrete Mathematics", "Logic, sets, relations and graphs.", [
    c("logic", "Mathematical Logic", "Propositional logic and proofs.", [
      t("propositions", "Propositions and connectives", "Evaluate truth tables.", { difficulty: "MEDIUM" }),
      t("inference", "Rules of inference", "Build valid arguments.", { difficulty: "HARD" }),
    ]),
    c("sets-graphs", "Sets and Graphs", "Set algebra and graph properties.", [
      t("set-algebra", "Set algebra", "Apply identities and cardinality.", { difficulty: "MEDIUM" }),
      t("graphs", "Graphs and trees", "Identify connectivity and spanning trees.", { difficulty: "HARD" }),
    ]),
  ]),
  u("linear-algebra", "Linear Algebra", "Matrices, determinants and eigenvalues.", [
    c("matrices", "Matrices", "Operations, rank and systems.", [
      t("matrix-operations", "Matrix operations", "Multiply, transpose and invert matrices.", { difficulty: "MEDIUM" }),
      t("rank", "Rank and linear systems", "Use row reduction to solve systems.", { difficulty: "HARD" }),
    ]),
    c("eigenvalues", "Eigenvalues and Eigenvectors", "Characteristic equations and diagonalisation.", [
      t("eigenvalues", "Eigenvalues and eigenvectors", "Compute eigenvalues of small matrices.", { difficulty: "HARD" }),
      t("diagonalisation", "Diagonalisation", "Determine when a matrix is diagonalisable.", { difficulty: "HARD" }),
    ]),
  ]),
];

export const syllabusBySubject: Record<string, UnitSeed[]> = {
  PHYSICS: physics,
  CHEMISTRY: chemistry,
  BIOLOGY: biology,
  MATHEMATICS: mathematics,
  ENGLISH: english,
  LOGICAL_REASONING: logicalReasoning,
  QUANTITATIVE_APTITUDE: quantitativeAptitude,
  GENERAL_AWARENESS: generalAwareness,
  LEGAL_REASONING: legalReasoning,
  DESIGN_APTITUDE: designAptitude,
  COMPUTER_AWARENESS: computerAwareness,
  ENGINEERING_MATHEMATICS: engineeringMathematics,
};
