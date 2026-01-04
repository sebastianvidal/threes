// Server-side game validation and logic

const DICE_COUNT = 5;
const MAX_ROLLS = 5;

function validateRoll(playerState) {
  // Can't roll if no rolls left
  if (playerState.rollsLeft <= 0) {
    return { valid: false, error: 'No rolls left' };
  }

  // Can't roll if already rolled without keeping (unless first roll)
  if (playerState.hasRolledThisRound && !playerState.hasKeptThisRoll) {
    return { valid: false, error: 'Must keep at least one die before rolling again' };
  }

  // Can't roll if no active dice (all kept) - unless first roll
  if (playerState.activeDice.length === 0 && playerState.keptDice.length > 0) {
    return { valid: false, error: 'All dice already kept' };
  }

  return { valid: true };
}

function validateKeep(playerState, indices) {
  // Must have rolled
  if (!playerState.hasRolledThisRound) {
    return { valid: false, error: 'Must roll before keeping' };
  }

  // Must select at least one die
  if (!indices || indices.length === 0) {
    return { valid: false, error: 'Must select at least one die' };
  }

  // Validate indices are in range
  for (const idx of indices) {
    if (idx < 0 || idx >= playerState.activeDice.length) {
      return { valid: false, error: 'Invalid die index' };
    }
  }

  // Check for duplicates
  if (new Set(indices).size !== indices.length) {
    return { valid: false, error: 'Duplicate indices' };
  }

  return { valid: true };
}

function generateDiceRoll(count) {
  const dice = [];
  for (let i = 0; i < count; i++) {
    dice.push(Math.floor(Math.random() * 6) + 1);
  }
  return dice;
}

function calculateScore(dice) {
  return dice.reduce((sum, d) => sum + (d === 3 ? 0 : d), 0);
}

module.exports = {
  validateRoll,
  validateKeep,
  generateDiceRoll,
  calculateScore,
  DICE_COUNT,
  MAX_ROLLS
};
