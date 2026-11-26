'use strict';

/**
 * StoryForge Production Pipeline Definition
 * Collection 6 - 10 Stage Production Architecture
 *
 * This file defines the official production pipeline.
 * It does not execute agents or generate media.
 */

const PRODUCTION_STAGES = Object.freeze([
  {
    id: 'story-analysis',
    order: 1,
    name: 'Story Analysis',
    description: 'Analyze the story idea and establish the creative direction.',
    agents: ['storyDirector'],
    dependsOn: [],
    outputKey: 'storyAnalysis',
    requiredOutputs: ['title', 'premise', 'genre']
  },

  {
    id: 'screenplay-construction',
    order: 2,
    name: 'Screenplay Construction',
    description: 'Develop the story into a structured screenplay.',
    agents: ['storyWriter'],
    dependsOn: ['story-analysis'],
    outputKey: 'screenplay',
    requiredOutputs: ['screenplay']
  },

  {
    id: 'scene-construction',
    order: 3,
    name: 'Scene Construction',
    description: 'Convert the screenplay into structured production scenes.',
    agents: ['scenePlanner'],
    dependsOn: ['screenplay-construction'],
    outputKey: 'scenePlan',
    requiredOutputs: ['scenes']
  },

  {
    id: 'character-production',
    order: 4,
    name: 'Character Production',
    description: 'Create and maintain character identities, appearances and profiles.',
    agents: ['characterAI'],
    dependsOn: ['scene-construction'],
    outputKey: 'characterProduction',
    requiredOutputs: ['characters']
  },

  {
    id: 'world-environment-building',
    order: 5,
    name: 'World & Environment Building',
    description: 'Build the story world, locations, environments and Roblox structures.',
    agents: ['worldBuilder', 'robloxBuilder'],
    dependsOn: ['character-production'],
    outputKey: 'worldProduction',
    requiredOutputs: ['worlds', 'environments']
  },

  {
    id: 'animation-action',
    order: 6,
    name: 'Animation & Action',
    description: 'Plan character movement, actions, animation and scene interactions.',
    agents: ['animationDirector'],
    dependsOn: ['world-environment-building'],
    outputKey: 'animationProduction',
    requiredOutputs: ['animations', 'actions']
  },

  {
    id: 'camera-cinematography',
    order: 7,
    name: 'Camera & Cinematography',
    description: 'Define camera shots, framing, movement and cinematography.',
    agents: ['cameraDirector'],
    dependsOn: ['animation-action'],
    outputKey: 'cameraProduction',
    requiredOutputs: ['shots', 'cameraPlan']
  },

  {
    id: 'audio-production',
    order: 8,
    name: 'Audio Production',
    description: 'Plan dialogue, voice, music and sound effects.',
    agents: ['audioDirector'],
    dependsOn: ['camera-cinematography'],
    outputKey: 'audioProduction',
    requiredOutputs: ['audioPlan']
  },

  {
    id: 'rendering-assembly',
    order: 9,
    name: 'Rendering & Assembly',
    description: 'Produce media, render scenes and assemble the video.',
    agents: ['sceneAssembly', 'videoProviderManager'],
    dependsOn: ['audio-production'],
    outputKey: 'renderProduction',
    requiredOutputs: ['video']
  },

  {
    id: 'finalization-quality-check',
    order: 10,
    name: 'Finalization & Quality Check',
    description: 'Validate continuity, compliance, video quality and final deliverables.',
    agents: [
      'continuityValidator',
      'complianceChecker',
      'videoReviewer',
      'revisionAI',
      'learningAgent'
    ],
    dependsOn: ['rendering-assembly'],
    outputKey: 'finalQuality',
    requiredOutputs: ['qualityReport', 'verifiedFinalVideo']
  }
]);

function getProductionStages() {
  return PRODUCTION_STAGES.map(stage => ({
    ...stage,
    agents: [...stage.agents],
    dependsOn: [...stage.dependsOn],
    requiredOutputs: [...stage.requiredOutputs]
  }));
}

function getProductionStage(stageId) {
  const stage = PRODUCTION_STAGES.find(
    item => item.id === stageId
  );

  if (!stage) {
    return null;
  }

  return {
    ...stage,
    agents: [...stage.agents],
    dependsOn: [...stage.dependsOn],
    requiredOutputs: [...stage.requiredOutputs]
  };
}

function getNextProductionStage(stageId) {
  const currentIndex = PRODUCTION_STAGES.findIndex(
    stage => stage.id === stageId
  );

  if (currentIndex === -1) {
    return null;
  }

  return PRODUCTION_STAGES[currentIndex + 1] || null;
}

function getProductionStageCount() {
  return PRODUCTION_STAGES.length;
}

function createProductionStageStatuses() {
  return PRODUCTION_STAGES.map(stage => ({
    id: stage.id,
    order: stage.order,
    name: stage.name,
    status: 'pending',
    agents: [...stage.agents],
    output: null,
    error: null,
    startedAt: null,
    completedAt: null
  }));
}

module.exports = {
  PRODUCTION_STAGES,
  getProductionStages,
  getProductionStage,
  getNextProductionStage,
  getProductionStageCount,
  createProductionStageStatuses
};
    
