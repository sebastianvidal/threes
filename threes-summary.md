# 3s Dice Game - Summary for Claude Code

## Overview
A mobile-friendly web implementation of the dice game "3s" - a low-score dice game where 3s are worth zero points and all other dice are face value. Lowest score wins.

## Core Mechanics
- **Scoring**: 3s = 0 points, all other dice = face value
- **Dice**: 5 dice per player
- **Rolls**: Up to 5 rolls per turn to set aside all dice
- **Keep Rule**: Must keep at least 1 die after each roll before rolling again
- **Players**: Supports 1-6 players, each taking one turn before results are shown

## Game Flow
1. Player selection screen (1-6 players)
2. Each player takes their turn sequentially
3. On your turn: roll, tap dice to select, keep selected, repeat until all dice kept or out of rolls
4. After all players finish, a results popup shows everyone's dice and scores
5. Winner (lowest score) is highlighted; ties are announced
6. "Play Again" returns to player selection

## UI Features
- iOS-optimized touch handling
- Magenta gradient highlight for 3s
- Cyan glow border for selected dice
- Rolling animation
- Current player indicator
- Real-time score tracking

## Tech
Single HTML file with embedded CSS and vanilla JavaScript. No dependencies.
