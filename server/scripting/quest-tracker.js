// Quest Tracker - Manages per-player quest DAG progression.
//
// Each quest has steps arranged as a DAG (directed acyclic graph).
// Steps have prerequisiteSteps, completionConditions, and an objective (map marker).
// The tracker auto-completes steps when their conditions are met and
// unlocks successor steps whose prerequisites are all complete.

class QuestTracker {
  constructor(content, conditionEvaluator, actionExecutor) {
    this.content = content;
    this.conditions = conditionEvaluator;
    this.actions = actionExecutor;

    // Map<playerId, Map<questId, { activeSteps: Set, completedSteps: Set }>>
    this.playerStates = new Map();

    // Callbacks set by index.js
    this.onObjectiveChanged = null;   // (playerId, roomId) => void
    this.onStepCompleted = null;      // (playerId, questId, stepId, stepDef) => void
  }

  initPlayer(playerId) {
    const quests = this.content.getAllQuests();
    const questMap = new Map();

    for (const [questId, quest] of Object.entries(quests)) {
      const activeSteps = new Set();
      const completedSteps = new Set();
      if (quest.startStep && quest.steps[quest.startStep]) {
        activeSteps.add(quest.startStep);
      }
      questMap.set(questId, { activeSteps, completedSteps });
    }

    this.playerStates.set(playerId, questMap);
  }

  removePlayer(playerId) {
    this.playerStates.delete(playerId);
  }

  // Check all active steps across all quests for the given player.
  // Called from _emitGameEvent and from flag_changed eventBus listener.
  processEvent(eventType, context) {
    if (!context || !context.playerId) return;
    const playerId = context.playerId;
    const questMap = this.playerStates.get(playerId);
    if (!questMap) return;

    const quests = this.content.getAllQuests();

    for (const [questId, state] of questMap) {
      const quest = quests[questId];
      if (!quest) continue;

      // Copy activeSteps so we can modify during iteration
      const active = [...state.activeSteps];
      for (const stepId of active) {
        const stepDef = quest.steps[stepId];
        if (!stepDef || !stepDef.completionConditions) continue;

        if (this.conditions.evaluate(stepDef.completionConditions, context)) {
          this._completeStep(playerId, questId, quest, state, stepId, stepDef, context);
        }
      }
    }
  }

  _completeStep(playerId, questId, quest, state, stepId, stepDef, context) {
    state.activeSteps.delete(stepId);
    state.completedSteps.add(stepId);

    // Execute completionActions if defined
    if (stepDef.completionActions) {
      this.actions.executeAll(stepDef.completionActions, context);
    }

    // Unlock successor steps whose prerequisites are now all met
    for (const [candidateId, candidateDef] of Object.entries(quest.steps)) {
      if (state.activeSteps.has(candidateId) || state.completedSteps.has(candidateId)) continue;
      const prereqs = candidateDef.prerequisiteSteps || [];
      if (prereqs.length === 0) continue; // startStep only
      if (prereqs.every(p => state.completedSteps.has(p))) {
        state.activeSteps.add(candidateId);
      }
    }

    if (this.onStepCompleted) {
      this.onStepCompleted(playerId, questId, stepId, stepDef);
    }
    if (this.onObjectiveChanged) {
      this.onObjectiveChanged(playerId, context.roomId);
    }
  }

  // Returns the objective from the first active step (across all quests).
  getActiveObjective(playerId) {
    const questMap = this.playerStates.get(playerId);
    if (!questMap) return null;

    const quests = this.content.getAllQuests();
    for (const [questId, state] of questMap) {
      const quest = quests[questId];
      if (!quest) continue;
      for (const stepId of state.activeSteps) {
        const stepDef = quest.steps[stepId];
        if (stepDef && stepDef.objective) {
          return {
            label: stepDef.label,
            roomId: stepDef.objective.roomId,
            tileX: stepDef.objective.tileX,
            tileY: stepDef.objective.tileY,
          };
        }
      }
    }
    return null;
  }

  // Build quest state for client display
  getQuestStateForClient(playerId) {
    const questMap = this.playerStates.get(playerId);
    if (!questMap) return [];

    const quests = this.content.getAllQuests();
    const result = [];

    for (const [questId, state] of questMap) {
      const quest = quests[questId];
      if (!quest) continue;

      const steps = [];
      for (const [stepId, stepDef] of Object.entries(quest.steps)) {
        let status = 'locked';
        if (state.completedSteps.has(stepId)) status = 'completed';
        else if (state.activeSteps.has(stepId)) status = 'active';
        steps.push({
          id: stepId,
          label: stepDef.label,
          description: stepDef.description,
          status,
        });
      }

      result.push({
        id: questId,
        name: quest.name,
        description: quest.description,
        steps,
      });
    }

    return result;
  }

  // Serialize player quest state for checkpoint saving
  serializePlayerState(playerId) {
    const questMap = this.playerStates.get(playerId);
    if (!questMap) return null;

    const result = {};
    for (const [questId, state] of questMap) {
      result[questId] = {
        activeSteps: [...state.activeSteps],
        completedSteps: [...state.completedSteps],
      };
    }
    return result;
  }

  // Restore player quest state from checkpoint
  restorePlayerState(playerId, saved) {
    if (!saved) return;

    const questMap = this.playerStates.get(playerId);
    if (!questMap) return;

    for (const [questId, savedState] of Object.entries(saved)) {
      const state = questMap.get(questId);
      if (!state) continue;
      state.activeSteps = new Set(savedState.activeSteps || []);
      state.completedSteps = new Set(savedState.completedSteps || []);
    }
  }
}

module.exports = QuestTracker;
