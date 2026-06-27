export const MODEL_LAB_PRESETS = [
  {
    id: "source-clean",
    label: "Source Clean",
    summary: "Nettoyage prudent, textures intactes.",
    details: "Prune, dedup et weld. Aucun redimensionnement texture, aucune simplification.",
    textureMax: null,
    simplifyRatio: null,
    simplifyError: null,
    lockBorder: true,
    useMeshopt: false,
    isRisky: false
  },
  {
    id: "vistaire-web",
    label: "Vistaire Web",
    summary: "Candidat premium pour le viewer web.",
    details: "Meshopt, texture max 2048, simplification tres conservatrice.",
    textureMax: 2048,
    textureQuality: 94,
    simplifyRatio: 0.92,
    simplifyError: 0.00025,
    lockBorder: true,
    useMeshopt: true,
    isRisky: false
  },
  {
    id: "vistaire-mobile",
    label: "Vistaire Mobile",
    summary: "Equilibre poids et fidelite mobile.",
    details: "Meshopt, texture max 1536, simplification moderee avec bordures verrouillees.",
    textureMax: 1536,
    textureQuality: 92,
    simplifyRatio: 0.78,
    simplifyError: 0.00045,
    lockBorder: true,
    useMeshopt: true,
    isRisky: false
  },
  {
    id: "ar-lite",
    label: "AR Lite",
    summary: "GLB leger sans extension de compression ajoutee.",
    details: "Preserve scale/origin, texture max 1024, pas de Meshopt ni Draco requis ajoute.",
    textureMax: 1024,
    textureQuality: 90,
    simplifyRatio: 0.72,
    simplifyError: 0.0006,
    lockBorder: true,
    useMeshopt: false,
    isRisky: false
  },
  {
    id: "emergency-light",
    label: "Emergency Light",
    summary: "Non default, risque visuel eleve.",
    details: "Dernier recours quand un asset reste trop lourd. Controle visuel obligatoire.",
    textureMax: 1024,
    textureQuality: 86,
    simplifyRatio: 0.55,
    simplifyError: 0.001,
    lockBorder: true,
    useMeshopt: true,
    isRisky: true
  }
] as const;

export type ModelLabPreset = (typeof MODEL_LAB_PRESETS)[number];
export type ModelLabPresetId = ModelLabPreset["id"];

export function getModelLabPreset(id: ModelLabPresetId): ModelLabPreset {
  const preset = MODEL_LAB_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new Error("Unknown Model Lab preset.");
  return preset;
}
