/**
 * Curated syllabus library. Unit, chapter and topic titles reflect publicly
 * published Indian exam syllabi. Content notes are deliberately short and are
 * expanded in the learning centre (by an administrator or, when configured, by
 * the AI study-notes assistant).
 */

export type TopicSeed = {
  slug: string;
  title: string;
  description: string;
  content?: string;
  formulas?: string;
  estimatedMinutes?: number;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
};

export type ChapterSeed = {
  slug: string;
  title: string;
  description: string;
  topics: TopicSeed[];
};

export type UnitSeed = {
  slug: string;
  title: string;
  description: string;
  chapters: ChapterSeed[];
};

const t = (slug: string, title: string, description: string, extra: Partial<TopicSeed> = {}): TopicSeed => ({
  slug, title, description, ...extra,
});

const c = (slug: string, title: string, description: string, topics: TopicSeed[]): ChapterSeed => ({
  slug, title, description, topics,
});

const u = (slug: string, title: string, description: string, chapters: ChapterSeed[]): UnitSeed => ({
  slug, title, description, chapters,
});

export const physics: UnitSeed[] = [
  u("mechanics", "Mechanics", "Measurement, motion, force and energy — the foundation of every physics paper.", [
    c("units-and-measurements", "Units and Measurements", "SI units, dimensions, errors and significant figures.", [
      t("si-units", "SI base and derived units", "Identify base quantities and express derived units.", {
        content: "The SI system has seven base units: metre, kilogram, second, ampere, kelvin, mole and candela. Derived units are formed by multiplying or dividing base units, for example newton = kg·m/s² and joule = kg·m²/s². Dimensional analysis checks whether an equation is consistent and can convert units between systems.",
        formulas: "1 N = 1 kg·m·s⁻²\\n1 J = 1 kg·m²·s⁻²\\n1 Pa = 1 N·m⁻²",
        difficulty: "EASY",
      }),
      t("dimensional-analysis", "Dimensional analysis", "Check equations and derive relations using dimensions.", { difficulty: "MEDIUM" }),
      t("errors-measurement", "Errors and significant figures", "Absolute, relative and percentage error in measurements.", { difficulty: "MEDIUM" }),
    ]),
    c("kinematics", "Kinematics", "Motion in one and two dimensions with graphs and vectors.", [
      t("distance-displacement", "Distance and displacement", "Distinguish path length from the shortest change in position.", { difficulty: "EASY" }),
      t("velocity-acceleration", "Velocity and acceleration", "Use uniform and non-uniform acceleration equations.", { difficulty: "MEDIUM" }),
      t("motion-graphs", "Motion graphs", "Read position-time and velocity-time graphs.", { difficulty: "MEDIUM" }),
    ]),
    c("laws-of-motion", "Laws of Motion", "Newton's laws, friction and circular motion.", [
      t("newtons-laws", "Newton's three laws", "Apply force, mass and acceleration to entrance problems.", {
        content: "Newton's first law says a body keeps its velocity unless a net external force acts. The second law states that net force equals the rate of change of momentum, F = dp/dt; for constant mass this is F = ma. The third law states that forces occur in equal and opposite pairs acting on different bodies.",
        formulas: "F = ma\\np = mv\\nF = dp/dt",
        difficulty: "EASY",
      }),
      t("friction", "Friction", "Static and kinetic friction with inclined planes.", { difficulty: "MEDIUM" }),
      t("circular-motion", "Circular motion", "Centripetal acceleration and banking of roads.", { difficulty: "HARD" }),
    ]),
    c("work-energy-power", "Work, Energy and Power", "Work-energy theorem, conservation and power.", [
      t("work-energy-theorem", "Work-energy theorem", "Relate net work to change in kinetic energy.", { difficulty: "MEDIUM" }),
      t("conservation-of-energy", "Conservation of mechanical energy", "Analyse conservative and non-conservative systems.", { difficulty: "MEDIUM" }),
      t("power", "Power", "Compute average and instantaneous power.", { difficulty: "EASY" }),
    ]),
  ]),
  u("properties-of-matter", "Properties of Matter and Thermal Physics", "Solids, fluids, heat and thermodynamics.", [
    c("solids-and-fluids", "Solids and Fluids", "Elasticity, pressure, buoyancy and surface tension.", [
      t("elasticity", "Elasticity and stress-strain", "Interpret Young's modulus and the elastic limit.", { difficulty: "MEDIUM" }),
      t("fluid-pressure", "Fluid pressure and buoyancy", "Apply Pascal's law and Archimedes' principle.", { difficulty: "MEDIUM" }),
      t("surface-tension", "Surface tension and capillarity", "Explain drops, bubbles and capillary rise.", { difficulty: "HARD" }),
    ]),
    c("thermodynamics", "Thermodynamics", "Heat, work, laws of thermodynamics and kinetic theory.", [
      t("thermal-expansion", "Thermal expansion and calorimetry", "Solve expansion, specific heat and latent heat problems.", { difficulty: "MEDIUM" }),
      t("first-law", "First law of thermodynamics", "Apply ΔU = Q − W to thermodynamic processes.", { difficulty: "MEDIUM" }),
      t("kinetic-theory", "Kinetic theory of gases", "Relate molecular motion to pressure and temperature.", { difficulty: "HARD" }),
    ]),
  ]),
  u("electromagnetism", "Electromagnetism", "Charge, current, magnetism and electromagnetic induction.", [
    c("electrostatics", "Electrostatics", "Coulomb's law, electric field and potential.", [
      t("coulomb-law", "Coulomb's law and electric field", "Compute forces and fields for point charges.", { difficulty: "MEDIUM" }),
      t("electric-potential", "Electric potential and capacitance", "Relate potential difference, work and capacitors.", { difficulty: "HARD" }),
      t("gauss-law", "Gauss's law", "Use symmetry to find electric fields.", { difficulty: "HARD" }),
    ]),
    c("current-electricity", "Current Electricity", "Ohm's law, circuits and electrical power.", [
      t("ohms-law", "Ohm's law and resistivity", "Relate current, voltage, resistance and material properties.", {
        content: "Ohm's law states V = IR for a conductor at constant temperature. Resistance depends on material resistivity, length and cross-sectional area: R = ρL/A. In series, resistances add; in parallel, the reciprocals add. Electrical power is P = VI = I²R = V²/R.",
        formulas: "V = IR\\nR = ρL/A\\nP = VI = I²R",
        difficulty: "EASY",
      }),
      t("kirchhoff", "Kirchhoff's laws", "Solve multi-loop circuits with junction and loop rules.", { difficulty: "HARD" }),
      t("wheatstone", "Wheatstone bridge and potentiometer", "Analyse balanced bridge and potential-gradient circuits.", { difficulty: "HARD" }),
    ]),
    c("magnetism", "Magnetism and Induction", "Magnetic fields, forces and electromagnetic induction.", [
      t("magnetic-force", "Magnetic force on charges and wires", "Use F = qv × B and F = IL × B.", { difficulty: "MEDIUM" }),
      t("faraday-law", "Faraday's law and Lenz's law", "Predict induced emf and current direction.", { difficulty: "MEDIUM" }),
      t("alternating-current", "Alternating current", "Analyse AC circuits with resistance, inductance and capacitance.", { difficulty: "HARD" }),
    ]),
  ]),
  u("optics-and-waves", "Optics and Waves", "Ray optics, wave optics and oscillations.", [
    c("ray-optics", "Ray Optics", "Reflection, refraction and optical instruments.", [
      t("mirrors", "Spherical mirrors", "Use the mirror formula and magnification.", { difficulty: "MEDIUM" }),
      t("refraction", "Refraction and total internal reflection", "Apply Snell's law and critical angle.", { difficulty: "MEDIUM" }),
      t("lenses", "Lenses and optical instruments", "Analyse lens combinations, microscopes and telescopes.", { difficulty: "HARD" }),
    ]),
    c("wave-optics", "Wave Optics and Oscillations", "Interference, diffraction and simple harmonic motion.", [
      t("interference", "Interference and Young's double slit", "Compute fringe width and path differences.", { difficulty: "HARD" }),
      t("shm", "Simple harmonic motion", "Relate displacement, velocity and acceleration in SHM.", { difficulty: "MEDIUM" }),
    ]),
  ]),
  u("modern-physics", "Modern Physics", "Quantum ideas, atoms and nuclei.", [
    c("dual-nature", "Dual Nature of Matter", "Photoelectric effect and de Broglie waves.", [
      t("photoelectric-effect", "Photoelectric effect", "Apply Einstein's photoelectric equation.", { difficulty: "MEDIUM" }),
      t("de-broglie", "de Broglie wavelength", "Relate momentum and wavelength for particles.", { difficulty: "MEDIUM" }),
    ]),
    c("atoms-and-nuclei", "Atoms and Nuclei", "Bohr model, nuclear decay and binding energy.", [
      t("bohr-model", "Bohr model of the atom", "Compute energy levels and spectral lines for hydrogen.", { difficulty: "MEDIUM" }),
      t("nuclear-decay", "Radioactivity and nuclear decay", "Apply half-life and decay laws.", { difficulty: "HARD" }),
    ]),
  ]),
];

