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

    // Map<playerId, questId> — which quest the player is tracking for the arrow
    this.trackedQuests = new Map();

    // Callbacks set by index.js
    this.onObjectiveChanged = null;   // (playerId, roomId) => void
    this.onStepCompleted = null;      // (playerId, questId, stepId, stepDef) => void
    this.onQuestStarted = null;       // (playerId, questId, quest) => void
  }

  initPlayer(playerId) {
    const quests = this.content.getAllQuests();
    const questMap = new Map();

    for (const [questId, quest] of Object.entries(quests)) {
      const activeSteps = new Set();
      const completedSteps = new Set();
      // Quests with startConditions remain inactive until conditions are met
      if (quest.startStep && quest.steps[quest.startStep] && !quest.startConditions) {
        activeSteps.add(quest.startStep);
      }
      questMap.set(questId, { activeSteps, completedSteps });
    }

    this.playerStates.set(playerId, questMap);

    // Default tracked quest: first quest with active steps
    for (const [questId, state] of questMap) {
      if (state.activeSteps.size > 0) {
        this.trackedQuests.set(playerId, questId);
        break;
      }
    }
  }

  removePlayer(playerId) {
    this.playerStates.delete(playerId);
    this.trackedQuests.delete(playerId);
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

      // Check if a quest with startConditions should now activate
      if (quest.startConditions && state.activeSteps.size === 0 && state.completedSteps.size === 0) {
        if (quest.startStep && quest.steps[quest.startStep]) {
          if (this.conditions.evaluate(quest.startConditions, context)) {
            state.activeSteps.add(quest.startStep);
            if (this.onQuestStarted) {
              this.onQuestStarted(playerId, questId, quest);
            }
            if (this.onObjectiveChanged) {
              this.onObjectiveChanged(playerId, context.roomId);
            }
          } else {
            continue;
          }
        } else {
          continue;
        }
      }

      // Loop until no more steps complete — newly unlocked steps whose
      // conditions are already met should cascade in the same call.
      let changed = true;
      while (changed) {
        changed = false;
        const active = [...state.activeSteps];
        for (const stepId of active) {
          const stepDef = quest.steps[stepId];
          if (!stepDef || !stepDef.completionConditions) continue;

          if (this.conditions.evaluate(stepDef.completionConditions, context)) {
            this._completeStep(playerId, questId, quest, state, stepId, stepDef, context);
            changed = true;
          }
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

  // Set which quest a player is tracking
  setTrackedQuest(playerId, questId) {
    const questMap = this.playerStates.get(playerId);
    if (!questMap || !questMap.has(questId)) return false;
    this.trackedQuests.set(playerId, questId);
    return true;
  }

  getTrackedQuestId(playerId) {
    return this.trackedQuests.get(playerId) || null;
  }

  // Returns the objective from the tracked quest's first active step.
  // Falls back to the first active step across all quests if tracked quest has no objective.
  getActiveObjective(playerId) {
    const questMap = this.playerStates.get(playerId);
    if (!questMap) return null;

    const quests = this.content.getAllQuests();
    const trackedId = this.trackedQuests.get(playerId);

    // Helper: find first active objective in a quest
    const findObjective = (questId) => {
      const state = questMap.get(questId);
      const quest = quests[questId];
      if (!state || !quest) return null;
      for (const stepId of state.activeSteps) {
        const stepDef = quest.steps[stepId];
        if (stepDef && (stepDef.objective || stepDef.objectiveItem || stepDef.uiHint)) {
          const obj = {
            questId,
            questName: quest.name,
            label: stepDef.label,
            roomId: stepDef.objective ? stepDef.objective.roomId : null,
            tileX: stepDef.objective ? stepDef.objective.tileX : 0,
            tileY: stepDef.objective ? stepDef.objective.tileY : 0,
            depth: stepDef.objective ? stepDef.objective.depth : null,
            targetTile: stepDef.objective ? stepDef.objective.targetTile : null,
            targetNpc: stepDef.objective ? stepDef.objective.targetNpc : null,
            targetMonster: stepDef.objective ? stepDef.objective.targetMonster : null,
            targetExit: stepDef.objective ? stepDef.objective.targetExit : null,
          };
          if (stepDef.objectiveItem) {
            obj.objectiveItem = stepDef.objectiveItem;
          }
          if (stepDef.uiHint) {
            obj.uiHint = stepDef.uiHint;
          }
          return obj;
        }
      }
      return null;
    };

    // Try tracked quest first
    if (trackedId) {
      const obj = findObjective(trackedId);
      if (obj) return obj;
    }

    // Fallback: first quest with an active objective
    for (const [questId] of questMap) {
      const obj = findObjective(questId);
      if (obj) return obj;
    }
    return null;
  }

  // Returns objectives for all active quests (excluding the tracked one, which is handled separately).
  // Used to show secondary waypoints on the minimap.
  getAllActiveObjectives(playerId) {
    const questMap = this.playerStates.get(playerId);
    if (!questMap) return [];

    const quests = this.content.getAllQuests();
    const trackedId = this.trackedQuests.get(playerId);
    const results = [];

    for (const [questId, state] of questMap) {
      if (questId === trackedId) continue; // skip tracked — it's the primary objective
      const quest = quests[questId];
      if (!state || !quest) continue;
      for (const stepId of state.activeSteps) {
        const stepDef = quest.steps[stepId];
        if (stepDef && (stepDef.objective || stepDef.objectiveItem)) {
          const obj = {
            questId,
            questName: quest.name,
            label: stepDef.label,
            roomId: stepDef.objective ? stepDef.objective.roomId : null,
            tileX: stepDef.objective ? stepDef.objective.tileX : 0,
            tileY: stepDef.objective ? stepDef.objective.tileY : 0,
            depth: stepDef.objective ? stepDef.objective.depth : null,
            targetTile: stepDef.objective ? stepDef.objective.targetTile : null,
            targetNpc: stepDef.objective ? stepDef.objective.targetNpc : null,
            targetMonster: stepDef.objective ? stepDef.objective.targetMonster : null,
            targetExit: stepDef.objective ? stepDef.objective.targetExit : null,
          };
          if (stepDef.objectiveItem) obj.objectiveItem = stepDef.objectiveItem;
          results.push(obj);
          break; // one objective per quest
        }
      }
    }
    return results;
  }

  // Build quest state for client display
  getQuestStateForClient(playerId) {
    const questMap = this.playerStates.get(playerId);
    if (!questMap) return [];

    const quests = this.content.getAllQuests();
    const trackedId = this.trackedQuests.get(playerId) || null;
    const result = [];

    for (const [questId, state] of questMap) {
      const quest = quests[questId];
      if (!quest) continue;

      // Skip quests that haven't started yet (have startConditions not yet met)
      if (state.activeSteps.size === 0 && state.completedSteps.size === 0) continue;

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
        tracked: questId === trackedId,
        steps,
      });
    }

    return result;
  }

  // Serialize player quest state for checkpoint saving
  serializePlayerState(playerId) {
    const questMap = this.playerStates.get(playerId);
    if (!questMap) return null;

    const result = {
      _trackedQuestId: this.trackedQuests.get(playerId) || null,
    };
    for (const [questId, state] of questMap) {
      result[questId] = {
        activeSteps: [...state.activeSteps],
        completedSteps: [...state.completedSteps],
      };
    }
    return result;
  }

  // Restore player quest state from checkpoint
  restorePlayerState(playerId, saved, context) {
    if (!saved) return;

    const questMap = this.playerStates.get(playerId);
    if (!questMap) return;

    if (saved._trackedQuestId) {
      this.trackedQuests.set(playerId, saved._trackedQuestId);
    }

    for (const [questId, savedState] of Object.entries(saved)) {
      if (questId === '_trackedQuestId') continue;
      const state = questMap.get(questId);
      if (!state) continue;
      state.activeSteps = new Set(savedState.activeSteps || []);
      state.completedSteps = new Set(savedState.completedSteps || []);
    }

    // Repair DAG gaps: if a step's prerequisites are all completed but the step
    // itself is not completed (and its completion conditions are met), mark it
    // completed.  This fixes saves created before the cascade-loop fix.
    if (!context) return;
    const quests = this.content.getAllQuests();
    for (const [questId, state] of questMap) {
      const quest = quests[questId];
      if (!quest) continue;
      if (state.activeSteps.size === 0 && state.completedSteps.size === 0) continue;

      let repaired = true;
      while (repaired) {
        repaired = false;
        for (const [stepId, stepDef] of Object.entries(quest.steps)) {
          if (state.completedSteps.has(stepId) || state.activeSteps.has(stepId)) continue;
          const prereqs = stepDef.prerequisiteSteps || [];
          if (prereqs.length === 0 && stepId !== quest.startStep) continue;
          if (!prereqs.every(p => state.completedSteps.has(p))) continue;
          // Prerequisites met but step was never recorded — check completion conditions
          if (stepDef.completionConditions && this.conditions.evaluate(stepDef.completionConditions, context)) {
            state.completedSteps.add(stepId);
            repaired = true;
            console.log(`[QuestTracker] Repaired missing completed step "${stepId}" in quest "${questId}" for player ${playerId}`);
            // Unlock successors so the next iteration can check them
            for (const [candidateId, candidateDef] of Object.entries(quest.steps)) {
              if (state.activeSteps.has(candidateId) || state.completedSteps.has(candidateId)) continue;
              const cPrereqs = candidateDef.prerequisiteSteps || [];
              if (cPrereqs.length > 0 && cPrereqs.every(p => state.completedSteps.has(p))) {
                state.activeSteps.add(candidateId);
              }
            }
          }
        }
      }
    }
  }
}

module.exports = QuestTracker;
