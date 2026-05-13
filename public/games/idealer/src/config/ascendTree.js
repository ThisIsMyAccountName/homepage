export const ASCEND_TREE = [
  {
    id: "singularity",
    name: "Singularity Node",
    description: "Unlock the Ascension grid.",
    cost: 1,
    q: 0,
    r: 0,
    effect: { productionMultiplier: 1.03 }
  },
  {
    id: "alphaFlow",
    name: "Alpha Flow",
    description: "+3% Matter production.",
    cost: 4,
    q: 1,
    r: 0,
    effect: { matterRateMultiplier: 1.03 }
  },
  {
    id: "betaCoil",
    name: "Beta Coil",
    description: "+3% shard gain.",
    cost: 4,
    q: 0,
    r: 1,
    effect: { prestigeGainMultiplier: 1.03 }
  },
  {
    id: "gammaWeave",
    name: "Gamma Weave",
    description: "+5% offline efficiency.",
    cost: 4,
    q: -1,
    r: 1,
    effect: { offlineEfficiencyMultiplier: 1.05 }
  },
  {
    id: "deltaForge",
    name: "Delta Forge",
    description: "-1% generator cost growth.",
    cost: 4,
    q: -1,
    r: 0,
    effect: { generatorCostGrowthMultiplier: 0.99 }
  },
  {
    id: "epsilonLens",
    name: "Epsilon Lens",
    description: "+1 Fire per conversion.",
    cost: 4,
    q: 0,
    r: -1,
    effect: { conversionFireBonus: 1 }
  },
  {
    id: "zetaChannel",
    name: "Zeta Channel",
    description: "+2 Matter per click.",
    cost: 4,
    q: 1,
    r: -1,
    effect: { clickMatterBonus: 2 }
  },
  {
    id: "aetherLine",
    name: "Aether Line",
    description: "+5% Matter production.",
    cost: 8,
    q: 2,
    r: 0,
    effect: { matterRateMultiplier: 1.05 }
  },
  {
    id: "emberLine",
    name: "Ember Line",
    description: "+5% Fire production.",
    cost: 8,
    q: 2,
    r: -1,
    effect: { fireRateMultiplier: 1.05 }
  },
  {
    id: "fractureWeave",
    name: "Fracture Weave",
    description: "-5% conversion cost.",
    cost: 8,
    q: 1,
    r: 1,
    effect: { conversionCostMultiplier: 0.95 }
  },
  {
    id: "ionSpine",
    name: "Ion Spine",
    description: "+4% all production.",
    cost: 8,
    q: 0,
    r: 2,
    effect: { productionMultiplier: 1.04 }
  },
  {
    id: "vaultSigil",
    name: "Vault Sigil",
    description: "-5% research costs.",
    cost: 8,
    q: -1,
    r: 2,
    effect: { researchCostMultiplier: 0.95 }
  },
  {
    id: "glowThread",
    name: "Glow Thread",
    description: "+5% Fire production.",
    cost: 8,
    q: -2,
    r: 2,
    effect: { fireRateMultiplier: 1.05 }
  },
  {
    id: "gravityWeld",
    name: "Gravity Weld",
    description: "-5% generator cost growth.",
    cost: 8,
    q: -2,
    r: 1,
    effect: { generatorCostGrowthMultiplier: 0.95 }
  },
  {
    id: "coilAnchor",
    name: "Coil Anchor",
    description: "+6% offline efficiency.",
    cost: 8,
    q: -2,
    r: 0,
    effect: { offlineEfficiencyMultiplier: 1.06 }
  },
  {
    id: "runeMatrix",
    name: "Rune Matrix",
    description: "+3 Matter per click.",
    cost: 8,
    q: -1,
    r: -1,
    effect: { clickMatterBonus: 3 }
  },
  {
    id: "flarePulse",
    name: "Flare Pulse",
    description: "+1 Fire per conversion.",
    cost: 8,
    q: 0,
    r: -2,
    effect: { conversionFireBonus: 1 }
  },
  {
    id: "heliosGate",
    name: "Helios Gate",
    description: "+5% shard gain.",
    cost: 8,
    q: 1,
    r: -2,
    effect: { prestigeGainMultiplier: 1.05 }
  },
  {
    id: "temporalLink",
    name: "Temporal Link",
    description: "+4% all production.",
    cost: 8,
    q: 2,
    r: -2,
    effect: { productionMultiplier: 1.04 }
  },
  {
    id: "aureateSpine",
    name: "Aureate Spine",
    description: "+6% Matter production.",
    cost: 14,
    q: 3,
    r: 0,
    effect: { matterRateMultiplier: 1.06 }
  },
  {
    id: "cinderLoom",
    name: "Cinder Loom",
    description: "+6% Fire production.",
    cost: 14,
    q: 3,
    r: -1,
    effect: { fireRateMultiplier: 1.06 }
  },
  {
    id: "grailArray",
    name: "Grail Array",
    description: "+5% all production.",
    cost: 14,
    q: 3,
    r: -2,
    effect: { productionMultiplier: 1.05 }
  },
  {
    id: "fervorCoil",
    name: "Fervor Coil",
    description: "+1 Fire per conversion.",
    cost: 14,
    q: 3,
    r: -3,
    effect: { conversionFireBonus: 1 }
  },
  {
    id: "runeCapacitor",
    name: "Rune Capacitor",
    description: "+3 Matter per click.",
    cost: 14,
    q: 2,
    r: -3,
    effect: { clickMatterBonus: 3 }
  },
  {
    id: "ashenLens",
    name: "Ashen Lens",
    description: "-6% conversion cost.",
    cost: 14,
    q: 1,
    r: -3,
    effect: { conversionCostMultiplier: 0.94 }
  },
  {
    id: "solventGate",
    name: "Solvent Gate",
    description: "-6% research costs.",
    cost: 14,
    q: 0,
    r: -3,
    effect: { researchCostMultiplier: 0.94 }
  },
  {
    id: "sableFlow",
    name: "Sable Flow",
    description: "-6% generator cost growth.",
    cost: 14,
    q: -1,
    r: -2,
    effect: { generatorCostGrowthMultiplier: 0.94 }
  },
  {
    id: "dawnMatrix",
    name: "Dawn Matrix",
    description: "+8% offline efficiency.",
    cost: 14,
    q: -2,
    r: -1,
    effect: { offlineEfficiencyMultiplier: 1.08 }
  },
  {
    id: "obeliskThread",
    name: "Obelisk Thread",
    description: "+6% Matter production.",
    cost: 14,
    q: -3,
    r: 0,
    effect: { matterRateMultiplier: 1.06 }
  },
  {
    id: "emberLoom",
    name: "Ember Loom",
    description: "+6% Fire production.",
    cost: 14,
    q: -3,
    r: 1,
    effect: { fireRateMultiplier: 1.06 }
  },
  {
    id: "shardBraid",
    name: "Shard Braid",
    description: "+8% shard gain.",
    cost: 14,
    q: -3,
    r: 2,
    effect: { prestigeGainMultiplier: 1.08 }
  },
  {
    id: "lumenVault",
    name: "Lumen Vault",
    description: "+5% all production.",
    cost: 14,
    q: -3,
    r: 3,
    effect: { productionMultiplier: 1.05 }
  },
  {
    id: "vectorCoil",
    name: "Vector Coil",
    description: "+3 Matter per click.",
    cost: 14,
    q: -2,
    r: 3,
    effect: { clickMatterBonus: 3 }
  },
  {
    id: "glintReservoir",
    name: "Glint Reservoir",
    description: "+1 Fire per conversion.",
    cost: 14,
    q: -1,
    r: 3,
    effect: { conversionFireBonus: 1 }
  },
  {
    id: "ionicSigil",
    name: "Ionic Sigil",
    description: "-6% research costs.",
    cost: 14,
    q: 0,
    r: 3,
    effect: { researchCostMultiplier: 0.94 }
  },
  {
    id: "quartzRelay",
    name: "Quartz Relay",
    description: "-6% conversion cost.",
    cost: 14,
    q: 1,
    r: 2,
    effect: { conversionCostMultiplier: 0.94 }
  },
  {
    id: "hearthFrame",
    name: "Hearth Frame",
    description: "-6% generator cost growth.",
    cost: 14,
    q: 2,
    r: 1,
    effect: { generatorCostGrowthMultiplier: 0.94 }
  },
  {
    id: "celestForge",
    name: "Celest Forge",
    description: "+8% Matter production.",
    cost: 22,
    q: 4,
    r: 0,
    effect: { matterRateMultiplier: 1.08 }
  },
  {
    id: "pyreCant",
    name: "Pyre Cant",
    description: "+8% Fire production.",
    cost: 22,
    q: 4,
    r: -1,
    effect: { fireRateMultiplier: 1.08 }
  },
  {
    id: "chronoVault",
    name: "Chrono Vault",
    description: "+6% all production.",
    cost: 22,
    q: 4,
    r: -2,
    effect: { productionMultiplier: 1.06 }
  },
  {
    id: "vesselBloom",
    name: "Vessel Bloom",
    description: "+10% shard gain.",
    cost: 22,
    q: 4,
    r: -3,
    effect: { prestigeGainMultiplier: 1.1 }
  },
  {
    id: "sunkenCoil",
    name: "Sunken Coil",
    description: "+2 Fire per conversion.",
    cost: 22,
    q: 4,
    r: -4,
    effect: { conversionFireBonus: 2 }
  },
  {
    id: "masonCrest",
    name: "Mason Crest",
    description: "+4 Matter per click.",
    cost: 22,
    q: 3,
    r: -4,
    effect: { clickMatterBonus: 4 }
  },
  {
    id: "hollowLens",
    name: "Hollow Lens",
    description: "-8% conversion cost.",
    cost: 22,
    q: 2,
    r: -4,
    effect: { conversionCostMultiplier: 0.92 }
  },
  {
    id: "astralThread",
    name: "Astral Thread",
    description: "-8% research costs.",
    cost: 22,
    q: 1,
    r: -4,
    effect: { researchCostMultiplier: 0.92 }
  },
  {
    id: "obsidianRun",
    name: "Obsidian Run",
    description: "-8% generator cost growth.",
    cost: 22,
    q: 0,
    r: -4,
    effect: { generatorCostGrowthMultiplier: 0.92 }
  },
  {
    id: "gleamSocket",
    name: "Gleam Socket",
    description: "+10% offline efficiency.",
    cost: 22,
    q: -1,
    r: -3,
    effect: { offlineEfficiencyMultiplier: 1.1 }
  },
  {
    id: "silentTide",
    name: "Silent Tide",
    description: "+8% Matter production.",
    cost: 22,
    q: -2,
    r: -2,
    effect: { matterRateMultiplier: 1.08 }
  },
  {
    id: "emberCrest",
    name: "Ember Crest",
    description: "+8% Fire production.",
    cost: 22,
    q: -3,
    r: -1,
    effect: { fireRateMultiplier: 1.08 }
  },
  {
    id: "shardCrown",
    name: "Shard Crown",
    description: "+10% shard gain.",
    cost: 22,
    q: -4,
    r: 0,
    effect: { prestigeGainMultiplier: 1.1 }
  },
  {
    id: "praxisLine",
    name: "Praxis Line",
    description: "+6% all production.",
    cost: 22,
    q: -4,
    r: 1,
    effect: { productionMultiplier: 1.06 }
  },
  {
    id: "kiteFrame",
    name: "Kite Frame",
    description: "+4 Matter per click.",
    cost: 22,
    q: -4,
    r: 2,
    effect: { clickMatterBonus: 4 }
  },
  {
    id: "vaporRing",
    name: "Vapor Ring",
    description: "+2 Fire per conversion.",
    cost: 22,
    q: -4,
    r: 3,
    effect: { conversionFireBonus: 2 }
  },
  {
    id: "glyphNexus",
    name: "Glyph Nexus",
    description: "-8% research costs.",
    cost: 22,
    q: -4,
    r: 4,
    effect: { researchCostMultiplier: 0.92 }
  },
  {
    id: "sundialMesh",
    name: "Sundial Mesh",
    description: "-8% conversion cost.",
    cost: 22,
    q: -3,
    r: 4,
    effect: { conversionCostMultiplier: 0.92 }
  },
  {
    id: "prismWake",
    name: "Prism Wake",
    description: "-8% generator cost growth.",
    cost: 22,
    q: -2,
    r: 4,
    effect: { generatorCostGrowthMultiplier: 0.92 }
  },
  {
    id: "aurumTide",
    name: "Aurum Tide",
    description: "+10% offline efficiency.",
    cost: 22,
    q: -1,
    r: 4,
    effect: { offlineEfficiencyMultiplier: 1.1 }
  },
  {
    id: "cinderVale",
    name: "Cinder Vale",
    description: "+8% Matter production.",
    cost: 22,
    q: 0,
    r: 4,
    effect: { matterRateMultiplier: 1.08 }
  },
  {
    id: "resonantArc",
    name: "Resonant Arc",
    description: "+8% Fire production.",
    cost: 22,
    q: 1,
    r: 3,
    effect: { fireRateMultiplier: 1.08 }
  },
  {
    id: "helixBasin",
    name: "Helix Basin",
    description: "+6% all production.",
    cost: 22,
    q: 2,
    r: 2,
    effect: { productionMultiplier: 1.06 }
  },
  {
    id: "riftDelveKeystone",
    name: "Rift Delve Keystone",
    description: "Unlocks Rift Delve room-crawls.",
    cost: 26,
    q: -3,
    r: -2,
    unlock: { type: "ascensions", value: 2 },
    effect: {}
  },
  {
    id: "lanternProtocol",
    name: "Lantern Protocol",
    description: "Rift Delve branch node.",
    cost: 30,
    q: -4,
    r: -2,
    effect: {}
  },
  {
    id: "vaultFooting",
    name: "Vault Footing",
    description: "Rift Delve branch node.",
    cost: 34,
    q: -5,
    r: -2,
    effect: {}
  },
  {
    id: "echoSurveyor",
    name: "Echo Surveyor",
    description: "Rift Delve branch node.",
    cost: 38,
    q: -5,
    r: -1,
    effect: {}
  },
  {
    id: "catacombAtlas",
    name: "Catacomb Atlas",
    description: "Rift Delve branch node.",
    cost: 42,
    q: -4,
    r: -3,
    effect: {}
  },
  {
    id: "graveCircuit",
    name: "Grave Circuit",
    description: "Rift Delve branch node.",
    cost: 46,
    q: -5,
    r: -3,
    effect: {}
  },
  {
    id: "expeditionKeystone",
    name: "Expedition Keystone",
    description: "Unlocks prestige expeditions.",
    cost: 24,
    q: 5,
    r: 0,
    unlock: { type: "ascensions", value: 1 },
    effect: {}
  },
  {
    id: "cartographerSpindle",
    name: "Cartographer Spindle",
    description: "+12% voyage speed and +5% intel gain.",
    cost: 28,
    q: 6,
    r: 0,
    effect: { expeditionSpeedMultiplier: 1.12, expeditionIntelMultiplier: 1.05 }
  },
  {
    id: "hazardSeals",
    name: "Hazard Seals",
    description: "Reduce voyage failure risk by 7%.",
    cost: 32,
    q: 7,
    r: -1,
    effect: { expeditionRiskMitigation: 0.07 }
  },
  {
    id: "salvageVats",
    name: "Salvage Vats",
    description: "5% chance to salvage +1 shard on voyage success.",
    cost: 36,
    q: 8,
    r: -1,
    effect: { expeditionShardBonus: 0.05 }
  },
  {
    id: "holdfastCoffers",
    name: "Holdfast Coffers",
    description: "+2 rewards chest capacity.",
    cost: 31,
    q: 6,
    r: 1,
    effect: { rewardsChestCapacityBonus: 2 }
  },
  {
    id: "dockwrightTenets",
    name: "Dockwright Tenets",
    description: "+1 max level on ship facilities.",
    cost: 34,
    q: 7,
    r: 0,
    effect: { facilityMaxLevelBonus: 1 }
  },
  {
    id: "voidLockers",
    name: "Void Lockers",
    description: "+3 rewards chest capacity.",
    cost: 38,
    q: 7,
    r: 1,
    effect: { rewardsChestCapacityBonus: 3 }
  },
  {
    id: "fleetFoundries",
    name: "Fleet Foundries",
    description: "+1 max level on ship facilities.",
    cost: 41,
    q: 8,
    r: 0,
    effect: { facilityMaxLevelBonus: 1 }
  },
  {
    id: "alloyInfusion",
    name: "Alloy Infusion",
    description: "+1 max tier for ship parts.",
    cost: 45,
    q: 9,
    r: 0,
    effect: { partTierCapBonus: 1 }
  },
  {
    id: "novaLoom",
    name: "Nova Loom",
    description: "+10% shard gain.",
    cost: 22,
    q: 3,
    r: 1,
    effect: { prestigeGainMultiplier: 1.1 }
  }
];