export const chemistry: UnitSeed[] = [
  u("physical-chemistry", "Physical Chemistry", "Mole concept, atomic structure, bonding and equilibrium.", [
    c("mole-concept", "Some Basic Concepts of Chemistry", "Mole, stoichiometry and concentration terms.", [
      t("mole-calculation", "Mole calculations", "Convert mass, particles and volume into moles.", {
        content: "One mole contains 6.022 × 10²³ particles. The number of moles is n = given mass / molar mass. At STP, one mole of an ideal gas occupies 22.4 L. Molarity is moles of solute per litre of solution; molality is moles of solute per kilogram of solvent.",
        formulas: "n = m/M\\nN = n × 6.022 × 10²³\\nMolarity = n/V(L)",
        difficulty: "EASY",
      }),
      t("stoichiometry", "Stoichiometry and limiting reagent", "Use balanced equations to find limiting reagents and yields.", { difficulty: "MEDIUM" }),
      t("concentration-terms", "Concentration terms", "Convert between molarity, molality and mass percentage.", { difficulty: "MEDIUM" }),
    ]),
    c("atomic-structure", "Structure of Atom", "Quantum numbers, orbitals and electronic configuration.", [
      t("quantum-numbers", "Quantum numbers and orbitals", "Assign n, l, m and spin to electrons.", { difficulty: "MEDIUM" }),
      t("electronic-configuration", "Electronic configuration", "Apply Aufbau, Pauli and Hund's rules.", { difficulty: "MEDIUM" }),
      t("periodic-properties", "Periodic properties", "Explain atomic radius, ionisation energy and electronegativity trends.", { difficulty: "MEDIUM" }),
    ]),
    c("chemical-bonding", "Chemical Bonding", "Ionic, covalent, hybridisation and VSEPR.", [
      t("ionic-covalent", "Ionic and covalent bonds", "Predict bond type from electronegativity and electron transfer.", { difficulty: "EASY" }),
      t("vsepr", "VSEPR and molecular shapes", "Predict geometry from electron-pair repulsion.", { difficulty: "MEDIUM" }),
      t("hybridisation", "Hybridisation and resonance", "Explain bonding with sp, sp² and sp³ models.", { difficulty: "HARD" }),
    ]),
    c("equilibrium", "Equilibrium and Solutions", "Chemical and ionic equilibrium, acids and bases.", [
      t("chemical-equilibrium", "Chemical equilibrium", "Use Kc and Le Chatelier's principle.", { difficulty: "MEDIUM" }),
      t("acids-bases", "Acids, bases and pH", "Compute pH, pOH and buffer behaviour.", { difficulty: "MEDIUM" }),
      t("solubility-product", "Solubility product", "Predict precipitation from Ksp.", { difficulty: "HARD" }),
    ]),
  ]),
  u("inorganic-chemistry", "Inorganic Chemistry", "Periodic classification, coordination compounds and p-block elements.", [
    c("periodic-table", "Classification of Elements", "Periodic law and trends across groups and periods.", [
      t("periodic-trends", "Periodic trends", "Compare size, ionisation enthalpy and metallic character.", { difficulty: "MEDIUM" }),
      t("s-block", "s-block elements", "Properties and reactions of alkali and alkaline earth metals.", { difficulty: "MEDIUM" }),
      t("hydrogen", "Hydrogen and hydrides", "Compare isotopes and types of hydrides.", { difficulty: "EASY" }),
    ]),
    c("coordination-compounds", "Coordination Compounds", "Ligands, nomenclature and crystal-field ideas.", [
      t("nomenclature", "Nomenclature of complexes", "Name and write formulae for coordination compounds.", { difficulty: "MEDIUM" }),
      t("crystal-field", "Crystal-field theory", "Explain colour and magnetism with d-orbital splitting.", { difficulty: "HARD" }),
      t("isomerism", "Isomerism in complexes", "Identify geometrical and optical isomers.", { difficulty: "HARD" }),
    ]),
    c("p-block", "p-block Elements", "Group trends and important compounds.", [
      t("group-15-16", "Groups 15 and 16", "Compare nitrogen, phosphorus, oxygen and sulphur compounds.", { difficulty: "MEDIUM" }),
      t("group-17-18", "Groups 17 and 18", "Explain halogen reactivity and noble-gas chemistry.", { difficulty: "MEDIUM" }),
    ]),
  ]),
  u("organic-chemistry", "Organic Chemistry", "Hydrocarbons, functional groups and biomolecules.", [
    c("hydrocarbons", "Hydrocarbons", "Alkanes, alkenes, alkynes and aromatic compounds.", [
      t("alkanes", "Alkanes and free-radical reactions", "Apply substitution and conformational ideas.", { difficulty: "MEDIUM" }),
      t("alkenes-alkynes", "Alkenes and alkynes", "Apply electrophilic addition and Markovnikov's rule.", { difficulty: "MEDIUM" }),
      t("aromatic", "Aromatic compounds", "Explain aromaticity and electrophilic substitution.", { difficulty: "HARD" }),
    ]),
    c("functional-groups", "Functional Groups", "Alcohols, aldehydes, ketones and acids.", [
      t("alcohols", "Alcohols and ethers", "Compare preparation and reactions.", { difficulty: "MEDIUM" }),
      t("carbonyls", "Aldehydes and ketones", "Apply nucleophilic addition and oxidation tests.", { difficulty: "HARD" }),
    ]),
    c("biomolecules", "Biomolecules and Polymers", "Carbohydrates, proteins and synthetic polymers.", [
      t("carbohydrates", "Carbohydrates", "Classify sugars and describe glycosidic linkages.", { difficulty: "EASY" }),
      t("proteins", "Amino acids and proteins", "Explain peptide bonds and protein structure levels.", { difficulty: "MEDIUM" }),
    ]),
  ]),
];

