export const BALANCE = {
  tickMs: 100,
  minRenderIntervalMs: 80,
  autoSaveMs: 30000,
  offlineEfficiency: 0.5,
  baseClickMatter: 1,
  elementConversionCost: 100,
  prestigeDivisor: 100,
  fireShardValue: 100,
  ascendBaseMatter: 500,
  ascendBaseFire: 5,
  ascendCostGrowth: 1.6,
  generatorCostGrowth: 1.13,
  generators: {
    furnace: {
      id: "furnace",
      name: "Furnace",
      resource: "matter",
      baseRate: 0.12,
      baseCost: 14,
      costResource: "matter"
    },
    condenser: {
      id: "condenser",
      name: "Condenser",
      resource: "matter",
      baseRate: 0.48,
      baseCost: 140,
      costResource: "matter"
    },
    prism: {
      id: "prism",
      name: "Element Prism",
      resource: "fire",
      baseRate: 0.08,
      baseCost: 16,
      costResource: "fire"
    }
  },
  upgradeOrder: [
    "kineticGloves",
    "runicGrip",
    "alloyIntake",
    "emberEcho",
    "thermalLens",
    "signalFocusing",
    "vacuumSeals",
    "mercuryRegulators",
    "cinderThreads",
    "fluxPistons",
    "stellarConveyor",
    "pulseCoil",
    "twinFlux",
    "emberCatalyst",
    "prismaticVeil",
    "isochronSprings",
    "phaseBaffles",
    "snapCircuitry",
    "riftLattice",
    "thermalLattice",
    "arcSpanners",
    "scholarVane",
    "obsidianCore",
    "shardSiphon",
    "glassFoundry",
    "catalystCoil",
    "refluxMatrix",
    "alchemyWeave",
    "fluxRelay"
  ],
  researchOrder: [
    "arcaneThermodynamics",
    "kineticAmplifier",
    "crystalLattice",
    "fieldResonance",
    "furnaceTuning",
    "ignitionSpiral",
    "condenserTuning",
    "metallurgicMemory",
    "ambientCharge",
    "yieldCatalysis",
    "continuumTuning",
    "prismLore",
    "atomicLattice",
    "conversionAnchors",
    "criticalStudies",
    "cryoCalibration",
    "shardOptics",
    "twinFlow",
    "criticalFocus",
    "harmonicForge",
    "refundTheory",
    "catalystBleed",
    "matrixDamping",
    "emberClicks",
    "transmuteCadence",
    "shardTheory",
    "shardFractal",
    "transcendentSchema"
  ],
  upgradeCostDefaults: {
    quadCap: 35,
    quadScale: 0.013,
    targetEnd: 1e31,
    unlockCostFactor: 0.5,
    autoBalance: true
  },
  researchCostDefaults: {
    quadCap: 2,
    quadScale: 0.05,
    targetEnd: 240,
    baseScalePerIndex: 0.25,
    baseScaleExponent: 1,
    autoBalance: true
  },
  expeditions: {
    unlockNodeId: "expeditionKeystone",
    offlineProgressMultiplier: 0.55,
    rewardsChestCapacity: 10,
    minSuccessChance: 0.15,
    maxSuccessChance: 0.95,
    defaultStageVarianceRanges: {
      riskDelta: { min: -0.03, max: 0.04 },
      yieldDelta: { min: -0.04, max: 0.05 },
      speedMultiplier: { min: 0.96, max: 1.05 },
      intelFlat: { min: 0, max: 1 }
    },
    ships: {
      raft: {
        id: "raft",
        name: "Raft",
        purchaseCost: { matter: 0, fire: 0, intel: 0 },
        unlock: { type: "ascensionNode", value: "expeditionKeystone" },
        facilityProfile: {
          hull: {
            maxLevel: 4,
            effectsPerLevel: {
              penaltyDampening: 0.018,
              riskMitigation: 0.006
            }
          },
          sail: {
            maxLevel: 4,
            effectsPerLevel: {
              speedMultiplier: 0.03
            }
          },
          anchor: {
            maxLevel: 4,
            effectsPerLevel: {
              riskMitigation: 0.014
            }
          },
          net: {
            maxLevel: 4,
            effectsPerLevel: {
              rareDropWeight: 0.035,
              yieldMultiplier: 0.008
            }
          }
        },
        visual: {
          theme: "raft",
          asset: "assets/ships/raft.svg",
          mastCount: 1,
          palette: {
            hullStart: "#9a6a36",
            hullEnd: "#70421e",
            sailTop: "#f4ead2",
            sailBottom: "#d8c6a0",
            waterTop: "rgba(100, 140, 160, 0.16)",
            waterBottom: "rgba(40, 76, 92, 0.24)"
          },
          zones: {
            hull: { left: 22, top: 70 },
            sail: { left: 42, top: 26 },
            anchor: { left: 72, top: 74 },
            net: { left: 60, top: 52 }
          }
        },
        baseStats: {
          speedMultiplier: 1,
          riskMitigation: 0,
          yieldMultiplier: 1,
          penaltyDampening: 0,
          rareDropWeight: 1
        }
      },
      sloop: {
        id: "sloop",
        name: "Sloop",
        purchaseCost: { matter: 9000, fire: 180, intel: 180 },
        unlock: { type: "ascensionNode", value: "cartographerSpindle" },
        requiredBlueprint: "ship:sloop:keel-plan",
        facilityProfile: {
          hull: {
            maxLevel: 6,
            effectsPerLevel: {
              penaltyDampening: 0.024,
              riskMitigation: 0.008
            }
          },
          sail: {
            maxLevel: 8,
            effectsPerLevel: {
              speedMultiplier: 0.045
            }
          },
          anchor: {
            maxLevel: 5,
            effectsPerLevel: {
              riskMitigation: 0.018
            }
          },
          net: {
            maxLevel: 6,
            effectsPerLevel: {
              rareDropWeight: 0.045,
              yieldMultiplier: 0.01
            }
          }
        },
        visual: {
          theme: "sloop",
          asset: "assets/ships/sloop.svg",
          mastCount: 2,
          palette: {
            hullStart: "#8f6736",
            hullEnd: "#60391d",
            sailTop: "#f6f0df",
            sailBottom: "#d6c7a9",
            waterTop: "rgba(86, 128, 155, 0.16)",
            waterBottom: "rgba(34, 70, 92, 0.26)"
          },
          zones: {
            hull: { left: 24, top: 68 },
            sail: { left: 48, top: 22 },
            anchor: { left: 78, top: 72 },
            net: { left: 62, top: 44 }
          }
        },
        baseStats: {
          speedMultiplier: 1.08,
          riskMitigation: 0.02,
          yieldMultiplier: 1.03,
          penaltyDampening: 0.06,
          rareDropWeight: 1.05
        }
      },
      brig: {
        id: "brig",
        name: "Brig",
        purchaseCost: { matter: 28000, fire: 520, intel: 620 },
        unlock: { type: "ascensionNode", value: "hazardSeals" },
        requiredBlueprint: "ship:brig:frame-draft",
        facilityProfile: {
          hull: {
            maxLevel: 9,
            effectsPerLevel: {
              penaltyDampening: 0.032,
              riskMitigation: 0.015
            }
          },
          sail: {
            maxLevel: 7,
            effectsPerLevel: {
              speedMultiplier: 0.038
            }
          },
          anchor: {
            maxLevel: 10,
            effectsPerLevel: {
              riskMitigation: 0.032
            }
          },
          net: {
            maxLevel: 8,
            effectsPerLevel: {
              rareDropWeight: 0.055,
              yieldMultiplier: 0.013
            }
          }
        },
        visual: {
          theme: "brig",
          asset: "assets/ships/brig.svg",
          mastCount: 2,
          palette: {
            hullStart: "#7f5532",
            hullEnd: "#4d2c1b",
            sailTop: "#e9dfca",
            sailBottom: "#bfa983",
            waterTop: "rgba(76, 118, 145, 0.18)",
            waterBottom: "rgba(30, 62, 84, 0.28)"
          },
          zones: {
            hull: { left: 20, top: 70 },
            sail: { left: 46, top: 20 },
            anchor: { left: 80, top: 74 },
            net: { left: 66, top: 46 }
          }
        },
        baseStats: {
          speedMultiplier: 0.98,
          riskMitigation: 0.06,
          yieldMultiplier: 1.1,
          penaltyDampening: 0.14,
          rareDropWeight: 1.12
        }
      },
      galleon: {
        id: "galleon",
        name: "Galleon",
        purchaseCost: { matter: 75000, fire: 1400, intel: 1600 },
        unlock: { type: "ascensionNodeCount", value: 24 },
        requiredBlueprint: "ship:galleon:royal-charter",
        facilityProfile: {
          hull: {
            maxLevel: 12,
            effectsPerLevel: {
              penaltyDampening: 0.042,
              riskMitigation: 0.012
            }
          },
          sail: {
            maxLevel: 10,
            effectsPerLevel: {
              speedMultiplier: 0.09
            }
          },
          anchor: {
            maxLevel: 12,
            effectsPerLevel: {
              riskMitigation: 0.024
            }
          },
          net: {
            maxLevel: 14,
            effectsPerLevel: {
              rareDropWeight: 0.08,
              yieldMultiplier: 0.022
            }
          }
        },
        visual: {
          theme: "galleon",
          asset: "assets/ships/galleon.svg",
          mastCount: 3,
          palette: {
            hullStart: "#6f4c2d",
            hullEnd: "#3a2416",
            sailTop: "#ece0c2",
            sailBottom: "#b89d72",
            waterTop: "rgba(66, 110, 136, 0.2)",
            waterBottom: "rgba(24, 52, 74, 0.3)"
          },
          zones: {
            hull: { left: 18, top: 72 },
            sail: { left: 44, top: 18 },
            anchor: { left: 82, top: 76 },
            net: { left: 68, top: 44 }
          }
        },
        baseStats: {
          speedMultiplier: 0.9,
          riskMitigation: 0.12,
          yieldMultiplier: 1.22,
          penaltyDampening: 0.22,
          rareDropWeight: 1.18
        }
      }
    },
    shipFacilities: {
      hull: {
        label: "Hull",
        maxLevel: 6,
        levelCosts: [
          { matter: 1200, fire: 20, intel: 2 },
          { matter: 3200, fire: 55, intel: 4 },
          { matter: 8400, fire: 130, intel: 8 },
          { matter: 21000, fire: 300, intel: 14 },
          { matter: 47000, fire: 640, intel: 22 },
          { matter: 92000, fire: 1300, intel: 34 }
        ],
        effectsPerLevel: {
          penaltyDampening: 0.04,
          riskMitigation: 0.01
        }
      },
      sail: {
        label: "Sail",
        maxLevel: 6,
        levelCosts: [
          { matter: 900, fire: 30, intel: 2 },
          { matter: 2400, fire: 85, intel: 4 },
          { matter: 6200, fire: 210, intel: 7 },
          { matter: 15200, fire: 470, intel: 13 },
          { matter: 36000, fire: 1020, intel: 21 },
          { matter: 76000, fire: 2100, intel: 33 }
        ],
        effectsPerLevel: {
          speedMultiplier: 0.045
        }
      },
      anchor: {
        label: "Anchor",
        maxLevel: 5,
        levelCosts: [
          { matter: 1000, fire: 22, intel: 2 },
          { matter: 2800, fire: 72, intel: 5 },
          { matter: 7200, fire: 180, intel: 10 },
          { matter: 18000, fire: 420, intel: 17 },
          { matter: 43000, fire: 930, intel: 27 }
        ],
        effectsPerLevel: {
          riskMitigation: 0.025
        }
      },
      net: {
        label: "Net",
        maxLevel: 5,
        levelCosts: [
          { matter: 1100, fire: 24, intel: 2 },
          { matter: 3000, fire: 78, intel: 5 },
          { matter: 7900, fire: 195, intel: 10 },
          { matter: 19600, fire: 460, intel: 18 },
          { matter: 46500, fire: 1000, intel: 30 }
        ],
        effectsPerLevel: {
          rareDropWeight: 0.09,
          yieldMultiplier: 0.015
        }
      }
    },
    duplicateBlueprintPolicy: {
      mode: "intel",
      intelPerDuplicate: 4,
      shardsPerDuplicate: 0
    },
    voyageMaps: {
      "map:abyssal-atlas": {
        name: "Abyssal Atlas",
        description: "A pressure-scored atlas describing hidden descent spirals.",
        unlocksBandId: "abyssal-run"
      },
      "map:sunken-registry": {
        name: "Sunken Registry",
        description: "A sovereign ledger charting old command lanes through the rift bed.",
        unlocksBandId: "sunken-registry-run"
      }
    },
    rareBlueprintDrops: {
      "initiate-run": [
        {
          id: "part:raft:sail:patched-cloth",
          name: "Patched Cloth Sail",
          rarity: "semi-rare",
          chance: 0.11,
          fromPool: ["standard", "stability"],
          shipId: "raft",
          slot: "sail",
          effects: { speedMultiplier: 0.05, yieldMultiplier: 0.015 }
        },
        {
          id: "part:raft:net:trawl-lines",
          name: "Braided Trawl Lines",
          rarity: "semi-rare",
          chance: 0.065,
          fromPool: ["standard", "volatile"],
          shipId: "raft",
          slot: "net",
          effects: { rareDropWeight: 0.05, yieldMultiplier: 0.01 }
        },
        {
          id: "ship:sloop:keel-plan",
          name: "Sloop Keel Plan",
          rarity: "rare",
          chance: 0.9,
          fromPool: ["volatile", "standard"],
          blueprintForShip: "sloop"
        }
      ],
      "drift-net-run": [
        {
          id: "part:raft:anchor:tide-pin",
          name: "Tide-Pin Anchor",
          rarity: "rare",
          chance: 0.055,
          fromPool: ["stability", "netline"],
          shipId: "raft",
          slot: "anchor",
          effects: { riskMitigation: 0.035, penaltyDampening: 0.05 }
        },
        {
          id: "part:raft:sail:wind-lattice",
          name: "Wind Lattice Sail",
          rarity: "semi-rare",
          chance: 0.07,
          fromPool: ["standard", "netline"],
          shipId: "raft",
          slot: "sail",
          effects: { speedMultiplier: 0.06, yieldMultiplier: 0.012 }
        }
      ],
      "forager-run": [
        {
          id: "part:raft:hull:current-baffles",
          name: "Current Baffles",
          rarity: "rare",
          chance: 0.048,
          fromPool: ["stability", "reconnaissance"],
          shipId: "raft",
          slot: "hull",
          effects: { penaltyDampening: 0.07, riskMitigation: 0.018 }
        },
        {
          id: "part:sloop:net:signal-knots",
          name: "Signal Knot Netting",
          rarity: "rare",
          chance: 0.036,
          fromPool: ["standard", "reconnaissance"],
          shipId: "sloop",
          slot: "net",
          effects: { rareDropWeight: 0.06, yieldMultiplier: 0.015 }
        }
      ],
      "architect-run": [
        {
          id: "part:sloop:anchor:forged-ring",
          name: "Forged Anchor Ring",
          rarity: "rare",
          chance: 0.05,
          fromPool: ["cartographer", "standard"],
          shipId: "sloop",
          slot: "anchor",
          effects: { riskMitigation: 0.04, penaltyDampening: 0.05 }
        },
        {
          id: "part:sloop:hull:pressure-rivets",
          name: "Pressure Rivets",
          rarity: "rare",
          chance: 0.038,
          fromPool: ["stability", "cartographer"],
          shipId: "sloop",
          slot: "hull",
          effects: { penaltyDampening: 0.08, riskMitigation: 0.02 }
        },
        {
          id: "ship:brig:frame-draft",
          name: "Brig Frame Draft",
          rarity: "rare",
          chance: 0.025,
          fromPool: ["volatile", "cartographer"],
          blueprintForShip: "brig"
        },
        {
          id: "map:abyssal-atlas",
          name: "Abyssal Atlas",
          rarity: "epic",
          chance: 0.012,
          fromPool: ["cartographer", "volatile"]
        }
      ],
      "courier-run": [
        {
          id: "part:sloop:sail:slipstream-cloth",
          name: "Slipstream Sailcloth",
          rarity: "epic",
          chance: 0.03,
          fromPool: ["courier", "volatile"],
          shipId: "sloop",
          slot: "sail",
          effects: { speedMultiplier: 0.08, yieldMultiplier: 0.02 }
        },
        {
          id: "part:sloop:anchor:smuggler-heel",
          name: "Smuggler Heel Anchor",
          rarity: "rare",
          chance: 0.042,
          fromPool: ["stability", "courier"],
          shipId: "sloop",
          slot: "anchor",
          effects: { riskMitigation: 0.045, penaltyDampening: 0.06 }
        }
      ],
      "sovereign-run": [
        {
          id: "part:brig:hull:abyssal-plating",
          name: "Abyssal Hull Plating",
          rarity: "epic",
          chance: 0.04,
          fromPool: ["sealed", "salvage"],
          shipId: "brig",
          slot: "hull",
          effects: { penaltyDampening: 0.12, riskMitigation: 0.03 }
        },
        {
          id: "part:brig:sail:rift-fabric",
          name: "Rift Fabric Main Sail",
          rarity: "epic",
          chance: 0.028,
          fromPool: ["volatile", "sealed"],
          shipId: "brig",
          slot: "sail",
          effects: { speedMultiplier: 0.06, yieldMultiplier: 0.03 }
        },
        {
          id: "ship:galleon:royal-charter",
          name: "Royal Charter",
          rarity: "epic",
          chance: 0.02,
          fromPool: ["sealed", "volatile"],
          blueprintForShip: "galleon"
        },
        {
          id: "map:sunken-registry",
          name: "Sunken Registry",
          rarity: "legendary",
          chance: 0.008,
          fromPool: ["sealed", "salvage"]
        }
      ],
      "abyssal-run": [
        {
          id: "part:brig:net:echo-trawl",
          name: "Echo Trawl Grid",
          rarity: "epic",
          chance: 0.03,
          fromPool: ["abyssal-hunt", "sealed"],
          shipId: "brig",
          slot: "net",
          effects: { rareDropWeight: 0.12, yieldMultiplier: 0.02 }
        },
        {
          id: "part:galleon:anchor:pilot-keel",
          name: "Pilot Keel Anchor",
          rarity: "epic",
          chance: 0.018,
          fromPool: ["charted", "abyssal-hunt"],
          shipId: "galleon",
          slot: "anchor",
          effects: { riskMitigation: 0.06, penaltyDampening: 0.08 }
        }
      ],
      "sunken-registry-run": [
        {
          id: "part:galleon:hull:imperial-rib",
          name: "Imperial Rift Rib",
          rarity: "legendary",
          chance: 0.02,
          fromPool: ["command", "registry"],
          shipId: "galleon",
          slot: "hull",
          effects: { penaltyDampening: 0.16, riskMitigation: 0.04 }
        },
        {
          id: "part:galleon:net:star-sieve",
          name: "Star Sieve Net",
          rarity: "legendary",
          chance: 0.015,
          fromPool: ["registry", "cataclysm"],
          shipId: "galleon",
          slot: "net",
          effects: { rareDropWeight: 0.16, yieldMultiplier: 0.05 }
        }
      ]
    },
    collectionSources: {
      expeditionRareDrops: {
        name: "Expedition Rare Drops",
        description: "Track every rare blueprint and ship part recovered from voyages.",
        autoFromRareDrops: true
      }
    },
    collectionMilestones: [
      {
        id: "collectionSurveyorLedger",
        requiredUnique: 1,
        name: "Surveyor Ledger",
        description: "+3% Matter production and +4% expedition speed.",
        effect: {
          matterRateMultiplier: 1.03,
          expeditionSpeedMultiplier: 1.04
        }
      },
      {
        id: "collectionArchivistSeal",
        requiredUnique: 3,
        name: "Archivist Seal",
        description: "+3% all production and +8% expedition intel gain.",
        effect: {
          productionMultiplier: 1.03,
          expeditionIntelMultiplier: 1.08
        }
      },
      {
        id: "collectionVoidCartography",
        requiredUnique: 6,
        name: "Void Cartography",
        description: "+6% shard gain and +3% expedition risk mitigation.",
        effect: {
          prestigeGainMultiplier: 1.06,
          expeditionRiskMitigation: 0.03
        }
      }
    ],
    defaultRouteChoices: [
      {
        id: "shielded",
        name: "Shielded Conduits",
        description: "Lower risk route with lighter salvage output.",
        riskDelta: -0.08,
        yieldDelta: -0.1,
        speedMultiplier: 0.92,
        intelFlat: 1,
        encounterPool: "stability"
      },
      {
        id: "balanced",
        name: "Balanced Route",
        description: "Stable pacing and neutral outcomes.",
        riskDelta: 0,
        yieldDelta: 0,
        speedMultiplier: 1,
        intelFlat: 0,
        encounterPool: "standard"
      },
      {
        id: "overclocked",
        name: "Overclocked Lanes",
        description: "Higher reward potential with volatile hazards.",
        riskDelta: 0.1,
        yieldDelta: 0.16,
        speedMultiplier: 1.1,
        intelFlat: 0,
        encounterPool: "volatile"
      }
    ],
    bands: [
      {
        id: "initiate-run",
        name: "Initiate Freightline",
        description: "A short salvage run through abandoned relay tunnels.",
        durationSeconds: 60,
        stageCount: 2,
        risk: 0.18,
        cost: { matter: 1200, fire: 20 },
        unlock: { type: "ascensionNodeCount", value: 2 },
        purchaseIntelCost: 0,
        rewards: { matter: 2400, fire: 28, shards: 0, intel: 5 },
        stageVarianceRanges: {
          riskDelta: { min: -0.03, max: 0.035 },
          yieldDelta: { min: -0.05, max: 0.05 },
          speedMultiplier: { min: 0.95, max: 1.06 },
          intelFlat: { min: 0, max: 1 }
        },
        routeChoices: [
          {
            id: "shielded",
            name: "Shielded Conduits",
            description: "Lower pressure corridors with safer extraction valves.",
            riskDelta: -0.08,
            yieldDelta: -0.1,
            speedMultiplier: 0.92,
            intelFlat: 1,
            encounterPool: "stability"
          },
          {
            id: "balanced",
            name: "Balanced Route",
            description: "Moderate pressure corridors with standard salvage pacing.",
            riskDelta: 0,
            yieldDelta: 0,
            speedMultiplier: 1,
            intelFlat: 0,
            encounterPool: "standard"
          },
          {
            id: "overclocked",
            name: "Overclocked Lanes",
            description: "Aggressive acceleration through unstable tunnels.",
            riskDelta: 0.1,
            yieldDelta: 0.16,
            speedMultiplier: 1.1,
            intelFlat: 0,
            encounterPool: "volatile"
          }
        ],
        encounters: [
          {
            id: "leak",
            name: "Boiler Leak",
            description: "Pressurized steam floods the tunnel frame.",
            difficulty: 0.34,
            success: { yieldDelta: 0.06, intelFlat: 1 },
            fail: { riskDelta: 0.05, yieldDelta: -0.05, matterPenalty: 160 }
          },
          {
            id: "relay-cache",
            name: "Relay Cache",
            description: "An old crate cluster can be stripped for parts.",
            difficulty: 0.28,
            success: { yieldDelta: 0.08, fireFlat: 6 },
            fail: { riskDelta: 0.03, firePenalty: 4 }
          }
        ],
        encounterPools: {
          stability: ["leak"],
          standard: ["leak", "relay-cache"],
          volatile: ["relay-cache"]
        }
      },
      {
        id: "drift-net-run",
        name: "Drift-Net Charter",
        description: "A paid raft charter focused on wake trawling and intel scouting.",
        durationSeconds: 70,
        stageCount: 2,
        risk: 0.24,
        cost: { matter: 3300, fire: 44 },
        unlock: { type: "ascensionNodeCount", value: 4 },
        requiredNodes: ["expeditionKeystone"],
        requiredShip: "raft",
        purchaseIntelCost: 650,
        rewards: { matter: 5600, fire: 82, shards: 0, intel: 9 },
        stageVarianceRanges: {
          riskDelta: { min: -0.04, max: 0.05 },
          yieldDelta: { min: -0.06, max: 0.07 },
          speedMultiplier: { min: 0.93, max: 1.09 },
          intelFlat: { min: 0, max: 2 }
        },
        routeChoices: [
          {
            id: "shielded",
            name: "Shielded Conduits",
            description: "Stabilize drift pressure for safer but smaller hauls.",
            riskDelta: -0.08,
            yieldDelta: -0.1,
            speedMultiplier: 0.91,
            intelFlat: 1,
            encounterPool: "stability"
          },
          {
            id: "balanced",
            name: "Balanced Route",
            description: "Hold course through standard wake pockets.",
            riskDelta: 0,
            yieldDelta: 0,
            speedMultiplier: 1,
            intelFlat: 0,
            encounterPool: "standard"
          },
          {
            id: "overclocked",
            name: "Overclocked Lanes",
            description: "Push the raft rig hard for faster extraction.",
            riskDelta: 0.11,
            yieldDelta: 0.15,
            speedMultiplier: 1.12,
            intelFlat: -1,
            encounterPool: "volatile"
          },
          {
            id: "netline-skim",
            name: "Netline Skim",
            description: "Sweep a narrow trawl line for above-average intel.",
            riskDelta: 0.03,
            yieldDelta: 0.08,
            speedMultiplier: 1.04,
            intelFlat: 2,
            encounterPool: "netline"
          }
        ],
        encounters: [
          {
            id: "drift-net-buoy",
            name: "Dead Buoy Cluster",
            description: "A buoy graveyard may hide sealed salvage crates.",
            difficulty: 0.39,
            success: { yieldDelta: 0.09, intelFlat: 2 },
            fail: { riskDelta: 0.06, matterPenalty: 320 }
          },
          {
            id: "drift-net-snag",
            name: "Cable Snag",
            description: "A snapped cable tangles your trawl frame.",
            difficulty: 0.4,
            success: { fireFlat: 12, intelFlat: 1 },
            fail: { riskDelta: 0.07, firePenalty: 10 }
          },
          {
            id: "drift-net-echo",
            name: "Echo Current",
            description: "A turbulent echo current can amplify pickup volume.",
            difficulty: 0.42,
            success: { yieldDelta: 0.11, intelFlat: 2 },
            fail: { riskDelta: 0.08, yieldDelta: -0.06 }
          }
        ],
        encounterPools: {
          stability: ["drift-net-buoy"],
          standard: ["drift-net-buoy", "drift-net-snag"],
          volatile: ["drift-net-snag", "drift-net-echo"],
          netline: ["drift-net-echo", "drift-net-buoy"]
        }
      },
      {
        id: "forager-run",
        name: "Forager Side Current",
        description: "A niche side-route tuned for intel haul and fast reset loops.",
        durationSeconds: 74,
        stageCount: 2,
        risk: 0.26,
        cost: { matter: 4100, fire: 52 },
        unlock: { type: "ascensionNodeCount", value: 6 },
        requiredNodes: ["expeditionKeystone"],
        purchaseIntelCost: 250,
        rewards: { matter: 6300, fire: 95, shards: 0, intel: 14 },
        stageVarianceRanges: {
          riskDelta: { min: -0.05, max: 0.055 },
          yieldDelta: { min: -0.07, max: 0.08 },
          speedMultiplier: { min: 0.93, max: 1.1 },
          intelFlat: { min: 1, max: 3 }
        },
        routeChoices: [
          {
            id: "shielded",
            name: "Shielded Conduits",
            description: "Skim safer side currents with lower haul throughput.",
            riskDelta: -0.09,
            yieldDelta: -0.12,
            speedMultiplier: 0.92,
            intelFlat: 2,
            encounterPool: "stability"
          },
          {
            id: "balanced",
            name: "Balanced Route",
            description: "Standard drift route with steady intel yield.",
            riskDelta: 0,
            yieldDelta: 0,
            speedMultiplier: 1,
            intelFlat: 1,
            encounterPool: "standard"
          },
          {
            id: "overclocked",
            name: "Overclocked Lanes",
            description: "Push hull flow for quicker extraction at higher risk.",
            riskDelta: 0.14,
            yieldDelta: 0.16,
            speedMultiplier: 1.14,
            intelFlat: -1,
            encounterPool: "volatile"
          },
          {
            id: "reconnaissance-hop",
            name: "Reconnaissance Hop",
            description: "Chart a bespoke scouting arc for high intel pull.",
            requiredNodes: ["cartographerSpindle"],
            riskDelta: -0.02,
            yieldDelta: 0.06,
            speedMultiplier: 1.08,
            intelFlat: 3,
            encounterPool: "reconnaissance"
          }
        ],
        encounters: [
          {
            id: "forager-signal-bloom",
            name: "Signal Bloom",
            description: "A burst of dormant telemetry can be harvested for intel.",
            difficulty: 0.43,
            success: { yieldDelta: 0.08, intelFlat: 3 },
            fail: { riskDelta: 0.06, intelFlat: -1 }
          },
          {
            id: "forager-scuttle-cache",
            name: "Scuttle Cache",
            description: "A stripped cargo pod might still carry useful fuel cells.",
            difficulty: 0.41,
            success: { fireFlat: 14, intelFlat: 1 },
            fail: { riskDelta: 0.05, matterPenalty: 420 }
          },
          {
            id: "forager-phantom-ledger",
            name: "Phantom Ledger",
            description: "A fragmented ledger can reveal profitable relay detours.",
            difficulty: 0.46,
            success: { yieldDelta: 0.1, intelFlat: 4 },
            fail: { riskDelta: 0.07, firePenalty: 16 }
          }
        ],
        encounterPools: {
          stability: ["forager-signal-bloom"],
          standard: ["forager-signal-bloom", "forager-scuttle-cache"],
          volatile: ["forager-scuttle-cache"],
          reconnaissance: ["forager-phantom-ledger", "forager-signal-bloom"]
        }
      },
      {
        id: "architect-run",
        name: "Architect Pressure Route",
        description: "High-pressure vaults with unstable extraction channels.",
        durationSeconds: 95,
        stageCount: 3,
        risk: 0.28,
        cost: { matter: 5200, fire: 60 },
        unlock: { type: "ascensionNodeCount", value: 7 },
        requiredNodes: ["expeditionKeystone", "cartographerSpindle"],
        purchaseIntelCost: 0,
        rewards: { matter: 9600, fire: 120, shards: 0, intel: 11 },
        stageVarianceRanges: {
          riskDelta: { min: -0.04, max: 0.05 },
          yieldDelta: { min: -0.06, max: 0.07 },
          speedMultiplier: { min: 0.94, max: 1.08 },
          intelFlat: { min: 0, max: 2 }
        },
        routeChoices: [
          {
            id: "shielded",
            name: "Shielded Conduits",
            description: "Prioritize pressure-safe valves over throughput.",
            riskDelta: -0.1,
            yieldDelta: -0.12,
            speedMultiplier: 0.9,
            intelFlat: 1,
            encounterPool: "stability"
          },
          {
            id: "balanced",
            name: "Balanced Route",
            description: "Standard pressure handling with mixed salvage output.",
            riskDelta: 0,
            yieldDelta: 0,
            speedMultiplier: 1,
            intelFlat: 0,
            encounterPool: "standard"
          },
          {
            id: "overclocked",
            name: "Overclocked Lanes",
            description: "Drive extraction turbines beyond safe envelopes.",
            riskDelta: 0.12,
            yieldDelta: 0.18,
            speedMultiplier: 1.12,
            intelFlat: 0,
            encounterPool: "volatile"
          },
          {
            id: "cartographer-cut",
            name: "Cartographer Cutthrough",
            description: "Exclusive branch: rune-mapped shortcuts across collapsed vaults.",
            requiredNodes: ["cartographerSpindle"],
            riskDelta: -0.04,
            yieldDelta: 0.08,
            speedMultiplier: 1.16,
            intelFlat: 2,
            encounterPool: "cartographer"
          }
        ],
        encounters: [
          {
            id: "fracture",
            name: "Pressure Fracture",
            description: "A wall fracture threatens the haul path.",
            difficulty: 0.42,
            success: { yieldDelta: 0.1, intelFlat: 2 },
            fail: { riskDelta: 0.08, yieldDelta: -0.08, firePenalty: 18 }
          },
          {
            id: "warden",
            name: "Warden Sweep",
            description: "Automata patrols force a route scramble.",
            difficulty: 0.48,
            success: { yieldDelta: 0.12, intelFlat: 2 },
            fail: { riskDelta: 0.07, matterPenalty: 520 }
          },
          {
            id: "survey-beacon",
            name: "Survey Beacon Archive",
            description: "A dormant survey beacon can reveal high-value vault lanes.",
            difficulty: 0.44,
            success: { yieldDelta: 0.1, intelFlat: 3 },
            fail: { riskDelta: 0.05, yieldDelta: -0.04 }
          }
        ],
        encounterPools: {
          stability: ["fracture"],
          standard: ["fracture", "warden"],
          volatile: ["warden"],
          cartographer: ["survey-beacon", "warden"]
        }
      },
      {
        id: "courier-run",
        name: "Courier Blacklane",
        description: "A paid sloop contract through sealed courier lanes and interception grids.",
        durationSeconds: 122,
        stageCount: 3,
        risk: 0.35,
        cost: { matter: 12000, fire: 165 },
        unlock: { type: "ascensionNodeCount", value: 11 },
        requiredNodes: ["expeditionKeystone", "cartographerSpindle"],
        requiredShip: "sloop",
        purchaseIntelCost: 2200,
        rewards: { matter: 24500, fire: 360, shards: 0, intel: 22 },
        stageVarianceRanges: {
          riskDelta: { min: -0.05, max: 0.06 },
          yieldDelta: { min: -0.08, max: 0.1 },
          speedMultiplier: { min: 0.92, max: 1.12 },
          intelFlat: { min: 1, max: 4 }
        },
        routeChoices: [
          {
            id: "shielded",
            name: "Shielded Conduits",
            description: "Prioritize stealth relays over hauling speed.",
            riskDelta: -0.11,
            yieldDelta: -0.13,
            speedMultiplier: 0.9,
            intelFlat: 2,
            encounterPool: "stability"
          },
          {
            id: "balanced",
            name: "Balanced Route",
            description: "Thread normal courier lanes with steady output.",
            riskDelta: 0,
            yieldDelta: 0,
            speedMultiplier: 1,
            intelFlat: 1,
            encounterPool: "standard"
          },
          {
            id: "overclocked",
            name: "Overclocked Lanes",
            description: "Run hot through contested checkpoints for bigger haul.",
            riskDelta: 0.15,
            yieldDelta: 0.24,
            speedMultiplier: 1.14,
            intelFlat: 0,
            encounterPool: "volatile"
          },
          {
            id: "courier-slit",
            name: "Courier Slit",
            description: "Use charted slit passages for high intel extraction.",
            requiredNodes: ["cartographerSpindle"],
            riskDelta: -0.01,
            yieldDelta: 0.12,
            speedMultiplier: 1.08,
            intelFlat: 4,
            encounterPool: "courier"
          }
        ],
        encounters: [
          {
            id: "courier-ward",
            name: "Courier Warden Sweep",
            description: "Dormant wardens scan your signature and tighten lanes.",
            difficulty: 0.52,
            success: { yieldDelta: 0.14, intelFlat: 4 },
            fail: { riskDelta: 0.1, matterPenalty: 1400 }
          },
          {
            id: "courier-cache",
            name: "Black Cache",
            description: "A smuggler cache can be cracked for elite fuel bundles.",
            difficulty: 0.49,
            success: { yieldDelta: 0.12, fireFlat: 46 },
            fail: { riskDelta: 0.09, firePenalty: 34 }
          },
          {
            id: "courier-ambush",
            name: "Interception Ambush",
            description: "An interception wing collapses your extraction corridor.",
            difficulty: 0.55,
            success: { yieldDelta: 0.17, intelFlat: 5 },
            fail: { riskDelta: 0.12, yieldDelta: -0.1, intelFlat: -2 }
          }
        ],
        encounterPools: {
          stability: ["courier-ward"],
          standard: ["courier-ward", "courier-cache"],
          volatile: ["courier-cache", "courier-ambush"],
          courier: ["courier-ambush", "courier-ward"]
        }
      },
      {
        id: "sovereign-run",
        name: "Sovereign Anomaly Rift",
        description: "A sovereign-tier descent into volatile arcane machinery.",
        durationSeconds: 140,
        stageCount: 4,
        risk: 0.38,
        cost: { matter: 16000, fire: 210 },
        unlock: { type: "ascensionNodeCount", value: 13 },
        requiredNodes: ["expeditionKeystone", "cartographerSpindle", "hazardSeals"],
        purchaseIntelCost: 0,
        rewards: { matter: 36000, fire: 460, shards: 0, intel: 21 },
        stageVarianceRanges: {
          riskDelta: { min: -0.05, max: 0.06 },
          yieldDelta: { min: -0.08, max: 0.09 },
          speedMultiplier: { min: 0.92, max: 1.1 },
          intelFlat: { min: 1, max: 3 }
        },
        routeChoices: [
          {
            id: "shielded",
            name: "Shielded Conduits",
            description: "Sacrifice throughput for calibrated containment.",
            riskDelta: -0.12,
            yieldDelta: -0.14,
            speedMultiplier: 0.88,
            intelFlat: 2,
            encounterPool: "stability"
          },
          {
            id: "balanced",
            name: "Balanced Route",
            description: "Neutral route through layered anomaly baffles.",
            riskDelta: 0,
            yieldDelta: 0,
            speedMultiplier: 1,
            intelFlat: 0,
            encounterPool: "standard"
          },
          {
            id: "overclocked",
            name: "Overclocked Lanes",
            description: "Maximum extraction through unstable rift seams.",
            riskDelta: 0.14,
            yieldDelta: 0.22,
            speedMultiplier: 1.14,
            intelFlat: 0,
            encounterPool: "volatile"
          },
          {
            id: "sealed-vault",
            name: "Sealed Vault Plunge",
            description: "Exclusive branch: hazard-proof descent into sovereign vault cores.",
            requiredNodes: ["hazardSeals"],
            riskDelta: -0.03,
            yieldDelta: 0.12,
            speedMultiplier: 0.98,
            intelFlat: 3,
            encounterPool: "sealed"
          },
          {
            id: "salvage-gambit",
            name: "Salvage Gambit",
            description: "Exclusive branch: shard siphon sweep through fracture wakes.",
            requiredNodes: ["salvageVats"],
            riskDelta: 0.08,
            yieldDelta: 0.28,
            speedMultiplier: 1.08,
            intelFlat: 1,
            encounterPool: "salvage"
          }
        ],
        encounters: [
          {
            id: "rift-storm",
            name: "Rift Storm",
            description: "Chaotic anomaly winds batter containment rigging.",
            difficulty: 0.55,
            success: { yieldDelta: 0.16, intelFlat: 4 },
            fail: { riskDelta: 0.11, yieldDelta: -0.12, matterPenalty: 1800, firePenalty: 50 }
          },
          {
            id: "void-gate",
            name: "Void Gate Calibration",
            description: "A broken gate can be stabilized for huge salvage.",
            difficulty: 0.5,
            success: { yieldDelta: 0.2, fireFlat: 40 },
            fail: { riskDelta: 0.1, intelFlat: -1, firePenalty: 30 }
          },
          {
            id: "vault-harmonics",
            name: "Vault Harmonics",
            description: "Sovereign vault harmonics can be tuned for amplified extraction.",
            difficulty: 0.53,
            success: { yieldDelta: 0.18, intelFlat: 4 },
            fail: { riskDelta: 0.08, matterPenalty: 1300 }
          },
          {
            id: "salvage-surge",
            name: "Salvage Surge",
            description: "A collapsing wake reveals concentrated shard debris.",
            difficulty: 0.58,
            success: { yieldDelta: 0.24, intelFlat: 5 },
            fail: { riskDelta: 0.12, intelFlat: -2 }
          }
        ],
        encounterPools: {
          stability: ["rift-storm"],
          standard: ["rift-storm", "void-gate"],
          volatile: ["void-gate", "rift-storm"],
          sealed: ["vault-harmonics", "rift-storm"],
          salvage: ["salvage-surge", "void-gate"]
        }
      },
      {
        id: "abyssal-run",
        name: "Abyssal Cartographer Descent",
        description: "A charted plunge through trench machinery and drowned archives.",
        durationSeconds: 180,
        stageCount: 5,
        risk: 0.46,
        cost: { matter: 38000, fire: 520 },
        unlock: { type: "ascensionNodeCount", value: 18 },
        requiredNodes: ["expeditionKeystone", "cartographerSpindle", "hazardSeals", "salvageVats"],
        requiredMapId: "map:abyssal-atlas",
        requiredShip: "brig",
        purchaseIntelCost: 0,
        rewards: { matter: 82000, fire: 980, shards: 1, intel: 34 },
        stageVarianceRanges: {
          riskDelta: { min: -0.06, max: 0.08 },
          yieldDelta: { min: -0.09, max: 0.12 },
          speedMultiplier: { min: 0.9, max: 1.12 },
          intelFlat: { min: 1, max: 4 }
        },
        routeChoices: [
          {
            id: "shielded",
            name: "Shielded Conduits",
            description: "Stabilize trench pressure at the cost of output.",
            riskDelta: -0.14,
            yieldDelta: -0.16,
            speedMultiplier: 0.86,
            intelFlat: 2,
            encounterPool: "stability"
          },
          {
            id: "balanced",
            name: "Balanced Route",
            description: "Maintain mixed pressure handling and salvage extraction.",
            riskDelta: 0,
            yieldDelta: 0,
            speedMultiplier: 1,
            intelFlat: 0,
            encounterPool: "standard"
          },
          {
            id: "overclocked",
            name: "Overclocked Lanes",
            description: "Run max thrust through unstable trench corridors.",
            riskDelta: 0.16,
            yieldDelta: 0.26,
            speedMultiplier: 1.16,
            intelFlat: 0,
            encounterPool: "volatile"
          },
          {
            id: "charted-descent",
            name: "Charted Descent",
            description: "Follow atlas markings to archived pressure vaults.",
            requiredNodes: ["cartographerSpindle"],
            riskDelta: -0.02,
            yieldDelta: 0.14,
            speedMultiplier: 1.06,
            intelFlat: 4,
            encounterPool: "charted"
          },
          {
            id: "abyssal-hunt",
            name: "Abyssal Hunt",
            description: "Commit to deep trawl lanes for extreme salvage volume.",
            requiredNodes: ["salvageVats"],
            riskDelta: 0.1,
            yieldDelta: 0.3,
            speedMultiplier: 1.09,
            intelFlat: 2,
            encounterPool: "abyssal-hunt"
          }
        ],
        encounters: [
          {
            id: "pressure-maw",
            name: "Pressure Maw",
            description: "A trench maw opens and distorts your haul corridor.",
            difficulty: 0.6,
            success: { yieldDelta: 0.2, intelFlat: 5 },
            fail: { riskDelta: 0.12, matterPenalty: 3200, firePenalty: 90 }
          },
          {
            id: "gravitic-spindle",
            name: "Gravitic Spindle",
            description: "A collapsed spindle can be spun up for efficient extraction.",
            difficulty: 0.57,
            success: { yieldDelta: 0.18, fireFlat: 70 },
            fail: { riskDelta: 0.09, intelFlat: -2, firePenalty: 60 }
          },
          {
            id: "drowned-archive",
            name: "Drowned Archive",
            description: "Ancient archive stacks may contain sovereign guidance sigils.",
            difficulty: 0.62,
            success: { yieldDelta: 0.22, intelFlat: 6 },
            fail: { riskDelta: 0.14, matterPenalty: 3800 }
          },
          {
            id: "trench-locust",
            name: "Trench Locust Swarm",
            description: "Reactive shard-locusts chew through rigging during harvest.",
            difficulty: 0.6,
            success: { yieldDelta: 0.2, intelFlat: 4 },
            fail: { riskDelta: 0.11, yieldDelta: -0.13 }
          }
        ],
        encounterPools: {
          stability: ["gravitic-spindle"],
          standard: ["pressure-maw", "gravitic-spindle"],
          volatile: ["pressure-maw", "drowned-archive"],
          charted: ["drowned-archive", "gravitic-spindle"],
          "abyssal-hunt": ["trench-locust", "pressure-maw"]
        }
      },
      {
        id: "sunken-registry-run",
        name: "Sunken Registry Armature",
        description: "A command-tier campaign through registry cores and collapse fronts.",
        durationSeconds: 230,
        stageCount: 6,
        risk: 0.54,
        cost: { matter: 98000, fire: 1450 },
        unlock: { type: "ascensionNodeCount", value: 26 },
        requiredNodes: ["expeditionKeystone", "cartographerSpindle", "hazardSeals", "salvageVats"],
        requiredMapId: "map:sunken-registry",
        requiredShip: "galleon",
        purchaseIntelCost: 0,
        rewards: { matter: 210000, fire: 2600, shards: 2, intel: 62 },
        stageVarianceRanges: {
          riskDelta: { min: -0.07, max: 0.1 },
          yieldDelta: { min: -0.11, max: 0.16 },
          speedMultiplier: { min: 0.88, max: 1.14 },
          intelFlat: { min: 2, max: 6 }
        },
        routeChoices: [
          {
            id: "shielded",
            name: "Shielded Conduits",
            description: "Fortify command channels for survivability.",
            riskDelta: -0.16,
            yieldDelta: -0.2,
            speedMultiplier: 0.84,
            intelFlat: 3,
            encounterPool: "stability"
          },
          {
            id: "balanced",
            name: "Balanced Route",
            description: "Standardized pacing through command and registry lanes.",
            riskDelta: 0,
            yieldDelta: 0,
            speedMultiplier: 1,
            intelFlat: 0,
            encounterPool: "standard"
          },
          {
            id: "overclocked",
            name: "Overclocked Lanes",
            description: "Force full extraction on unstable command arteries.",
            riskDelta: 0.2,
            yieldDelta: 0.34,
            speedMultiplier: 1.18,
            intelFlat: 0,
            encounterPool: "volatile"
          },
          {
            id: "command-lattice",
            name: "Command Lattice",
            description: "Leverage hazard seals to tap old command harmonics.",
            requiredNodes: ["hazardSeals"],
            riskDelta: 0.02,
            yieldDelta: 0.2,
            speedMultiplier: 1.05,
            intelFlat: 5,
            encounterPool: "command"
          },
          {
            id: "registry-thread",
            name: "Registry Thread",
            description: "Thread salvage vats through registry indexing cores.",
            requiredNodes: ["salvageVats"],
            riskDelta: 0.04,
            yieldDelta: 0.24,
            speedMultiplier: 1.04,
            intelFlat: 5,
            encounterPool: "registry"
          },
          {
            id: "cataclysm-breach",
            name: "Cataclysm Breach",
            description: "Breach collapse fronts for peak salvage at severe volatility.",
            requiredNodes: ["hazardSeals", "salvageVats"],
            riskDelta: 0.26,
            yieldDelta: 0.42,
            speedMultiplier: 1.12,
            intelFlat: 2,
            encounterPool: "cataclysm"
          }
        ],
        encounters: [
          {
            id: "command-wardens",
            name: "Command Wardens",
            description: "Dormant sovereign wardens reactivate around your wake.",
            difficulty: 0.66,
            success: { yieldDelta: 0.24, intelFlat: 7 },
            fail: { riskDelta: 0.16, matterPenalty: 7800, firePenalty: 180 }
          },
          {
            id: "registry-lock",
            name: "Registry Lock",
            description: "A hard registry lock can expose rich command records.",
            difficulty: 0.64,
            success: { yieldDelta: 0.22, intelFlat: 8 },
            fail: { riskDelta: 0.14, intelFlat: -3, firePenalty: 150 }
          },
          {
            id: "collapse-fathom",
            name: "Collapse Fathom",
            description: "A collapse wave tears through the lane behind your hull.",
            difficulty: 0.7,
            success: { yieldDelta: 0.3, fireFlat: 160 },
            fail: { riskDelta: 0.2, yieldDelta: -0.2, matterPenalty: 12000 }
          },
          {
            id: "sovereign-aegis",
            name: "Sovereign Aegis",
            description: "A sealed aegis can be repurposed into extraction shielding.",
            difficulty: 0.68,
            success: { yieldDelta: 0.26, intelFlat: 9 },
            fail: { riskDelta: 0.18, matterPenalty: 9000 }
          },
          {
            id: "titan-remnant",
            name: "Titan Remnant",
            description: "A titan remnant stirs and destabilizes the entire grid.",
            difficulty: 0.72,
            success: { yieldDelta: 0.34, intelFlat: 8 },
            fail: { riskDelta: 0.22, firePenalty: 220 }
          }
        ],
        encounterPools: {
          stability: ["registry-lock"],
          standard: ["command-wardens", "registry-lock"],
          volatile: ["collapse-fathom", "command-wardens"],
          command: ["sovereign-aegis", "command-wardens"],
          registry: ["registry-lock", "sovereign-aegis"],
          cataclysm: ["titan-remnant", "collapse-fathom"]
        }
      }
    ]
  },
  riftDelve: {
    unlockNodeId: "riftDelveKeystone",
    inventorySlots: 6,
    grid: {
      width: 15,
      height: 15,
      stepMs: 180
    },
    offlineProgressMultiplier: 0.45,
    depthScaling: {
      lockTierEveryDescend: 1,
      mobPowerPerDescend: 0.1,
      rewardPerDescend: 0.12
    },
    combat: {
      basePower: 1,
      toolPower: {
        dagger: 2,
        axe: 3,
        pickaxe: 2
      }
    },
    roomOrder: ["start-room", "quarry-room", "forge-room", "descend-room"],
    itemDefs: {
      dagger: {
        id: "dagger",
        name: "Rust Dagger",
        type: "tool",
        toolTag: "dagger",
        maxStack: 1
      },
      axe: {
        id: "axe",
        name: "Woodcutter Axe",
        type: "tool",
        toolTag: "axe",
        maxStack: 1
      },
      pickaxe: {
        id: "pickaxe",
        name: "Miner Pickaxe",
        type: "tool",
        toolTag: "pickaxe",
        maxStack: 1
      },
      wood: {
        id: "wood",
        name: "Wood",
        type: "material",
        maxStack: 99
      },
      stone: {
        id: "stone",
        name: "Stone",
        type: "material",
        maxStack: 99
      },
      keyWood: {
        id: "keyWood",
        name: "Wood Key",
        type: "key",
        unlockTags: ["wood", "timber"],
        maxStack: 20
      },
      keyStone: {
        id: "keyStone",
        name: "Stone Key",
        type: "key",
        unlockTags: ["stone", "ore", "rift"],
        maxStack: 20
      }
    },
    gatherNodes: {
      tree: {
        id: "tree",
        name: "Tree",
        requiredTool: "axe",
        yieldItemId: "wood",
        yieldCount: 2,
        baseCharges: 4
      },
      rocks: {
        id: "rocks",
        name: "Rocks",
        requiredTool: "pickaxe",
        yieldItemId: "stone",
        yieldCount: 2,
        baseCharges: 4
      }
    },
    mobDefs: {
      "root-scrambler": {
        id: "root-scrambler",
        name: "Root Scrambler",
        basePower: 4,
        failPenalty: { matter: 35, fire: 0 },
        drops: [
          { itemId: "wood", count: 2 }
        ]
      },
      "quarry-mite": {
        id: "quarry-mite",
        name: "Quarry Mite",
        basePower: 6,
        failPenalty: { matter: 60, fire: 1 },
        drops: [
          { itemId: "stone", count: 2 },
          { itemId: "wood", count: 1 }
        ]
      }
    },
    chestDefs: {
      "workbench-cache": {
        id: "workbench-cache",
        name: "Workbench Cache",
        loot: [
          { itemId: "wood", count: 2 }
        ]
      },
      "quarry-lockbox": {
        id: "quarry-lockbox",
        name: "Quarry Lockbox",
        loot: [
          { itemId: "stone", count: 2 },
          { itemId: "keyWood", count: 1 }
        ]
      }
    },
    craftingRecipes: [
      {
        id: "craft-wood-key",
        name: "Wood Key",
        costs: [
          { itemId: "wood", count: 3 }
        ],
        output: { itemId: "keyWood", count: 1 }
      },
      {
        id: "craft-stone-key",
        name: "Stone Key",
        costs: [
          { itemId: "wood", count: 2 },
          { itemId: "stone", count: 3 }
        ],
        output: { itemId: "keyStone", count: 1 }
      }
    ],
    roomTemplates: {
      "start-room": {
        id: "start-room",
        name: "Threshold Workshop",
        description: "A square chamber with four sealed doors and a rough workbench.",
        special: {
          type: "crafting",
          name: "Workbench"
        },
        floorItems: ["dagger", "axe"],
        gatherNodes: ["tree"],
        mobs: ["root-scrambler"],
        chests: ["workbench-cache"]
      },
      "quarry-room": {
        id: "quarry-room",
        name: "Shale Quarry",
        description: "Broken quarry stones and old supply hooks line the walls.",
        floorItems: ["pickaxe"],
        gatherNodes: ["rocks"],
        mobs: ["quarry-mite"],
        chests: ["quarry-lockbox"]
      },
      "forge-room": {
        id: "forge-room",
        name: "Echo Forge",
        description: "An old forge crackles with unstable key-smithing sparks.",
        floorItems: [],
        gatherNodes: ["rocks", "tree"],
        mobs: ["quarry-mite", "root-scrambler"],
        chests: ["quarry-lockbox"]
      },
      "descend-room": {
        id: "descend-room",
        name: "Descend Chamber",
        description: "A black hole pulses at the center of this silent room.",
        special: {
          type: "descend",
          name: "Black Hole"
        },
        floorItems: [],
        gatherNodes: [],
        mobs: [],
        chests: []
      }
    },
    doorGraph: {
      "start-room": {
        north: { target: "quarry-room", lockTag: "wood", blocked: false },
        east: { target: null, lockTag: "timber", blocked: true },
        south: { target: null, lockTag: "stone", blocked: true },
        west: { target: null, lockTag: "ore", blocked: true }
      },
      "quarry-room": {
        north: { target: "forge-room", lockTag: "stone", blocked: false },
        east: { target: null, lockTag: "rift", blocked: true },
        south: { target: "start-room", lockTag: null, blocked: false },
        west: { target: null, lockTag: "timber", blocked: true }
      },
      "forge-room": {
        north: { target: "descend-room", lockTag: "rift", blocked: false },
        east: { target: null, lockTag: "rift", blocked: true },
        south: { target: "quarry-room", lockTag: null, blocked: false },
        west: { target: null, lockTag: "ore", blocked: true }
      },
      "descend-room": {
        north: { target: null, lockTag: "rift", blocked: true },
        east: { target: null, lockTag: "rift", blocked: true },
        south: { target: "forge-room", lockTag: null, blocked: false },
        west: { target: null, lockTag: "rift", blocked: true }
      }
    },
    rewards: {
      descendBase: {
        matter: 1800,
        fire: 26,
        shards: 1,
        relics: 1
      }
    }
  },
  upgradePower: 10,
  upgrades: {
    kineticGloves: {
      id: "kineticGloves",
      name: "Kinetic Gloves",
      description: "+0.08 Matter per click",
      costResource: "matter",
      maxTier: 999,
      baseCost: 90,
      costCurve: { autoBalance: false }
    },
    alloyIntake: {
      id: "alloyIntake",
      name: "Alloy Intake",
      description: "+0.25% Matter production",
      costResource: "matter",
      maxTier: 999,
      baseCost: 450
    },
    emberCatalyst: {
      id: "emberCatalyst",
      name: "Ember Catalyst",
      description: "+0.2% Fire production",
      costResource: "matter",
      maxTier: 999,
      baseCost: 25
    },
    thermalLens: {
      id: "thermalLens",
      name: "Thermal Lens",
      description: "+0.03 Fire per conversion",
      costResource: "matter",
      maxTier: 999,
      baseCost: 60
    },
    vacuumSeals: {
      id: "vacuumSeals",
      name: "Vacuum Seals",
      description: "+0.25% Matter production",
      costResource: "matter",
      maxTier: 999,
      baseCost: 1200
    },
    fluxPistons: {
      id: "fluxPistons",
      name: "Flux Pistons",
      description: "-0.1% generator cost growth",
      costResource: "matter",
      maxTier: 999,
      baseCost: 2600
    },
    cinderThreads: {
      id: "cinderThreads",
      name: "Cinder Threads",
      description: "+0.05 Fire per conversion",
      costResource: "matter",
      maxTier: 999,
      baseCost: 85
    },
    pulseCoil: {
      id: "pulseCoil",
      name: "Pulse Coil",
      description: "+0.7 Matter per click",
      costResource: "matter",
      maxTier: 999,
      baseCost: 1800
    },
    thermalLattice: {
      id: "thermalLattice",
      name: "Thermal Lattice",
      description: "+0.3% Fire production",
      costResource: "matter",
      maxTier: 999,
      baseCost: 140
    },
    stellarConveyor: {
      id: "stellarConveyor",
      name: "Stellar Conveyor",
      description: "+0.5% offline efficiency",
      costResource: "matter",
      maxTier: 999,
      baseCost: 120
    },
    mercuryRegulators: {
      id: "mercuryRegulators",
      name: "Mercury Regulators",
      description: "-0.3% conversion cost",
      costResource: "matter",
      maxTier: 999,
      baseCost: 2400
    },
    obsidianCore: {
      id: "obsidianCore",
      name: "Obsidian Core",
      description: "+0.4% shard gain",
      costResource: "matter",
      maxTier: 999,
      baseCost: 200
    },
    arcSpanners: {
      id: "arcSpanners",
      name: "Arc Spanners",
      description: "-0.3% research cost",
      costResource: "matter",
      maxTier: 999,
      baseCost: 180
    },
    glassFoundry: {
      id: "glassFoundry",
      name: "Glass Foundry",
      description: "+0.1% all production",
      costResource: "matter",
      maxTier: 999,
      baseCost: 4000
    },
    runicGrip: {
      id: "runicGrip",
      name: "Runic Grip",
      description: "+0.35% click power",
      costResource: "matter",
      maxTier: 999,
      baseCost: 280
    },
    emberEcho: {
      id: "emberEcho",
      name: "Ember Echo",
      description: "+0.01 Fire on click",
      costResource: "matter",
      maxTier: 999,
      baseCost: 240
    },
    signalFocusing: {
      id: "signalFocusing",
      name: "Signal Focusing",
      description: "+0.3% Furnace output",
      costResource: "matter",
      maxTier: 999,
      baseCost: 520
    },
    phaseBaffles: {
      id: "phaseBaffles",
      name: "Phase Baffles",
      description: "+0.3% Condenser output",
      costResource: "matter",
      maxTier: 999,
      baseCost: 760
    },
    prismaticVeil: {
      id: "prismaticVeil",
      name: "Prismatic Veil",
      description: "+0.4% Prism output",
      costResource: "matter",
      maxTier: 999,
      baseCost: 980
    },
    catalystCoil: {
      id: "catalystCoil",
      name: "Catalyst Coil",
      description: "+0.15% conversion yield",
      costResource: "matter",
      maxTier: 999,
      baseCost: 1600
    },
    isochronSprings: {
      id: "isochronSprings",
      name: "Isochron Springs",
      description: "-0.05 Matter conversion cost",
      costResource: "matter",
      maxTier: 999,
      baseCost: 1500
    },
    snapCircuitry: {
      id: "snapCircuitry",
      name: "Snap Circuitry",
      description: "+0.05% click crit chance",
      costResource: "matter",
      maxTier: 999,
      baseCost: 1200
    },
    riftLattice: {
      id: "riftLattice",
      name: "Rift Lattice",
      description: "+0.2% click crit power",
      costResource: "matter",
      maxTier: 999,
      baseCost: 1500
    },
    refluxMatrix: {
      id: "refluxMatrix",
      name: "Reflux Matrix",
      description: "Refund 0.05% conversion cost",
      costResource: "matter",
      maxTier: 999,
      baseCost: 1800
    },
    twinFlux: {
      id: "twinFlux",
      name: "Twin Flux",
      description: "+0.1% Matter and Fire production",
      costResource: "matter",
      maxTier: 999,
      baseCost: 2100
    },
    alchemyWeave: {
      id: "alchemyWeave",
      name: "Alchemy Weave",
      description: "+0.08% all production and +0.05% click power",
      costResource: "matter",
      maxTier: 999,
      baseCost: 3200
    },
    shardSiphon: {
      id: "shardSiphon",
      name: "Shard Siphon",
      description: "+0.2% shard gain",
      costResource: "matter",
      maxTier: 999,
      baseCost: 2400
    },
    scholarVane: {
      id: "scholarVane",
      name: "Scholar Vane",
      description: "-0.1% research cost",
      costResource: "matter",
      maxTier: 999,
      baseCost: 2600
    },
    fluxRelay: {
      id: "fluxRelay",
      name: "Flux Relay",
      description: "-0.07% generator cost growth",
      costResource: "matter",
      maxTier: 999,
      baseCost: 3600
    }
  },
  research: {
    arcaneThermodynamics: {
      id: "arcaneThermodynamics",
      name: "Arcane Thermodynamics",
      description: "+3% Matter production",
      maxLevel: 5,
      baseCost: 12,
      costGrowth: 1.6,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 1000 }
    },
    crystalLattice: {
      id: "crystalLattice",
      name: "Crystal Lattice",
      description: "+4% Fire production",
      maxLevel: 4,
      baseCost: 20,
      costGrowth: 1.65,
      costResource: "fire",
      unlock: { type: "fireSeen", value: 25 }
    },
    shardTheory: {
      id: "shardTheory",
      name: "Shard Theory",
      description: "+2% shard gain",
      maxLevel: 6,
      baseCost: 35,
      costGrowth: 1.75,
      costResource: "fire",
      unlock: { type: "ascensions", value: 1 }
    },
    fieldResonance: {
      id: "fieldResonance",
      name: "Field Resonance",
      description: "+2% Matter production",
      maxLevel: 5,
      baseCost: 14,
      costGrowth: 1.6,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 2200 }
    },
    ignitionSpiral: {
      id: "ignitionSpiral",
      name: "Ignition Spiral",
      description: "+3% Fire production",
      maxLevel: 4,
      baseCost: 22,
      costGrowth: 1.7,
      costResource: "fire",
      unlock: { type: "fireSeen", value: 45 }
    },
    metallurgicMemory: {
      id: "metallurgicMemory",
      name: "Metallurgic Memory",
      description: "Conversion cost -2%",
      maxLevel: 4,
      baseCost: 18,
      costGrowth: 1.65,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 2500 }
    },
    shardOptics: {
      id: "shardOptics",
      name: "Shard Optics",
      description: "+2% shard gain",
      maxLevel: 5,
      baseCost: 30,
      costGrowth: 1.72,
      costResource: "fire",
      unlock: { type: "ascensions", value: 1 }
    },
    continuumTuning: {
      id: "continuumTuning",
      name: "Continuum Tuning",
      description: "+4% offline efficiency",
      maxLevel: 3,
      baseCost: 24,
      costGrowth: 1.68,
      costResource: "fire",
      unlock: { type: "fireSeen", value: 55 }
    },
    atomicLattice: {
      id: "atomicLattice",
      name: "Atomic Lattice",
      description: "+2% all production",
      maxLevel: 4,
      baseCost: 26,
      costGrowth: 1.7,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 3500 }
    },
    cryoCalibration: {
      id: "cryoCalibration",
      name: "Cryo Calibration",
      description: "-0.4% generator cost growth",
      maxLevel: 4,
      baseCost: 28,
      costGrowth: 1.72,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 3800 }
    },
    ambientCharge: {
      id: "ambientCharge",
      name: "Ambient Charge",
      description: "+1.5 Matter per click",
      maxLevel: 4,
      baseCost: 20,
      costGrowth: 1.64,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 2800 }
    },
    harmonicForge: {
      id: "harmonicForge",
      name: "Harmonic Forge",
      description: "+1.5% all production",
      maxLevel: 5,
      baseCost: 16,
      costGrowth: 1.6,
      costResource: "fire",
      unlock: { type: "fireSeen", value: 70 }
    },
    transcendentSchema: {
      id: "transcendentSchema",
      name: "Transcendent Schema",
      description: "+6% shard gain",
      maxLevel: 1,
      baseCost: 80,
      costGrowth: 1.9,
      costResource: "fire",
      unlock: { type: "ascensions", value: 1 }
    },
    kineticAmplifier: {
      id: "kineticAmplifier",
      name: "Kinetic Amplifier",
      description: "+6% click power",
      maxLevel: 4,
      baseCost: 18,
      costGrowth: 1.6,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 800 }
    },
    furnaceTuning: {
      id: "furnaceTuning",
      name: "Furnace Tuning",
      description: "+5% Furnace output",
      maxLevel: 4,
      baseCost: 20,
      costGrowth: 1.62,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 1400 }
    },
    condenserTuning: {
      id: "condenserTuning",
      name: "Condenser Tuning",
      description: "+5% Condenser output",
      maxLevel: 4,
      baseCost: 24,
      costGrowth: 1.64,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 2200 }
    },
    prismLore: {
      id: "prismLore",
      name: "Prism Lore",
      description: "+6% Prism output",
      maxLevel: 4,
      baseCost: 26,
      costGrowth: 1.66,
      costResource: "fire",
      unlock: { type: "fireSeen", value: 70 }
    },
    yieldCatalysis: {
      id: "yieldCatalysis",
      name: "Yield Catalysis",
      description: "+4% conversion yield",
      maxLevel: 5,
      baseCost: 28,
      costGrowth: 1.65,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 2000 }
    },
    refundTheory: {
      id: "refundTheory",
      name: "Refund Theory",
      description: "Refund 2% conversion cost",
      maxLevel: 4,
      baseCost: 30,
      costGrowth: 1.66,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 2600 }
    },
    conversionAnchors: {
      id: "conversionAnchors",
      name: "Conversion Anchors",
      description: "-3 Matter conversion cost",
      maxLevel: 4,
      baseCost: 26,
      costGrowth: 1.63,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 2400 }
    },
    criticalStudies: {
      id: "criticalStudies",
      name: "Critical Studies",
      description: "+1% click crit chance",
      maxLevel: 4,
      baseCost: 32,
      costGrowth: 1.67,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 3000 }
    },
    criticalFocus: {
      id: "criticalFocus",
      name: "Critical Focus",
      description: "+10% click crit power",
      maxLevel: 4,
      baseCost: 38,
      costGrowth: 1.7,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 3600 }
    },
    emberClicks: {
      id: "emberClicks",
      name: "Ember Clicks",
      description: "+0.2 Fire on click",
      maxLevel: 5,
      baseCost: 22,
      costGrowth: 1.6,
      costResource: "fire",
      unlock: { type: "fireSeen", value: 60 }
    },
    transmuteCadence: {
      id: "transmuteCadence",
      name: "Transmute Cadence",
      description: "+0.8 Matter per click",
      maxLevel: 5,
      baseCost: 34,
      costGrowth: 1.65,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 3200 }
    },
    twinFlow: {
      id: "twinFlow",
      name: "Twin Flow",
      description: "+2% Matter and Fire production",
      maxLevel: 4,
      baseCost: 36,
      costGrowth: 1.68,
      costResource: "fire",
      unlock: { type: "fireSeen", value: 90 }
    },
    catalystBleed: {
      id: "catalystBleed",
      name: "Catalyst Bleed",
      description: "+0.2 Fire per conversion",
      maxLevel: 4,
      baseCost: 30,
      costGrowth: 1.64,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 2800 }
    },
    matrixDamping: {
      id: "matrixDamping",
      name: "Matrix Damping",
      description: "-1.5% generator cost growth",
      maxLevel: 4,
      baseCost: 40,
      costGrowth: 1.7,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 3800 }
    },
    shardFractal: {
      id: "shardFractal",
      name: "Shard Fractal",
      description: "+3% shard gain",
      maxLevel: 3,
      baseCost: 60,
      costGrowth: 1.75,
      costResource: "fire",
      unlock: { type: "ascensions", value: 1 }
    }
  }
};
