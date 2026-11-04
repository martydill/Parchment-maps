# Gameplay improvements from automated voyages

Four seeded merchant voyages ran for 20 simulation minutes each. They completed
291 port calls and 125 commissions without a failed commission or autopilot stall.
Each started with 120 crowns and the merchant cutter.

| Seed     | Final day | Final crowns | Morale | Fatigue in every crew group |
| -------- | --------: | -----------: | -----: | --------------------------: |
| baseline |       119 |       23,854 |      1 |                         100 |
| north    |       123 |       27,231 |      0 |                         100 |
| south    |       123 |       26,073 |   0.21 |                         100 |
| west     |       123 |       26,058 |      2 |                         100 |

These are tuning signals. The original policy knew every market price, always
attempted to flee combat, restocked and repaired automatically, and did not choose
shore leave, upgrades, or story objectives. Its outcomes should not be treated as
the expected experience of a new player. No economy or crew penalties were changed
as part of these changes; the implemented improvements below make the existing
choices easier to find and provide a realistic comparison policy.

## Implemented

- A sea HUD crew warning and a departure readiness control link to Dock → Passage.
  Warnings trigger below 35 morale or above 60 crew-weighted fatigue.
- Shore leave previews its crown/day cost, resulting morale and fatigue, wages due,
  and imminent commission deadlines. The player and automation share one action.
- Automation defaults to remembered market prices and rests at most once per
  visit when its reserve and delivery estimates allow. `--knowledge all --rest off`
  preserves the previous benchmark policy.
- Harbor suggestions surface actionable iron-shortage and convoy-law milestones,
  or an affordable ship with its benefit and tradeoff. Existing commissions remain
  visible. Ship suggestions retain a 60-crown operating reserve.
- An arrival receipt updates with cargo sales and upkeep, and the ledger retains
  the latest 12 receipts alongside dated market notes. Cargo cost enters the profit
  calculation when sold or lost, so buying unsold inventory is not counted as a loss.
  Old saves start with empty receipts and price memory.

A matched 600-second `baseline` run produced these outcomes:

| Market knowledge | Rest | Final day | Crowns | Morale | Fatigue | Rest days | Failed commissions |
| ---------------- | ---- | --------: | -----: | -----: | ------: | --------: | -----------------: |
| Remembered       | Off  |        60 |  8,123 |      0 |     100 |         0 |                  0 |
| Remembered       | On   |        66 | 10,060 |   48.4 |    52.7 |         7 |                  0 |
| All markets      | Off  |        58 | 11,217 |   22.6 |     100 |         0 |                  0 |
| All markets      | On   |        65 | 11,178 |   73.2 |    38.7 |         7 |                  0 |

This single-seed comparison supports making rest discoverable before increasing
penalties. Rest consumes game days, and its weather and wage effects change the
subsequent voyage sequence, so these are policy outcomes rather than isolated
causal estimates. Compare more seeds before tuning prices or crew rules.

## Follow-up experiments

Repeat the four policy configurations across more seeds and longer voyages. Track
wealth, realized profit per voyage, time in crew warning states, missed deadlines,
and the number of viable trade routes. Rest should remain useful without becoming
mandatory after every short passage.

Maximum fatigue with high loyalty and no injuries contributes 30.25 mutiny
pressure, below the incident threshold of 35; morale does not enter that
calculation. The first benchmark shows healthier crews with the existing recovery
rules, so increased penalties need stronger evidence.

If profits remain excessive under remembered prices, compare one change at a time:
stronger local price response to repeat trades, faster NPC competition on popular
routes, or operating costs that scale with larger vessels and fleets. Preserve
profitable beginner routes and affordable recovery for a struggling starter ship.

A future benchmark can pursue one upgrade and one story milestone to measure
whether those investments improve capability and whether milestone guidance is
useful while carrying commissions. The implemented harbor suggestions provide the
player-facing path; the merchant policy still focuses on trading and deliveries.