export const biology: UnitSeed[] = [
  u("diversity", "Diversity in the Living World", "Classification and the major kingdoms of life.", [
    c("living-world", "The Living World", "Taxonomy, nomenclature and taxonomic hierarchy.", [
      t("taxonomy-hierarchy", "Taxonomic hierarchy", "Order the ranks from kingdom to species.", {
        content: "Taxonomic ranks run kingdom, phylum (division in plants), class, order, family, genus and species. Binomial nomenclature gives every species a two-part Latin name: genus followed by species, for example Homo sapiens. The hierarchy groups organisms by shared characteristics, with species being the smallest commonly used rank.",
        difficulty: "EASY",
      }),
      t("nomenclature", "Binomial nomenclature", "Apply the rules for writing scientific names.", { difficulty: "EASY" }),
      t("taxonomic-aids", "Taxonomic aids", "Use herbaria, museums and keys.", { difficulty: "EASY" }),
    ]),
    c("biological-classification", "Biological Classification", "Five-kingdom system and major groups.", [
      t("five-kingdoms", "Five kingdoms", "Compare Monera, Protista, Fungi, Plantae and Animalia.", { difficulty: "EASY" }),
      t("viruses-lichens", "Viruses, viroids and lichens", "Distinguish acellular and symbiotic forms.", { difficulty: "MEDIUM" }),
    ]),
    c("plant-kingdom", "Plant Kingdom", "Algae, bryophytes, pteridophytes and seed plants.", [
      t("algae", "Algae", "Classify algae by pigment and storage product.", { difficulty: "MEDIUM" }),
      t("seed-plants", "Gymnosperms and angiosperms", "Compare naked-seed and flowering plants.", { difficulty: "MEDIUM" }),
    ]),
    c("animal-kingdom", "Animal Kingdom", "Body plans and classification of animals.", [
      t("symmetry", "Symmetry and body plans", "Use symmetry, coelom and segmentation to classify animals.", { difficulty: "MEDIUM" }),
      t("vertebrates", "Vertebrate classes", "Compare fishes, amphibians, reptiles, birds and mammals.", { difficulty: "EASY" }),
    ]),
  ]),
  u("cell-structure", "Cell Structure and Function", "Cell organisation, biomolecules and cell division.", [
    c("cell-unit-of-life", "Cell: The Unit of Life", "Prokaryotic and eukaryotic cell structure.", [
      t("cell-organelles", "Cell organelles", "Describe the functions of major organelles.", { difficulty: "MEDIUM" }),
      t("prokaryotic-eukaryotic", "Prokaryotic and eukaryotic cells", "Compare membrane organisation and genetic material.", { difficulty: "EASY" }),
      t("cell-membrane", "Cell membrane and transport", "Explain the fluid-mosaic model and transport types.", { difficulty: "MEDIUM" }),
    ]),
    c("biomolecules", "Biomolecules", "Enzymes, proteins, carbohydrates and nucleic acids.", [
      t("enzymes", "Enzymes", "Explain enzyme kinetics and inhibition.", { difficulty: "MEDIUM" }),
      t("nucleic-acids", "Nucleic acids", "Compare DNA and RNA structure.", { difficulty: "MEDIUM" }),
    ]),
    c("cell-cycle", "Cell Cycle and Cell Division", "Mitosis, meiosis and their significance.", [
      t("mitosis", "Mitosis", "Describe the phases and outcome of mitosis.", { difficulty: "MEDIUM" }),
      t("meiosis", "Meiosis", "Explain crossing over and genetic variation.", { difficulty: "MEDIUM" }),
    ]),
  ]),
  u("plant-physiology", "Plant Physiology", "Photosynthesis, respiration and transport in plants.", [
    c("photosynthesis", "Photosynthesis", "Light reactions, Calvin cycle and limiting factors.", [
      t("light-reactions", "Light reactions", "Describe photolysis and ATP/NADPH production.", { difficulty: "MEDIUM" }),
      t("calvin-cycle", "Calvin cycle", "Trace carbon fixation and sugar synthesis.", { difficulty: "HARD" }),
      t("c4-cam", "C4 and CAM pathways", "Compare adaptations to hot and dry environments.", { difficulty: "HARD" }),
    ]),
    c("respiration", "Respiration in Plants", "Glycolysis, Krebs cycle and electron transport.", [
      t("glycolysis", "Glycolysis", "Summarise glucose breakdown to pyruvate and ATP.", { difficulty: "MEDIUM" }),
      t("krebs-et", "Krebs cycle and oxidative phosphorylation", "Compute ATP yield from aerobic respiration.", { difficulty: "HARD" }),
    ]),
    c("transport", "Transport in Plants", "Water potential, transpiration and translocation.", [
      t("water-potential", "Water potential and osmosis", "Predict water movement between cells.", { difficulty: "MEDIUM" }),
      t("transpiration", "Transpiration", "Explain stomatal regulation and the transpiration pull.", { difficulty: "MEDIUM" }),
    ]),
  ]),
  u("human-physiology", "Human Physiology", "Digestion, breathing, circulation, excretion and control.", [
    c("digestion", "Digestion and Absorption", "Enzymes and absorption across the gut.", [
      t("digestive-enzymes", "Digestive enzymes", "Match enzymes with their substrates and products.", { difficulty: "MEDIUM" }),
      t("absorption", "Absorption of nutrients", "Describe absorption in the small intestine.", { difficulty: "MEDIUM" }),
      t("disorders", "Digestive disorders", "Identify jaundice, vomiting and diarrhoea causes.", { difficulty: "EASY" }),
    ]),
    c("breathing", "Breathing and Exchange of Gases", "Respiratory volumes and gas transport.", [
      t("lung-volumes", "Lung volumes and capacities", "Interpret spirometry terms.", { difficulty: "MEDIUM" }),
      t("gas-transport", "Transport of oxygen and carbon dioxide", "Explain the oxygen dissociation curve.", { difficulty: "HARD" }),
    ]),
    c("circulation", "Body Fluids and Circulation", "Blood, heart and the cardiac cycle.", [
      t("cardiac-cycle", "Cardiac cycle", "Relate heart sounds, valves and ECG waves.", { difficulty: "MEDIUM" }),
      t("blood-groups", "Blood groups and transfusion", "Explain ABO and Rh compatibility.", { difficulty: "EASY" }),
    ]),
    c("neural-control", "Neural Control and Coordination", "Neurons, synapses and the brain.", [
      t("action-potential", "Action potential", "Describe depolarisation and repolarisation.", { difficulty: "HARD" }),
      t("synapse", "Synaptic transmission", "Compare electrical and chemical synapses.", { difficulty: "MEDIUM" }),
    ]),
  ]),
  u("genetics-evolution", "Genetics and Evolution", "Inheritance, molecular genetics and evolutionary mechanisms.", [
    c("heredity", "Principles of Inheritance", "Mendel's laws, linkage and genetic disorders.", [
      t("mendel-laws", "Mendel's laws", "Solve monohybrid and dihybrid crosses.", {
        content: "Mendel's law of segregation states that the two alleles of a gene separate during gamete formation. The law of independent assortment states that alleles of different genes assort independently when the genes are on different chromosomes. A monohybrid cross of heterozygotes gives a 3:1 phenotype ratio; a dihybrid cross gives 9:3:3:1.",
        formulas: "Monohybrid F2: 3:1\\nDihybrid F2: 9:3:3:1\\nTest cross ratio: 1:1",
        difficulty: "MEDIUM",
      }),
      t("linkage", "Linkage and recombination", "Explain why some genes do not assort independently.", { difficulty: "HARD" }),
      t("disorders", "Genetic disorders", "Identify autosomal and sex-linked disorders.", { difficulty: "MEDIUM" }),
    ]),
    c("molecular-basis", "Molecular Basis of Inheritance", "DNA replication, transcription and translation.", [
      t("replication", "DNA replication", "Describe semi-conservative replication.", { difficulty: "HARD" }),
      t("translation", "Transcription and translation", "Trace information flow from gene to protein.", { difficulty: "HARD" }),
    ]),
    c("evolution", "Evolution", "Evidence, natural selection and speciation.", [
      t("natural-selection", "Natural selection", "Explain adaptation and fitness.", { difficulty: "MEDIUM" }),
      t("human-evolution", "Human evolution", "Order major hominid developments.", { difficulty: "MEDIUM" }),
    ]),
  ]),
];
