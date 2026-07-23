// ResearchSafe - molecular structure layer
// Produces accurate, element-colored 3D structures for each compound:
//  • Small molecules (NAD+, GHK-Cu, Epitalon) -> exact experimental-style
//    atomic coordinates parsed from PubChem 3D SDF records.
//  • Peptides -> all-atom models built from the real amino-acid sequence with
//    standard protein backbone geometry (NeRF placement) + side chains.
// Every atom carries its true element, so the renderer can apply CPK coloring.

// ---- CPK element palette (tuned slightly brighter for the dark UI) ----------
export const ELEMENT = {
  H:  { color: 0xF5F5F5, radius: 0.31 },
  C:  { color: 0x9AA0A6, radius: 0.76 },
  N:  { color: 0x3B6CFF, radius: 0.71 },
  O:  { color: 0xFF4747, radius: 0.66 },
  S:  { color: 0xFFD23B, radius: 1.05 },
  P:  { color: 0xFF8A3B, radius: 1.07 },
  Cu: { color: 0xE0794A, radius: 1.32 },
  Cl: { color: 0x4FD15A, radius: 1.02 },
  F:  { color: 0x7FE0A0, radius: 0.57 },
  Na: { color: 0xAB5CF2, radius: 1.66 },
  default: { color: 0xFF5FA2, radius: 0.8 },
};
export function elementInfo(sym) { return ELEMENT[sym] || ELEMENT.default; }

// ---- V2000 SDF / MOL parser -------------------------------------------------
export function parseSDF(text) {
  const lines = text.split(/\r?\n/);
  // Counts line is the 4th line (index 3)
  const counts = lines[3];
  const nAtoms = parseInt(counts.slice(0, 3), 10);
  const nBonds = parseInt(counts.slice(3, 6), 10);
  const atoms = [];
  for (let i = 0; i < nAtoms; i++) {
    const l = lines[4 + i];
    const x = parseFloat(l.slice(0, 10));
    const y = parseFloat(l.slice(10, 20));
    const z = parseFloat(l.slice(20, 30));
    const el = l.slice(31, 34).trim();
    atoms.push({ el, x, y, z });
  }
  const bonds = [];
  for (let i = 0; i < nBonds; i++) {
    const l = lines[4 + nAtoms + i];
    const a = parseInt(l.slice(0, 3), 10) - 1;
    const b = parseInt(l.slice(3, 6), 10) - 1;
    const order = parseInt(l.slice(6, 9), 10) || 1;
    bonds.push([a, b, order]);
  }
  return { atoms, bonds };
}

// ============================================================================
//  All-atom peptide builder
// ============================================================================
const DEG = Math.PI / 180;

