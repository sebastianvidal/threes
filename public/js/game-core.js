// Core game logic - shared between client and can be used for reference

const GameCore = {
  DICE_COUNT: 5,
  MAX_ROLLS: 5,

  rollDie() {
    return Math.floor(Math.random() * 6) + 1;
  },

  calculateScore(dice) {
    return dice.reduce((sum, d) => sum + (d === 3 ? 0 : d), 0);
  },

  getScoreComment(score) {
    if (score === 0) return "PERFECT! All 3s!";
    if (score <= 5) return "Incredible!";
    if (score <= 10) return "Amazing!";
    if (score <= 15) return "Excellent!";
    if (score <= 20) return "Great job!";
    if (score <= 25) return "Nice!";
    return "Better luck next time!";
  },

  // Check if player can roll
  canRoll(state) {
    if (state.rollsLeft <= 0) return false;
    if (state.hasRolledThisRound && !state.hasKeptThisRoll) return false;
    if (state.activeDice.length === 0 && state.keptDice.length > 0) return false;
    return true;
  },

  // Check if player can keep selected dice
  canKeep(state, selectedCount) {
    if (!state.hasRolledThisRound) return false;
    if (selectedCount === 0) return false;
    return true;
  },

  // Create initial player state
  createPlayerState() {
    return {
      activeDice: [],
      keptDice: [],
      rollsLeft: this.MAX_ROLLS,
      score: 0,
      hasRolledThisRound: false,
      hasKeptThisRoll: false
    };
  }
};

// Export for Node.js if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameCore;
}
