export function recomputePerks({ state, balance, ascendNodes }) {
  const clampMin = (value, min) => (value < min ? min : value);
  const upgradePower = balance?.upgradePower ?? 1;
  const perks = {
    productionMultiplier: 1,
    matterRateMultiplier: 1,
    fireRateMultiplier: 1,
    clickMatterBonus: 0,
    clickMultiplier: 1,
    clickCritChance: 0,
    clickCritMultiplier: 1.5,
    clickFireBonus: 0,
    conversionFireBonus: 0,
    conversionYieldMultiplier: 1,
    conversionCostFlatReduction: 0,
    conversionRefundFraction: 0,
    prestigeGainMultiplier: 1,
    generatorCostGrowthMultiplier: 1,
    furnaceRateMultiplier: 1,
    condenserRateMultiplier: 1,
    prismRateMultiplier: 1,
    conversionCostMultiplier: 1,
    offlineEfficiencyMultiplier: 1,
    researchCostMultiplier: 1,
    expeditionYieldMultiplier: 1,
    expeditionSpeedMultiplier: 1,
    expeditionRiskMitigation: 0,
    expeditionShardBonus: 0,
    expeditionIntelMultiplier: 1,
    partTierCapBonus: 0,
    facilityMaxLevelBonus: 0,
    rewardsChestCapacityBonus: 0
  };

  const kineticGloves = (state.upgrades.kineticGloves || 0) * upgradePower;
  if (kineticGloves > 0) {
    perks.clickMatterBonus += kineticGloves * 0.08;
  }
  const alloyIntake = (state.upgrades.alloyIntake || 0) * upgradePower;
  if (alloyIntake > 0) {
    perks.matterRateMultiplier *= Math.pow(1.0025, alloyIntake);
  }
  const emberCatalyst = (state.upgrades.emberCatalyst || 0) * upgradePower;
  if (emberCatalyst > 0) {
    perks.fireRateMultiplier *= Math.pow(1.002, emberCatalyst);
  }
  const thermalLens = (state.upgrades.thermalLens || 0) * upgradePower;
  if (thermalLens > 0) {
    perks.conversionFireBonus += thermalLens * 0.03;
  }
  const vacuumSeals = (state.upgrades.vacuumSeals || 0) * upgradePower;
  if (vacuumSeals > 0) {
    perks.matterRateMultiplier *= Math.pow(1.0025, vacuumSeals);
  }
  const fluxPistons = (state.upgrades.fluxPistons || 0) * upgradePower;
  if (fluxPistons > 0) {
    perks.generatorCostGrowthMultiplier *= Math.pow(0.999, fluxPistons);
  }
  const cinderThreads = (state.upgrades.cinderThreads || 0) * upgradePower;
  if (cinderThreads > 0) {
    perks.conversionFireBonus += cinderThreads * 0.05;
  }
  const pulseCoil = (state.upgrades.pulseCoil || 0) * upgradePower;
  if (pulseCoil > 0) {
    perks.clickMatterBonus += pulseCoil * 0.7;
  }
  const thermalLattice = (state.upgrades.thermalLattice || 0) * upgradePower;
  if (thermalLattice > 0) {
    perks.fireRateMultiplier *= Math.pow(1.003, thermalLattice);
  }
  const stellarConveyor = (state.upgrades.stellarConveyor || 0) * upgradePower;
  if (stellarConveyor > 0) {
    perks.offlineEfficiencyMultiplier *= Math.pow(1.005, stellarConveyor);
  }
  const mercuryRegulators = (state.upgrades.mercuryRegulators || 0) * upgradePower;
  if (mercuryRegulators > 0) {
    perks.conversionCostMultiplier *= Math.pow(0.997, mercuryRegulators);
  }
  const obsidianCore = (state.upgrades.obsidianCore || 0) * upgradePower;
  if (obsidianCore > 0) {
    perks.prestigeGainMultiplier *= Math.pow(1.004, obsidianCore);
  }
  const arcSpanners = (state.upgrades.arcSpanners || 0) * upgradePower;
  if (arcSpanners > 0) {
    perks.researchCostMultiplier *= Math.pow(0.997, arcSpanners);
  }
  const glassFoundry = (state.upgrades.glassFoundry || 0) * upgradePower;
  if (glassFoundry > 0) {
    perks.productionMultiplier *= Math.pow(1.001, glassFoundry);
  }

  const runicGrip = (state.upgrades.runicGrip || 0) * upgradePower;
  if (runicGrip > 0) {
    perks.clickMultiplier *= Math.pow(1.0035, runicGrip);
  }
  const emberEcho = (state.upgrades.emberEcho || 0) * upgradePower;
  if (emberEcho > 0) {
    perks.clickFireBonus += emberEcho * 0.01;
  }
  const signalFocusing = (state.upgrades.signalFocusing || 0) * upgradePower;
  if (signalFocusing > 0) {
    perks.furnaceRateMultiplier *= Math.pow(1.003, signalFocusing);
  }
  const phaseBaffles = (state.upgrades.phaseBaffles || 0) * upgradePower;
  if (phaseBaffles > 0) {
    perks.condenserRateMultiplier *= Math.pow(1.003, phaseBaffles);
  }
  const prismaticVeil = (state.upgrades.prismaticVeil || 0) * upgradePower;
  if (prismaticVeil > 0) {
    perks.prismRateMultiplier *= Math.pow(1.004, prismaticVeil);
  }
  const catalystCoil = (state.upgrades.catalystCoil || 0) * upgradePower;
  if (catalystCoil > 0) {
    perks.conversionYieldMultiplier *= Math.pow(1.0015, catalystCoil);
  }
  const isochronSprings = (state.upgrades.isochronSprings || 0) * upgradePower;
  if (isochronSprings > 0) {
    perks.conversionCostFlatReduction += isochronSprings * 0.05;
  }
  const snapCircuitry = (state.upgrades.snapCircuitry || 0) * upgradePower;
  if (snapCircuitry > 0) {
    perks.clickCritChance += snapCircuitry * 0.0005;
  }
  const riftLattice = (state.upgrades.riftLattice || 0) * upgradePower;
  if (riftLattice > 0) {
    perks.clickCritMultiplier += riftLattice * 0.002;
  }
  const refluxMatrix = (state.upgrades.refluxMatrix || 0) * upgradePower;
  if (refluxMatrix > 0) {
    perks.conversionRefundFraction += refluxMatrix * 0.0005;
  }
  const twinFlux = (state.upgrades.twinFlux || 0) * upgradePower;
  if (twinFlux > 0) {
    const fluxMultiplier = Math.pow(1.001, twinFlux);
    perks.matterRateMultiplier *= fluxMultiplier;
    perks.fireRateMultiplier *= fluxMultiplier;
  }
  const alchemyWeave = (state.upgrades.alchemyWeave || 0) * upgradePower;
  if (alchemyWeave > 0) {
    perks.productionMultiplier *= Math.pow(1.0008, alchemyWeave);
    perks.clickMultiplier *= Math.pow(1.0005, alchemyWeave);
  }
  const shardSiphon = (state.upgrades.shardSiphon || 0) * upgradePower;
  if (shardSiphon > 0) {
    perks.prestigeGainMultiplier *= Math.pow(1.002, shardSiphon);
  }
  const scholarVane = (state.upgrades.scholarVane || 0) * upgradePower;
  if (scholarVane > 0) {
    perks.researchCostMultiplier *= Math.pow(0.999, scholarVane);
  }
  const fluxRelay = (state.upgrades.fluxRelay || 0) * upgradePower;
  if (fluxRelay > 0) {
    perks.generatorCostGrowthMultiplier *= Math.pow(0.9993, fluxRelay);
  }

  const thermoLevel = state.research.arcaneThermodynamics || 0;
  if (thermoLevel > 0) {
    perks.matterRateMultiplier *= 1 + thermoLevel * 0.03;
  }

  const latticeLevel = state.research.crystalLattice || 0;
  if (latticeLevel > 0) {
    perks.fireRateMultiplier *= 1 + latticeLevel * 0.04;
  }

  const shardTheoryLevel = state.research.shardTheory || 0;
  if (shardTheoryLevel > 0) {
    perks.prestigeGainMultiplier *= 1 + shardTheoryLevel * 0.02;
  }

  const fieldResonance = state.research.fieldResonance || 0;
  if (fieldResonance > 0) {
    perks.matterRateMultiplier *= 1 + fieldResonance * 0.02;
  }

  const ignitionSpiral = state.research.ignitionSpiral || 0;
  if (ignitionSpiral > 0) {
    perks.fireRateMultiplier *= 1 + ignitionSpiral * 0.03;
  }

  const metallurgicMemory = state.research.metallurgicMemory || 0;
  if (metallurgicMemory > 0) {
    perks.conversionCostMultiplier *= 1 - metallurgicMemory * 0.02;
  }

  const shardOptics = state.research.shardOptics || 0;
  if (shardOptics > 0) {
    perks.prestigeGainMultiplier *= 1 + shardOptics * 0.015;
  }

  const continuumTuning = state.research.continuumTuning || 0;
  if (continuumTuning > 0) {
    perks.offlineEfficiencyMultiplier *= 1 + continuumTuning * 0.04;
  }

  const atomicLattice = state.research.atomicLattice || 0;
  if (atomicLattice > 0) {
    perks.productionMultiplier *= 1 + atomicLattice * 0.02;
  }

  const cryoCalibration = state.research.cryoCalibration || 0;
  if (cryoCalibration > 0) {
    perks.generatorCostGrowthMultiplier *= 1 - cryoCalibration * 0.004;
  }

  const ambientCharge = state.research.ambientCharge || 0;
  if (ambientCharge > 0) {
    perks.clickMatterBonus += ambientCharge * 1.5;
  }

  const harmonicForge = state.research.harmonicForge || 0;
  if (harmonicForge > 0) {
    perks.productionMultiplier *= 1 + harmonicForge * 0.015;
  }

  const transcendentSchema = state.research.transcendentSchema || 0;
  if (transcendentSchema > 0) {
    perks.prestigeGainMultiplier *= 1.06;
  }

  const kineticAmplifier = state.research.kineticAmplifier || 0;
  if (kineticAmplifier > 0) {
    perks.clickMultiplier *= 1 + kineticAmplifier * 0.06;
  }
  const furnaceTuning = state.research.furnaceTuning || 0;
  if (furnaceTuning > 0) {
    perks.furnaceRateMultiplier *= 1 + furnaceTuning * 0.05;
  }
  const condenserTuning = state.research.condenserTuning || 0;
  if (condenserTuning > 0) {
    perks.condenserRateMultiplier *= 1 + condenserTuning * 0.05;
  }
  const prismLore = state.research.prismLore || 0;
  if (prismLore > 0) {
    perks.prismRateMultiplier *= 1 + prismLore * 0.06;
  }
  const yieldCatalysis = state.research.yieldCatalysis || 0;
  if (yieldCatalysis > 0) {
    perks.conversionYieldMultiplier *= 1 + yieldCatalysis * 0.04;
  }
  const refundTheory = state.research.refundTheory || 0;
  if (refundTheory > 0) {
    perks.conversionRefundFraction += refundTheory * 0.02;
  }
  const conversionAnchors = state.research.conversionAnchors || 0;
  if (conversionAnchors > 0) {
    perks.conversionCostFlatReduction += conversionAnchors * 3;
  }
  const criticalStudies = state.research.criticalStudies || 0;
  if (criticalStudies > 0) {
    perks.clickCritChance += criticalStudies * 0.01;
  }
  const criticalFocus = state.research.criticalFocus || 0;
  if (criticalFocus > 0) {
    perks.clickCritMultiplier += criticalFocus * 0.1;
  }
  const emberClicks = state.research.emberClicks || 0;
  if (emberClicks > 0) {
    perks.clickFireBonus += emberClicks * 0.2;
  }
  const transmuteCadence = state.research.transmuteCadence || 0;
  if (transmuteCadence > 0) {
    perks.clickMatterBonus += transmuteCadence * 0.8;
  }
  const twinFlow = state.research.twinFlow || 0;
  if (twinFlow > 0) {
    perks.matterRateMultiplier *= 1 + twinFlow * 0.02;
    perks.fireRateMultiplier *= 1 + twinFlow * 0.02;
  }
  const catalystBleed = state.research.catalystBleed || 0;
  if (catalystBleed > 0) {
    perks.conversionFireBonus += catalystBleed * 0.2;
  }
  const matrixDamping = state.research.matrixDamping || 0;
  if (matrixDamping > 0) {
    perks.generatorCostGrowthMultiplier *= 1 - matrixDamping * 0.015;
  }
  const shardFractal = state.research.shardFractal || 0;
  if (shardFractal > 0) {
    perks.prestigeGainMultiplier *= 1 + shardFractal * 0.03;
  }

  if (Array.isArray(ascendNodes)) {
    const nodeMap = new Map(ascendNodes.map((node) => [node.id, node]));
    Object.keys(state.ascensionTree).forEach((nodeId) => {
      if (!state.ascensionTree[nodeId]) {
        return;
      }
      const node = nodeMap.get(nodeId);
      if (!node || !node.effect) {
        return;
      }
      const effect = node.effect;
      if (effect.productionMultiplier) {
        perks.productionMultiplier *= effect.productionMultiplier;
      }
      if (effect.matterRateMultiplier) {
        perks.matterRateMultiplier *= effect.matterRateMultiplier;
      }
      if (effect.fireRateMultiplier) {
        perks.fireRateMultiplier *= effect.fireRateMultiplier;
      }
      if (effect.clickMatterBonus) {
        perks.clickMatterBonus += effect.clickMatterBonus;
      }
      if (effect.conversionFireBonus) {
        perks.conversionFireBonus += effect.conversionFireBonus;
      }
      if (effect.prestigeGainMultiplier) {
        perks.prestigeGainMultiplier *= effect.prestigeGainMultiplier;
      }
      if (effect.generatorCostGrowthMultiplier) {
        perks.generatorCostGrowthMultiplier *= effect.generatorCostGrowthMultiplier;
      }
      if (effect.conversionCostMultiplier) {
        perks.conversionCostMultiplier *= effect.conversionCostMultiplier;
      }
      if (effect.offlineEfficiencyMultiplier) {
        perks.offlineEfficiencyMultiplier *= effect.offlineEfficiencyMultiplier;
      }
      if (effect.researchCostMultiplier) {
        perks.researchCostMultiplier *= effect.researchCostMultiplier;
      }
      if (effect.expeditionYieldMultiplier) {
        perks.expeditionYieldMultiplier *= effect.expeditionYieldMultiplier;
      }
      if (effect.expeditionSpeedMultiplier) {
        perks.expeditionSpeedMultiplier *= effect.expeditionSpeedMultiplier;
      }
      if (effect.expeditionRiskMitigation) {
        perks.expeditionRiskMitigation += effect.expeditionRiskMitigation;
      }
      if (effect.expeditionShardBonus) {
        perks.expeditionShardBonus += effect.expeditionShardBonus;
      }
      if (effect.expeditionIntelMultiplier) {
        perks.expeditionIntelMultiplier *= effect.expeditionIntelMultiplier;
      }
      if (effect.partTierCapBonus) {
        perks.partTierCapBonus += Number(effect.partTierCapBonus) || 0;
      }
      if (effect.facilityMaxLevelBonus) {
        perks.facilityMaxLevelBonus += Number(effect.facilityMaxLevelBonus) || 0;
      }
      if (effect.rewardsChestCapacityBonus) {
        perks.rewardsChestCapacityBonus += Number(effect.rewardsChestCapacityBonus) || 0;
      }
    });
  }

  const claimedCollectionMilestones = state.expeditions?.collection?.claimedMilestones || {};
  const collectionMilestones = Array.isArray(balance?.expeditions?.collectionMilestones)
    ? balance.expeditions.collectionMilestones
    : [];
  collectionMilestones.forEach((milestone) => {
    const milestoneId = typeof milestone?.id === "string" ? milestone.id : "";
    if (!milestoneId || !claimedCollectionMilestones[milestoneId]) {
      return;
    }
    const effect = milestone.effect && typeof milestone.effect === "object" ? milestone.effect : {};
    if (effect.productionMultiplier) {
      perks.productionMultiplier *= effect.productionMultiplier;
    }
    if (effect.matterRateMultiplier) {
      perks.matterRateMultiplier *= effect.matterRateMultiplier;
    }
    if (effect.fireRateMultiplier) {
      perks.fireRateMultiplier *= effect.fireRateMultiplier;
    }
    if (effect.clickMatterBonus) {
      perks.clickMatterBonus += effect.clickMatterBonus;
    }
    if (effect.conversionFireBonus) {
      perks.conversionFireBonus += effect.conversionFireBonus;
    }
    if (effect.prestigeGainMultiplier) {
      perks.prestigeGainMultiplier *= effect.prestigeGainMultiplier;
    }
    if (effect.generatorCostGrowthMultiplier) {
      perks.generatorCostGrowthMultiplier *= effect.generatorCostGrowthMultiplier;
    }
    if (effect.conversionCostMultiplier) {
      perks.conversionCostMultiplier *= effect.conversionCostMultiplier;
    }
    if (effect.offlineEfficiencyMultiplier) {
      perks.offlineEfficiencyMultiplier *= effect.offlineEfficiencyMultiplier;
    }
    if (effect.researchCostMultiplier) {
      perks.researchCostMultiplier *= effect.researchCostMultiplier;
    }
    if (effect.expeditionYieldMultiplier) {
      perks.expeditionYieldMultiplier *= effect.expeditionYieldMultiplier;
    }
    if (effect.expeditionSpeedMultiplier) {
      perks.expeditionSpeedMultiplier *= effect.expeditionSpeedMultiplier;
    }
    if (effect.expeditionRiskMitigation) {
      perks.expeditionRiskMitigation += effect.expeditionRiskMitigation;
    }
    if (effect.expeditionShardBonus) {
      perks.expeditionShardBonus += effect.expeditionShardBonus;
    }
    if (effect.expeditionIntelMultiplier) {
      perks.expeditionIntelMultiplier *= effect.expeditionIntelMultiplier;
    }
    if (effect.partTierCapBonus) {
      perks.partTierCapBonus += Number(effect.partTierCapBonus) || 0;
    }
    if (effect.facilityMaxLevelBonus) {
      perks.facilityMaxLevelBonus += Number(effect.facilityMaxLevelBonus) || 0;
    }
    if (effect.rewardsChestCapacityBonus) {
      perks.rewardsChestCapacityBonus += Number(effect.rewardsChestCapacityBonus) || 0;
    }
  });

  perks.generatorCostGrowthMultiplier = clampMin(perks.generatorCostGrowthMultiplier, 0.2);
  perks.conversionCostMultiplier = clampMin(perks.conversionCostMultiplier, 0.05);
  perks.conversionYieldMultiplier = clampMin(perks.conversionYieldMultiplier, 0.2);
  perks.clickMultiplier = clampMin(perks.clickMultiplier, 0.2);
  perks.clickCritMultiplier = clampMin(perks.clickCritMultiplier, 1);
  perks.conversionRefundFraction = Math.min(perks.conversionRefundFraction, 0.6);
  perks.clickCritChance = Math.min(perks.clickCritChance, 0.6);
  perks.conversionCostFlatReduction = Math.max(0, perks.conversionCostFlatReduction);
  perks.furnaceRateMultiplier = clampMin(perks.furnaceRateMultiplier, 0.2);
  perks.condenserRateMultiplier = clampMin(perks.condenserRateMultiplier, 0.2);
  perks.prismRateMultiplier = clampMin(perks.prismRateMultiplier, 0.2);
  perks.researchCostMultiplier = clampMin(perks.researchCostMultiplier, 0.05);
  perks.offlineEfficiencyMultiplier = clampMin(perks.offlineEfficiencyMultiplier, 0.1);

  perks.expeditionYieldMultiplier = clampMin(perks.expeditionYieldMultiplier, 0.05);
  perks.expeditionSpeedMultiplier = clampMin(perks.expeditionSpeedMultiplier, 0.05);
  perks.expeditionIntelMultiplier = clampMin(perks.expeditionIntelMultiplier, 0.05);
  perks.partTierCapBonus = Math.max(0, Math.floor(Number(perks.partTierCapBonus) || 0));
  perks.facilityMaxLevelBonus = Math.max(0, Math.floor(Number(perks.facilityMaxLevelBonus) || 0));
  perks.rewardsChestCapacityBonus = Math.max(0, Math.floor(Number(perks.rewardsChestCapacityBonus) || 0));
  state.perks = perks;
  return perks;
}