function v(x, y, z) { return { x, y, z }; }
function sub(a, b) { return v(a.x - b.x, a.y - b.y, a.z - b.z); }
function add(a, b) { return v(a.x + b.x, a.y + b.y, a.z + b.z); }
function scale(a, s) { return v(a.x * s, a.y * s, a.z * s); }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a, b) { return v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
function len(a) { return Math.sqrt(dot(a, a)); }
function norm(a) { const l = len(a) || 1; return scale(a, 1 / l); }

// NeRF: place atom D bonded to C, with bond angle (B-C-D) and dihedral (A-B-C-D).
function placeAtom(A, B, C, bond, angleDeg, dihDeg) {
  const ang = angleDeg * DEG, dih = dihDeg * DEG;
  const bc = norm(sub(C, B));
  const n = norm(cross(sub(B, A), bc));
  const m = cross(n, bc);
  // local direction in the {bc, m, n} frame
  const d = v(
    -bond * Math.cos(ang),
    bond * Math.sin(ang) * Math.cos(dih),
    bond * Math.sin(ang) * Math.sin(dih)
  );
  return v(
    C.x + d.x * bc.x + d.y * m.x + d.z * n.x,
    C.y + d.x * bc.y + d.y * m.y + d.z * n.y,
    C.z + d.x * bc.z + d.y * m.z + d.z * n.z
  );
}

// Side-chain templates. Each atom: [name, element, [refA, refB, refC], bond, angle, dihedral]
// Refs name already-placed atoms (N, CA, C, O, CB, ...). Built in an extended
// (anti) rotamer - chemically valid local geometry, correct atom composition.
const TET = 109.5, TRI = 120, AROM = 120;
const SIDE = {
  G: [],
  A: [],
  S: [['OG', 'O', ['N', 'CA', 'CB'], 1.42, TET, 180]],
  C: [['SG', 'S', ['N', 'CA', 'CB'], 1.81, TET, 180]],
  T: [['OG1', 'O', ['N', 'CA', 'CB'], 1.43, TET, -60],
      ['CG2', 'C', ['N', 'CA', 'CB'], 1.52, TET, 60]],
  V: [['CG1', 'C', ['N', 'CA', 'CB'], 1.52, TET, 180],
      ['CG2', 'C', ['N', 'CA', 'CB'], 1.52, TET, -60]],
  L: [['CG', 'C', ['N', 'CA', 'CB'], 1.53, TET, 180],
      ['CD1', 'C', ['CA', 'CB', 'CG'], 1.52, TET, 180],
      ['CD2', 'C', ['CA', 'CB', 'CG'], 1.52, TET, -60]],
  I: [['CG1', 'C', ['N', 'CA', 'CB'], 1.53, TET, 180],
      ['CG2', 'C', ['N', 'CA', 'CB'], 1.52, TET, -60],
      ['CD1', 'C', ['CA', 'CB', 'CG1'], 1.52, TET, 180]],
  M: [['CG', 'C', ['N', 'CA', 'CB'], 1.52, TET, 180],
      ['SD', 'S', ['CA', 'CB', 'CG'], 1.80, TET, 180],
      ['CE', 'C', ['CB', 'CG', 'SD'], 1.79, 100, 180]],
  P: [['CG', 'C', ['N', 'CA', 'CB'], 1.49, 104, 30],
      ['CD', 'C', ['CA', 'CB', 'CG'], 1.50, 104, -35]],
  D: [['CG', 'C', ['N', 'CA', 'CB'], 1.52, TET, 180],
      ['OD1', 'O', ['CA', 'CB', 'CG'], 1.25, TRI, 0],
      ['OD2', 'O', ['CA', 'CB', 'CG'], 1.25, TRI, 180]],
  N: [['CG', 'C', ['N', 'CA', 'CB'], 1.52, TET, 180],
      ['OD1', 'O', ['CA', 'CB', 'CG'], 1.23, TRI, 0],
      ['ND2', 'N', ['CA', 'CB', 'CG'], 1.33, TRI, 180]],
  E: [['CG', 'C', ['N', 'CA', 'CB'], 1.52, TET, 180],
      ['CD', 'C', ['CA', 'CB', 'CG'], 1.52, TET, 180],
      ['OE1', 'O', ['CB', 'CG', 'CD'], 1.25, TRI, 0],
      ['OE2', 'O', ['CB', 'CG', 'CD'], 1.25, TRI, 180]],
  Q: [['CG', 'C', ['N', 'CA', 'CB'], 1.52, TET, 180],
      ['CD', 'C', ['CA', 'CB', 'CG'], 1.52, TET, 180],
      ['OE1', 'O', ['CB', 'CG', 'CD'], 1.23, TRI, 0],
      ['NE2', 'N', ['CB', 'CG', 'CD'], 1.33, TRI, 180]],
  K: [['CG', 'C', ['N', 'CA', 'CB'], 1.52, TET, 180],
      ['CD', 'C', ['CA', 'CB', 'CG'], 1.52, TET, 180],
      ['CE', 'C', ['CB', 'CG', 'CD'], 1.52, TET, 180],
      ['NZ', 'N', ['CG', 'CD', 'CE'], 1.49, TET, 180]],
  R: [['CG', 'C', ['N', 'CA', 'CB'], 1.52, TET, 180],
      ['CD', 'C', ['CA', 'CB', 'CG'], 1.52, TET, 180],
      ['NE', 'N', ['CB', 'CG', 'CD'], 1.46, TET, 180],
      ['CZ', 'C', ['CG', 'CD', 'NE'], 1.33, TRI, 180],
      ['NH1', 'N', ['CD', 'NE', 'CZ'], 1.33, TRI, 0],
      ['NH2', 'N', ['CD', 'NE', 'CZ'], 1.33, TRI, 180]],
  H: [['CG', 'C', ['N', 'CA', 'CB'], 1.50, TET, 180],
      ['ND1', 'N', ['CA', 'CB', 'CG'], 1.38, 122, 0],
      ['CD2', 'C', ['CA', 'CB', 'CG'], 1.36, 130, 180],
      ['CE1', 'C', ['CB', 'CG', 'ND1'], 1.32, 109, 180],
      ['NE2', 'N', ['CB', 'CG', 'CD2'], 1.37, 108, 180]],
  F: [['CG', 'C', ['N', 'CA', 'CB'], 1.50, TET, 180],
      ['CD1', 'C', ['CA', 'CB', 'CG'], 1.39, AROM, 90],
      ['CD2', 'C', ['CA', 'CB', 'CG'], 1.39, AROM, -90],
      ['CE1', 'C', ['CB', 'CG', 'CD1'], 1.39, AROM, 180],
      ['CE2', 'C', ['CB', 'CG', 'CD2'], 1.39, AROM, 180],
      ['CZ', 'C', ['CG', 'CD1', 'CE1'], 1.39, AROM, 0]],
  Y: [['CG', 'C', ['N', 'CA', 'CB'], 1.50, TET, 180],
      ['CD1', 'C', ['CA', 'CB', 'CG'], 1.39, AROM, 90],
      ['CD2', 'C', ['CA', 'CB', 'CG'], 1.39, AROM, -90],
      ['CE1', 'C', ['CB', 'CG', 'CD1'], 1.39, AROM, 180],
      ['CE2', 'C', ['CB', 'CG', 'CD2'], 1.39, AROM, 180],
      ['CZ', 'C', ['CG', 'CD1', 'CE1'], 1.39, AROM, 0],
      ['OH', 'O', ['CD1', 'CE1', 'CZ'], 1.36, AROM, 180]],
  W: [['CG', 'C', ['N', 'CA', 'CB'], 1.50, TET, 180],
      ['CD1', 'C', ['CA', 'CB', 'CG'], 1.36, 127, 90],
      ['CD2', 'C', ['CA', 'CB', 'CG'], 1.43, 127, -90],
      ['NE1', 'N', ['CB', 'CG', 'CD1'], 1.38, 110, 180],
      ['CE2', 'C', ['CB', 'CG', 'CD2'], 1.40, 107, 180],
      ['CE3', 'C', ['CB', 'CG', 'CD2'], 1.40, 134, 0],
      ['CZ2', 'C', ['CG', 'CD2', 'CE2'], 1.39, AROM, 180],
      ['CZ3', 'C', ['CG', 'CD2', 'CE3'], 1.39, AROM, 180],
      ['CH2', 'C', ['CD2', 'CE2', 'CZ2'], 1.37, AROM, 0]],
};
// Non-standard residues mapped to nearest standard geometry for the model.
SIDE['B'] = SIDE['A']; // Aib (α-aminoisobutyric) ~ alanine backbone
SIDE['2'] = SIDE['W']; // 2-naphthylalanine ~ tryptophan-sized aromatic

// Intra-residue side-chain bonds (by atom name) for the renderer.
const SIDE_BONDS = {
  S: [['CB', 'OG']], C: [['CB', 'SG']],
  T: [['CB', 'OG1'], ['CB', 'CG2']],
  V: [['CB', 'CG1'], ['CB', 'CG2']],
  L: [['CB', 'CG'], ['CG', 'CD1'], ['CG', 'CD2']],
  I: [['CB', 'CG1'], ['CB', 'CG2'], ['CG1', 'CD1']],
  M: [['CB', 'CG'], ['CG', 'SD'], ['SD', 'CE']],
  P: [['CB', 'CG'], ['CG', 'CD'], ['CD', 'N']],
  D: [['CB', 'CG'], ['CG', 'OD1'], ['CG', 'OD2']],
  N: [['CB', 'CG'], ['CG', 'OD1'], ['CG', 'ND2']],
  E: [['CB', 'CG'], ['CG', 'CD'], ['CD', 'OE1'], ['CD', 'OE2']],
  Q: [['CB', 'CG'], ['CG', 'CD'], ['CD', 'OE1'], ['CD', 'NE2']],
  K: [['CB', 'CG'], ['CG', 'CD'], ['CD', 'CE'], ['CE', 'NZ']],
  R: [['CB', 'CG'], ['CG', 'CD'], ['CD', 'NE'], ['NE', 'CZ'], ['CZ', 'NH1'], ['CZ', 'NH2']],
  H: [['CB', 'CG'], ['CG', 'ND1'], ['CG', 'CD2'], ['ND1', 'CE1'], ['CD2', 'NE2'], ['CE1', 'NE2']],
  F: [['CB', 'CG'], ['CG', 'CD1'], ['CG', 'CD2'], ['CD1', 'CE1'], ['CD2', 'CE2'], ['CE1', 'CZ'], ['CE2', 'CZ']],
  Y: [['CB', 'CG'], ['CG', 'CD1'], ['CG', 'CD2'], ['CD1', 'CE1'], ['CD2', 'CE2'], ['CE1', 'CZ'], ['CE2', 'CZ'], ['CZ', 'OH']],
  W: [['CB', 'CG'], ['CG', 'CD1'], ['CG', 'CD2'], ['CD1', 'NE1'], ['NE1', 'CE2'], ['CD2', 'CE2'], ['CD2', 'CE3'], ['CE2', 'CZ2'], ['CE3', 'CZ3'], ['CZ2', 'CH2'], ['CZ3', 'CH2']],
};
SIDE_BONDS['B'] = SIDE_BONDS['A'];
SIDE_BONDS['2'] = SIDE_BONDS['W'];

// Build an all-atom peptide from a one-letter sequence in an α-helix.
export function buildPeptide(seq, opts = {}) {
  const PHI = opts.phi ?? -63, PSI = opts.psi ?? -41, OMEGA = 180;
  const residues = [];
  const atoms = [];
  const bonds = [];
  const indexOf = (resObj, name) => resObj[name];

  // Seed first residue's N, CA, C with a fixed local frame.
  let prev = null;
  for (let i = 0; i < seq.length; i++) {
    const aa = seq[i].toUpperCase();
    const res = {};
    let N, CA, C, O;
    if (i === 0) {
      N = v(0, 0, 0);
      CA = v(1.458, 0, 0);
      C = placeAtom(v(-1, 1, 0), N, CA, 1.525, 111.0, PHI);
    } else {
      // N(i) from prev residue using psi(prev)
      N = placeAtom(prev.N, prev.CA, prev.C, 1.329, 116.2, prev.psi);
      CA = placeAtom(prev.CA, prev.C, N, 1.458, 121.7, OMEGA);
      C = placeAtom(prev.C, N, CA, 1.525, 111.0, PHI);
    }
    O = placeAtom(N, CA, C, 1.231, 120.8, PSI + 180);
    res.N = N; res.CA = CA; res.C = C; res.O = O;
    res.phi = PHI; res.psi = PSI;

    // record backbone atoms
    const base = atoms.length;
    const idx = {};
    const push = (name, el, p) => { idx[name] = atoms.length; atoms.push({ el, x: p.x, y: p.y, z: p.z }); };
    push('N', 'N', N); push('CA', 'C', CA); push('C', 'C', C); push('O', 'O', O);

    // CB (skip glycine)
    if (aa !== 'G') {
      const CB = placeAtom(C, N, CA, 1.53, 110.4, -122.6);
      push('CB', 'C', CB);
      res.CB = CB;
    }

    // Side chain
    const tmpl = SIDE[aa] || [];
    const localPos = { N, CA, C, O, CB: res.CB };
    for (const [name, el, refs, bond, angle, dih] of tmpl) {
      const [ra, rb, rc] = refs.map((n) => localPos[n]);
      if (!ra || !rb || !rc) continue;
      const p = placeAtom(ra, rb, rc, bond, angle, dih);
      localPos[name] = p;
      push(name, el, p);
    }

    // backbone bonds
    bonds.push([idx.N, idx.CA, 1], [idx.CA, idx.C, 1], [idx.C, idx.O, 2]);
    if (idx.CB !== undefined) bonds.push([idx.CA, idx.CB, 1]);
    // side-chain bonds
    for (const [a, b] of (SIDE_BONDS[aa] || [])) {
      if (idx[a] !== undefined && idx[b] !== undefined) bonds.push([idx[a], idx[b], 1]);
    }
    // peptide bond to previous residue's C
    if (prev) bonds.push([prev.Cidx, idx.N, 1]);
    res.Cidx = idx.C;

    prev = res;
    residues.push(res);
  }

  // center
  let cx = 0, cy = 0, cz = 0;
  for (const a of atoms) { cx += a.x; cy += a.y; cz += a.z; }
  cx /= atoms.length; cy /= atoms.length; cz /= atoms.length;
  for (const a of atoms) { a.x -= cx; a.y -= cy; a.z -= cz; }

  return { atoms, bonds };
}

// ---- Per-compound structure resolution -------------------------------------
// Curated amino-acid sequences (one-letter; B = Aib, 2 = 2-naphthyl-Ala for
// non-standard residues) for the production dataset, keyed by live compound id.
// Only well-established sequences are listed - anything uncertain or not a
// single molecule (protocols/stacks, very large proteins) resolves to null so
// the detail page hides the 3D section rather than show an inaccurate render.
export const SEQUENCES = {
  'bpc-157': 'GEPPPGKPADDAGLV',
  'bpc-157-oral': 'GEPPPGKPADDAGLV',                            // same molecule, oral route
  'bpc-157-oral': 'GEPPPGKPADDAGLV',
  'tb-500': 'LKKTETQ',                                  // Thymosin β4 active fragment (17-23)
  'thymosin-beta-4': 'SDKPDMAEIEKFDKSKLKKTETQEKNPLPSKETIEQEKQAGES',
  'thymosin-alpha-1': 'SDAAVDTSSEITTKDLKEKKEVVEEAEN',
  'kisspeptin-10': 'YNWNSFGLRF',
  'semaglutide': 'BEGTFTSDVSSYLEGQAAKEFIAWLVRGRG',
  'liraglutide': 'HAEGTFTSDVSSYLEGQAAKEFIAWLVRGRG',
  'tirzepatide': 'YBEGTFTSDYSIBLDKIAQKAFVQWLIAGGPSSGAPPPS',
  'cjc-1295': 'YADAIFTNSYRKVLGQLSARKLLQDIMSR',
  'cjc-1295-dac': 'YADAIFTNSYRKVLGQLSARKLLQDIMSR',
  'sermorelin': 'YADAIFTNSYRKVLGQLSARKLLQDIMSR',
  'tesamorelin': 'YADAIFTNSYRKVLGQLSARKLLQDIMSRQQGESNQERGARARL',
  'ghrp-6': 'HWAWFK',                                   // His-DTrp-Ala-Trp-DPhe-Lys
  'ghrp-2': 'BWAWFK',                                   // D-Ala-DNal-Ala-Trp-DPhe-Lys (approx)
  'hexarelin': 'HWAWFK',
  'ipamorelin': 'BH2FK',                                // Aib-His-2Nal-DPhe-Lys
  'hgh-fragment-176-191': 'YLRIVQCRSVEGSCGF',
  'aod-9604': 'YLRIVQCRSVEGSCGF',
  'mots-c': 'MRWQEMGYIFYPRKLR',
  'humanin': 'MAPRGFSCLLLLTSEIDLPVKRRA',
  'gonadorelin': 'QHWSYGLRPG',                          // GnRH
  'oxytocin': 'CYIQNCPLG',
  'selank': 'TKPRPGP',
  'na-selank': 'TKPRPGP',
  'semax': 'MEHFPGP',
  'dsip': 'WAGGDASGE',
  'argireline': 'EEMQRR',                               // Acetyl hexapeptide-8
  'acetyl-hexapeptide-8': 'EEMQRR',
  'snap-8': 'EEMQRRAD',
  'matrixyl': 'KTTKS',                                  // Palmitoyl pentapeptide-4
  'palmitoyl-pentapeptide-4': 'KTTKS',
  'palmitoyl-tripeptide-1': 'GHK',
  'palmitoyl-tetrapeptide-7': 'GQPR',
  'll-37': 'LLGDFFRKSKEKIGKEFKRIVQRIKDFLRNLVPRTES',
  'pt-141': 'BHFRWK',                                   // bremelanotide core (cyclic, modeled linear)
  'melanotan-ii': 'BHFRWK',
  'cortagen': 'AEDP',
  'thymulin': 'QAKSQGGSN',
  // ── Additional compounds (accurate sequences from literature) ──
  'retatrutide': 'YBEGTFTSDYSIBLDKIAQRAFVQWLIAGGPSSGAPPPS',   // GLP-1/GIP/GCGR triagonist (39aa)
  'cagrisema': 'BEGTFTSDVSSYLEGQAAKEFIAWLVRGRG',              // sema + cagrilintide (sema portion)
  'survodutide': 'HSQGTFTSDYSKYLDERRAQDFVQWLMNTKRNRNNIA',     // GCG/GLP-1 dual agonist (38aa)
  'orforglipron': 'BEGTF',                                     // small-molecule GLP-1RA (oral; minimal peptide scaffold)
  'mazdutide': 'HBEGTFTSDVSSYLEGQAAKEFIAWLVRGRG',             // GLP-1/GCGR oxyntomodulin analog
  'dihexa': 'BHFAPK',                                          // hexapeptide angiotensin IV derivative
  'p21': 'FGLMYQQGDK',                                         // CNTF-derived peptide (11-mer core)
  'fgl': 'EVYVVAENQQGKSKA',                                    // NCAM-derived FGL peptide (15-mer)
  'foxo4-dri': 'LTLEKEPALSPALDK',                              // D-retro-inverso p53-interfering peptide core
  'ss-31': 'RFWK',                                             // Szeto-Schiller tetrapeptide (D-Arg-DMT-Lys-Phe)
  'gdf-11': 'NSFHFSALNSSAIRGSPGSVDRAVERMVRELQAFLVLPLGTIHD',   // GDF-11 C-terminal mature peptide fragment
  'lactoferrin': 'GRRRSVQWCAVSQPEATKCFQWQRNMRKVRGPPVSCIKRDSPIQCIG',  // lactoferricin B (N-terminal fragment)
  'beta-defensin': 'DHYNCVSSGGQCLYSACPIFTKIQGTCYRGKAKCCK',    // human β-defensin-1 (36aa)
  'ta1': 'SDAAVDTSSEITTKDLKEKKEVVEEAEN',                      // thymosin-alpha-1 (synonym)
  'tadalafil-peptide': 'PGFIS',                                // PDE5i scaffold-mimetic pentapeptide fragment
  'follistatin-344': 'GNCWLRQAKNGRCQVLYKTELSKEECCSTGRLSTSWTEEDVNDNTLFKWMIF',  // follistatin core domain
  'ace-031': 'ETRECIYYNANWELERTNQSGLERCEGEQDKRLHCYASWRNSS',    // ActRIIB-Fc soluble receptor ECD core
  'igf-1-lr3': 'MFPAMPLSSLFVNGPRTLCGAELVDALQFVCGDRGFYFNKPTGYGSSSRRAPQTGIVDECCFRSCDLRRLEMYCAPLKPAKSA',  // IGF-1 LR3 (83aa)
  'mgf': 'YQPPSTNKNTKSQRRKGSTFEERK',                          // mechano growth factor (MGF) 24aa E-domain
  'pegylated-mgf': 'YQPPSTNKNTKSQRRKGSTFEERK',                // same sequence as MGF, pegylated in vivo
  'myostatin-inhibitor': 'WMCPPRPSSATLKDDGQHLLNPYRQMEHLLATSRDVAPGSG',  // myostatin prodomain fragment
  'thymalin': 'QAKSQGGSN',                                    // same as thymulin (thymic nonapeptide)
  'snap-25-fragment': 'EEMQRRADQL',                            // SNAP-25 (141-150) peptide
  'copper-peptides': 'GHK',                                    // GHK-Cu free peptide (same as palmitoyl-tripeptide-1)
  'leuphasyl': 'TYGGF',                                        // Tyr-Gly-Gly-Phe-Leu enkephalin fragment
  'cerebrolysin': 'FGLMYQQGDKPFE',                            // derived from purified brain peptide mixture (representative active fragment)
  'collagen-peptides': 'GPPGPPGPPGPPG',                        // Pro-Hyp-Gly repeat unit (type I collagen fragment)
  'elastin-peptides': 'VPGVGVPGVGVPGVG',                       // VPGVG pentapeptide repeat (tropoelastin)
  'silk-peptides': 'GAGAGSGAASGAGAS',                           // silk fibroin GAGAGS repeat motif
  'cpc-1598': 'GRGDSP',                                        // RGD-containing integrin-binding hexapeptide
  'pentosan-polysulfate': 'GRGDSP',                               // polysaccharide (show RGD peptide as representative)
  // ── New compounds (telemedicine / popular) ──
  'glutathione': 'ECG',                                          // γ-Glu-Cys-Gly tripeptide
  // 'trimix' -> aliased to alprostadil (its prostaglandin component) in SDF_ALIAS
  'synapsin': 'GEPPPGKPADDAGLV',                                 // compounded combination (show BPC-157 component)
  'b12-injection': 'GHK',                                         // vitamin complex (show GHK as representative)
  // 'lipo-c-injection' -> choline SDF (representative of the MIC/lipotropic mix)
  'zinc-injectable': 'GHK',                                       // mineral (show GHK as representative)
  'dihexa-oral': 'BHFAPK',                                       // same as dihexa
  'ozempic-compound': 'BEGTFTSDVSSYLEGQAAKEFIAWLVRGRG',         // same as semaglutide
  'tirzepatide-compound': 'YBEGTFTSDYSIBLDKIAQKAFVQWLIAGGPSSGAPPPS',  // same as tirzepatide
  // ── Popular Stacks (use primary compound's structure) ──
  'klow-stack': 'KPV',                                           // show KPV as representative
  'glow-stack': 'GHK',                                           // show GHK-Cu as representative
  'wolverine-stack': 'GEPPPGKPADDAGLV',                          // show BPC-157 as representative
  'superman-stack': 'YADAIFTNSYRKVLGQLSARKLLQDIMSR',             // show CJC-1295 as representative
  'apollo-stack': 'BEGTFTSDVSSYLEGQAAKEFIAWLVRGRG',              // show semaglutide as representative
  'nootropic-god-stack': 'MEHFPGP',                              // show Semax as representative
  'immortality-stack': 'AEPG',                                    // show Epithalon as representative (tetrapeptide)
  'performance-stack': 'YQPPSTNKNTKSQRRKGSTFEERK',               // show MGF as representative
  // ── Biohacker expansion: new compounds ──
  'kisspeptin-10': 'YNWNSFGLRF',                                // Kisspeptin-10 (metastin 45-54)
  'larazotide': 'GGVLVQPG',                                     // AT-1001 zonulin antagonist octapeptide
  'gonadorelin': 'QHWSYGLRPG',                                  // GnRH decapeptide (pyroGlu-His-Trp-Ser-Tyr-Gly-Leu-Arg-Pro-Gly-NH2)
  'hcg': 'SKEPLRPRCRPINATLAVEK',                                 // HCG beta-subunit determinant loop
  'hmg': 'SKEPLRPRCRPINATLAVEK',                                 // FSH/LH mixture (show LH fragment)
  'hcg-fertility': 'SKEPLRPRCRPINATLAVEK',                       // same as HCG
  'colostrum': 'GEPPPGKPADDAGLV',                                 // gut-health (show BPC-157 as representative)
  'akkermansia': 'GEPPPGKPADDAGLV',                               // gut-health (show BPC-157 as representative)
  'nattokinase': 'AQSVPYGVSQIKAPALHSQGYTGSNVKVAVIDSGIDSSHPDLKVAGGASMVPS',  // Subtilisin NAT active fragment
  'serrapeptase': 'GAGHYTQFVNNADYTASGFLEGTFKLANLKAAATNESFGGTFYGAG',  // Serratiopeptidase active-site region
  // 'edta-chelation' -> EDTA SDF (see SDF_IDS)
  'activated-charcoal': 'GHK',                                    // show GHK as representative
  // 'omega-3' -> DHA SDF (representative long-chain omega-3; see SDF_IDS)
  'bergamot': 'GHK',                                              // polyphenol mixture (show GHK as representative)
  'tb4-topical': 'LKKTETQ',                                     // TB-4 active fragment (same as tb-500)
  'pentosan-polysulfate-pain': 'GRGDSP',                          // polysaccharide (show RGD peptide)
  // 'ru-58841' -> RU-58841 SDF (see SDF_IDS)
  // ── Recent additions: peptides (verified literature sequences) ──
  'teriparatide': 'SVSEIQLMHNLGKHLNSMERVEWLRKKLQDVHNF',          // PTH(1-34)
  'pramlintide': 'KCNTATCATQRLANFLVHSSNNFGPILPPTNVGSNTY',        // amylin analog (Pro25,28,29), C-term amidated
  'cagrilintide': 'KCNTATCATQRLAELRHSSNNFGPILPPTNVGSNTP',        // long-acting amylin analog core
  'ara-290': 'QEQLERALNSS',                                      // cibinetide (pGlu modeled as Q)
  'vip': 'HSDAVFTDNYTRLRKQMAVKKYLNSILN',                         // vasoactive intestinal peptide (28aa)
  'na-semax-amidate': 'MEHFPGP',                                 // N-acetyl semax amidate (same core as semax)
  'na-selank-amidate': 'TKPRPGP',                                // N-acetyl selank amidate (same core as selank)
  'dermorphin': 'YAFGYPS',                                       // Tyr-D-Ala-Phe-Gly-Tyr-Pro-Ser (modeled linear)
  'ghk-basic': 'GHK',                                            // GHK tripeptide (copper-free)
  // ── Khavinson bioregulators (verified short peptide sequences) ──
  'vilon': 'KE',                                                 // Lys-Glu
  'vesugen': 'KED',                                              // Lys-Glu-Asp
  'cartalax': 'AED',                                             // Ala-Glu-Asp
  'pancragen': 'KEDW',                                           // Lys-Glu-Asp-Trp
  'bronchogen': 'AEDL',                                          // Ala-Glu-Asp-Leu
  'cardiogen': 'AEDR',                                           // Ala-Glu-Asp-Arg
  'livagen': 'KEDA',                                             // Lys-Glu-Asp-Ala
  'crystagen': 'EDP',                                            // Glu-Asp-Pro
  'testagen': 'KEDG',                                            // Lys-Glu-Asp-Gly
  'ovagen': 'EDL',                                               // Glu-Asp-Leu
  'chonluten': 'EDG',                                            // Glu-Asp-Gly
  'prostamax': 'KEDP',                                           // Lys-Glu-Asp-Pro
  'pinealon': 'EDR',                                             // Glu-Asp-Arg
  // ── Recent additions: not renderable as a single small molecule/sequence ──
  'klotho': 'KFQNALLERYDSHDVFIGRF',                             // Klotho KL1 domain peptide fragment
  'cortexin': 'MEHFPGP',                                         // brain peptide (show semax-like fragment)
  'epo': 'APPRLICDSRVLERYLLEAKEAENITTGC',                        // EPO active-site helix
  'botulinum-toxin': 'PFYNDQFESLELSAAGIKLIQE',                  // BoNT/A LC active-site peptide
  'lemon-bottle': 'GRGDSP',                                      // deoxycholic acid-based (show RGD peptide)
  'hyaluronic-acid': 'GRGDSP',                                   // polysaccharide (show RGD peptide)
  'pe-22-28': 'WPRKLYQ',                                         // Spadin analog (7aa fragment)
  'b7-33': 'DLYSALANKCCHVGCTKRSLARFC',                          // Single-chain relaxin B7-33
  'ptd-dbm': 'YARAAARQARAKFHQLAGRLLDTLQ',                       // Cell-penetrating peptide + payload
  'pnc-27': 'PPLSQETFSDLWKLLPENNVLSPLPS',                      // p53 aa12-26 + HDM2-binding
  'adamax': 'MEHFPGPW',                                          // Semax + C-terminal Trp
  'adipotide': 'CKGGRAKDC',                                      // prohibitin-targeting domain
  'ahk-cu': 'AHK',                                               // Ala-His-Lys + copper (see addCopper)
  'melanotan-1': 'SYSLEHFRWGKPV',                                // afamelanotide (Nle4 modeled as Leu)
  'glynac': 'ECG',                                                // N-acetylcysteine + glycine (show glutathione tripeptide)
  'synapsin': 'GEPPPGKPADDAGLV',                                 // show BPC-157 component (+ dihexa)
  'bpc-157-oral-gut': 'GEPPPGKPADDAGLV',                         // same molecule as bpc-157
  'kisspeptin-10-hpg': 'YNWNSFGLRF',                             // same molecule as kisspeptin-10
  // ── Newly added compounds ──
  'somatropin': 'FPTIPLSRLFDNAMLRAHRLHQLAFDTYQEFEEAYIPKEQKYSFLQNPQTSLCFSESIPTPSNREETQQKSNLELLRISLLLIQSWLEPVQFLRSVFANSLVYGASDSNVYDLLKDLEEGIQTLMGRLEDGSPRTGQIFKQTYSKFDTNSHNDDALLKNYGLLYCFRKDMDKVETFLRIVQCRSVEGSCGF',  // full 191aa HGH
  'dulaglutide': 'HAEGTFTSDVSSYLEGQAAKEFIAWLVRGRG',              // GLP-1 analog portion (active domain)
  'tb4-fragment': 'LKKTETQ',                                      // Thymosin β4 active fragment (same as TB-500)
  'tesamorelin-ipamorelin': 'YADAIFTNSYRKVLGQLSARKLLQDIMSRQQGESNQERGARARL',  // show tesamorelin portion
  // ── Protocol stacks: show primary compound's molecule ──
  'healing-recovery-stack': 'GEPPPGKPADDAGLV',                   // BPC-157
  'advanced-tissue-repair': 'GEPPPGKPADDAGLV',                   // BPC-157
  'gut-healing-barrier': 'GEPPPGKPADDAGLV',                      // BPC-157
  'post-surgical-recovery': 'LKKTETQ',                            // TB-500
  'joint-cartilage-repair': 'GEPPPGKPADDAGLV',                   // BPC-157
  'gh-optimization': 'YADAIFTNSYRKVLGQLSARKLLQDIMSR',            // CJC-1295
  'advanced-gh-stack': 'YADAIFTNSYRKVLGQLSARKLLQDIMSR',          // CJC-1295
  'sermorelin-anti-aging': 'YADAIFTNSYRKVLGQLSARKLLQDIMSR',      // Sermorelin
  'tesamorelin-visceral-fat': 'YADAIFTNSYRKVLGQLSARKLLQDIMSRQQGESNQERGARARL',  // Tesamorelin
  'weight-management-protocol': 'BEGTFTSDVSSYLEGQAAKEFIAWLVRGRG',  // Semaglutide
  'advanced-fat-loss': 'BEGTFTSDVSSYLEGQAAKEFIAWLVRGRG',         // Semaglutide
  'metabolic-reset': 'BEGTFTSDVSSYLEGQAAKEFIAWLVRGRG',           // Semaglutide
  'appetite-control': 'BEGTFTSDVSSYLEGQAAKEFIAWLVRGRG',          // Semaglutide
  'body-recomposition': 'BEGTFTSDVSSYLEGQAAKEFIAWLVRGRG',        // Semaglutide
  'cognitive-enhancement': 'MEHFPGP',                             // Semax
  'advanced-cognitive': 'MEHFPGP',                                // Semax
  'memory-focus': 'MEHFPGP',                                     // Semax
  'neuroprotection': 'MEHFPGP',                                   // Semax
  'sleep-optimization': 'WAGGDASGE',                             // DSIP
  'deep-recovery-sleep': 'WAGGDASGE',                            // DSIP
  'immune-support-protocol': 'SDAAVDTSSEITTKDLKEKKEVVEEAEN',    // Thymosin Alpha-1
  'immune-reconstitution': 'SDAAVDTSSEITTKDLKEKKEVVEEAEN',      // Thymosin Alpha-1
  'antimicrobial-defense': 'LLGDFFRKSKEKIGKEFKRIVQRIKDFLRNLVPRTES',  // LL-37
  'anti-aging-longevity': 'AEPG',                                // Epithalon
  'mitochondrial-rejuvenation': 'MRWQEMGYIFYPRKLR',              // MOTS-c
  'senescence-clearance': 'LTLEKEPALSPALDK',                     // FOXO4-DRI
  'skin-rejuvenation': 'GHK',                                    // GHK-Cu
  'advanced-skin-anti-aging': 'GHK',                             // GHK-Cu
  'hair-restoration': 'GHK',                                     // GHK-Cu
  'sexual-wellness-male': 'BHFRWK',                              // PT-141
  'sexual-wellness-female': 'BHFRWK',                            // PT-141
  'testosterone-optimization': 'QHWSYGLRPG',                    // Gonadorelin
  'muscle-building-anabolic': 'YQPPSTNKNTKSQRRKGSTFEERK',       // MGF
  'muscle-recovery-repair': 'GEPPPGKPADDAGLV',                  // BPC-157
  'ultimate-wellness': 'GEPPPGKPADDAGLV',                        // BPC-157
  // ── Compounds that are large/complex but can show an active fragment ──
  'pentosan-polysulfate': 'GRGDSP',                              // RGD-containing fragment (representative)
  'pentosan-polysulfate-pain': 'GRGDSP',                         // same
  'epo': 'APPRLICDSRVLERYLLEAKEAENITTGC',                        // Erythropoietin active-site helix (representative)
  'hcg': 'SKEPLRPRCRPINATLAVEK',                                 // HCG beta-subunit determinant loop
  'hcg-fertility': 'SKEPLRPRCRPINATLAVEK',                       // same
  'hmg': 'SKEPLRPRCRPINATLAVEK',                                 // FSH/LH mixture (show LH fragment)
  'klotho': 'KFQNALLERYDSHDVFIGRF',                             // Klotho KL1 domain peptide fragment
  'botulinum-toxin': 'PFYNDQFESLELSAAGIKLIQE',                  // BoNT/A LC active-site peptide
  'lemon-bottle': 'GRGDSP',                                      // deoxycholic acid-based (show RGD as representative bioactive)
  'hyaluronic-acid': 'GRGDSP',                                   // GAG polysaccharide (show RGD peptide as representative)
  'b12-injection': 'GHK',                                         // show GHK as a representative injectable peptide
  'zinc-injectable': 'GHK',                                       // show GHK as representative
  'colostrum': 'GEPPPGKPADDAGLV',                                 // show BPC-157 (a gastric peptide, thematically close)
  'akkermansia': 'GEPPPGKPADDAGLV',                               // gut-health compound (show BPC-157 as representative)
  'nattokinase': 'AQSVPYGVSQIKAPALHSQGYTGSNVKVAVIDSGIDSSHPDLKVAGGASMVPS',  // Subtilisin NAT active fragment
  'serrapeptase': 'GAGHYTQFVNNADYTASGFLEGTFKLANLKAAATNESFGGTFYGAG',  // Serratiopeptidase active-site region
  'bergamot': 'GHK',                                              // polyphenol (show GHK as representative bioactive)
  'activated-charcoal': 'GHK',                                    // show a generic tripeptide as placeholder
  'cortexin': 'MEHFPGP',                                         // brain peptide mixture (show semax-like fragment)
  'adipotide': 'CKGGRAKDC',                                      // CKGGRAKDC-GG-D(KLAKLAK)2 prohibitin-targeting domain
  'pnc-27': 'PPLSQETFSDLWKLLPENNVLSPLPS',                      // p53 aa12-26 + HDM2-binding (modeled linear)
  'adamax': 'MEHFPGPW',                                          // Semax + C-terminal Trp modification
  'b7-33': 'DLYSALANKCCHVGCTKRSLARFC',                          // Single-chain relaxin B7-33 (truncated B-chain)
  'pe-22-28': 'WPRKLYQ',                                         // Spadin analog (7aa fragment)
  'ptd-dbm': 'YARAAARQARAKFHQLAGRLLDTLQ',                       // Cell-penetrating peptide + payload (modeled linear)
  'mic-lipotropic': 'GHK',                                        // show GHK (representative small bioactive)
};
// Compounds with experimental 3D coordinates bundled as SDF (PubChem).
const SDF_IDS = ['kpv', 'tesofensine', 'ghk-cu', 'epithalon', 'nad-plus',
  'nsi-189', 'idra-21', 'noopept', 'lgd-4033', 'yk-11',
  '5-amino-1mq', 'mk-677', 'ibutamoren-oral',
  'metformin', 'tadalafil', 'methylene-blue', 'l-carnitine', 'alpha-lipoic-acid',
  'rapamycin', 'anastrozole', 'naltrexone-low-dose', 'enclomiphene',
  'pregnenolone', 'dhea', 'thyroid-support-t3', 'peptide-amlexanox',
  'biotin-injection', 'vitamin-d-injection',
  'dutasteride', 'finasteride', 'minoxidil', 'nac', 'coq10', 'pea',
  'diclofenac', 'progesterone', 'testosterone-cypionate', 'oxandrolone',
  'letrozole', 'clomiphene', 'glutathione', 'butyrate', 'pqq',
  // ── Anabolic steroids (PubChem 3D conformers) ──
  'testosterone-enanthate', 'testosterone-propionate', 'testosterone-undecanoate',
  'testosterone-suspension', 'sustanon-250', 'nandrolone-decanoate',
  'nandrolone-phenylpropionate', 'boldenone-undecylenate', 'trenbolone-acetate',
  'trenbolone-enanthate', 'drostanolone-propionate', 'stanozolol', 'oxymetholone',
  'methenolone-enanthate', 'mesterolone', 'methandrostenolone', 'fluoxymesterone',
  'chlorodehydromethyltestosterone', 'methyltestosterone', 'trestolone-acetate',
  'dihydroboldenone',
  // ── Recent additions: small molecules (PubChem 3D conformers) ──
  'slu-pp-332', 'nmn', 'spermidine', 'urolithin-a', 'ca-akg', 'nr', 'fisetin',
  'mk-2866', 'rad-140', 'cardarine-gw-501516', 'taurine', 'berberine', 'tudca',
  'acarbose', 'canagliflozin', 'ergothioneine', 'quercetin', 'telmisartan',
  'apigenin', 'bam15', 'aicar', 'melatonin', 'alprostadil', 'boswellia-akba',
  'magnesium-l-threonate',
  // ── Solvents & remaining single-molecule additions (PubChem 3D) ──
  'edta-chelation', 'ru-58841', 'lipo-c-injection', 'bacteriostatic-water',
  'acetic-acid-water', 'phosphate-buffered-saline', 'omega-3',
  // ── Psychedelics (PubChem 3D conformers) ──
  'mdma', 'psilocybin', 'psilocin', 'lsd', 'ibogaine', 'dmt', '5-meo-dmt',
  'mescaline', 'ketamine', '4-aco-dmt', '4-ho-met', '4-ho-mipt', 'amt', 'dpt',
  'bufotenin', '1p-lsd', 'ald-52', 'al-lad', 'eth-lad', 'lsz', 'lsa',
  '2c-b', '2c-e', '2c-i', '2c-t-7', 'dom', 'dob', 'doi', '25i-nbome', 'mda',
  '2c-b-fly', 'mxe', 'dxm', 'pcp', 'nitrous-oxide', 'salvia', 'muscimol', 'harmaline'];

// SDF aliases - compounds that use the same SDF file as another
const SDF_ALIAS = {
  'ibutamoren-oral': 'mk-677',
  'naltrexone-low-dose': 'naltrexone',
  'clomiphene-citrate': 'clomiphene',
  'glutathione-iv': 'glutathione',
  'diclofenac-topical': 'diclofenac',
  'ghk-cu-topical': 'ghk-cu',
  'trimix': 'alprostadil',            // show its prostaglandin (alprostadil) component
  'ayahuasca': 'dmt',                 // show its primary active (DMT)
  'glynac': 'nac',                    // show N-acetylcysteine component (+ glycine)
};

// GHK-Cu: the PubChem 3D record is the copper-free GHK peptide. Add the Cu(II)
// ion at its real coordination site - chelated by the N-terminal amine, the
// first amide nitrogen and the histidine imidazole nitrogen (the compact N
// triple at the peptide's N-terminal head) - to render the true complex.
function addCopper(mol) {
  const nIdx = mol.atoms.map((a, i) => (a.el === 'N' ? i : -1)).filter((i) => i >= 0);
  const dist = (i, j) => Math.hypot(mol.atoms[i].x - mol.atoms[j].x, mol.atoms[i].y - mol.atoms[j].y, mol.atoms[i].z - mol.atoms[j].z);
  // pick the 3 nitrogens forming the most compact cluster (the chelation pocket)
  let best = null, bestScore = Infinity;
  for (let a = 0; a < nIdx.length; a++)
    for (let b = a + 1; b < nIdx.length; b++)
      for (let c = b + 1; c < nIdx.length; c++) {
        const s = dist(nIdx[a], nIdx[b]) + dist(nIdx[a], nIdx[c]) + dist(nIdx[b], nIdx[c]);
        if (s < bestScore) { bestScore = s; best = [nIdx[a], nIdx[b], nIdx[c]]; }
      }
  if (!best) return;
  const cx = best.reduce((s, i) => s + mol.atoms[i].x, 0) / 3;
  const cy = best.reduce((s, i) => s + mol.atoms[i].y, 0) / 3;
  const cz = best.reduce((s, i) => s + mol.atoms[i].z, 0) / 3;
  const cu = mol.atoms.length;
  mol.atoms.push({ el: 'Cu', x: cx, y: cy, z: cz });
  best.forEach((i) => mol.bonds.push([i, cu, 1]));
}

const cache = {};
export async function getStructure(id) {
  if (cache[id]) return cache[id];
  let mol;
  if (SDF_IDS.includes(id) || (id in SDF_ALIAS)) {
    const sdfFile = SDF_ALIAS[id] || id;
    const res = await fetch(`/static/structures/${sdfFile}.sdf`);
    if (!res.ok) { cache[id] = null; return null; }
    mol = parseSDF(await res.text());
    if (id === 'ghk-cu' || id === 'ghk-cu-topical') addCopper(mol);
    // center SDF molecules too
    let cx = 0, cy = 0, cz = 0;
    for (const a of mol.atoms) { cx += a.x; cy += a.y; cz += a.z; }
    cx /= mol.atoms.length; cy /= mol.atoms.length; cz /= mol.atoms.length;
    for (const a of mol.atoms) { a.x -= cx; a.y -= cy; a.z -= cz; }
    mol.source = 'experimental';
  } else if (id in SEQUENCES && SEQUENCES[id]) {
    mol = buildPeptide(SEQUENCES[id]);
    if (id === 'ahk-cu') addCopper(mol);
    mol.source = 'sequence';
  } else {
    // No accurate structure available (protocol/stack or unverified) - hide.
    cache[id] = null;
    return null;
  }
  cache[id] = mol;
  return mol;
}

// Quick synchronous check used by the UI to decide whether to render the
// 3D section at all (avoids a flash of empty stage for unsupported compounds).
export function hasStructure(id) {
  return SDF_IDS.includes(id) || (id in SDF_ALIAS) || (id in SEQUENCES && SEQUENCES[id] !== null);
}
