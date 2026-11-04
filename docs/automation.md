# Automated voyages

Automation runs the actual browser game: sailing physics, wrapped navigation,
markets, commissions, customs, weather, wear, wages, and combat. A merchant policy
chooses voyages, follows land-avoiding courses, sells cargo, accepts commissions,
buys supplies, repairs the ship, grants shore leave when deadlines allow, and
attempts to flee combat. By default it uses remembered prices from visited ports
and purchased market circulars, with a conservative allowance for aging quotes.
It only chooses revealed ports or destinations named by available commissions.

The game remains dependency-free at runtime. Playwright is a development dependency
for launching Chromium, taking screenshots, and recording video.

## Run a headless voyage

```sh
npm install
npx playwright install chromium
npm run automate -- --seed baseline --seconds 600 --output .context/baseline
```

Use `--knowledge all` for the original policy's full market knowledge and
`--rest off` to disable automatic shore leave. The defaults are `--knowledge known`
and `--rest on`. Shore leave occurs at most once per harbor visit, retains a
40-crown reserve, and checks that active commissions can still arrive on time.
These options also work as query parameters in an interactive demo.

```sh
npm run automate -- --seed baseline --seconds 600 --knowledge known --rest on --output .context/known-rest
npm run automate -- --seed baseline --seconds 600 --knowledge known --rest off --output .context/known-no-rest
npm run automate -- --seed baseline --seconds 600 --knowledge all --rest off --output .context/omniscient
```

The runner starts a temporary HTTP server on a free loopback port, launches a
fresh browser context, advances the simulation, writes artifacts, and closes the
browser and server. No separately running server is necessary.

Output files:

- `report.json`: options, periodic samples, final state, action counts, and errors.
- `final.png`: the final browser screenshot, also captured after a failed run when possible.
- `video/*.webm`: a recording when `--record` is used.

`--seconds` counts simulation seconds. Thirty fixed ticks make one second;
in-game days still follow the game's normal voyage clock. Step mode runs as
quickly as the machine allows. `--assert` makes the runner fail unless the voyage
visits at least two distinct ports, completes a commission, and trades cargo.
Browser errors and a stalled autopilot also produce a nonzero exit and a report.
Each output directory is reused on subsequent runs, so use distinct directories
when retaining comparisons.

```sh
# Compare the same world before and after changing game balance.
npm run automate -- --seed baseline --seconds 600 --output .context/before
npm run automate -- --seed baseline --seconds 600 --output .context/after

# Exercise several worlds.
for seed in north south east west; do
  npm run automate -- --seed "$seed" --seconds 600 --output ".context/$seed"
done

# Use an existing local or deployed game server.
npm run automate -- --url http://localhost:8000 --seconds 180 --assert
```

Samples contain the simulation tick, destination, money, elapsed game days,
distance, port visits, completed/failed contracts, ship condition, provisions, morale, fatigue, shore-leave days,
and cumulative action counts. The final snapshot also contains a copy of the
game and ship state, port coordinates, world dimensions, and the most recent 500
action events. Event IDs and cumulative counts continue beyond that limit.

## Watch or record a demo

```sh
npm run automate -- --record --seconds 60 --output .context/demo
npm run automate -- --mode demo --headed --speed 4 --seconds 180
```

Recording defaults to demo mode, which advances fixed simulation ticks from real
elapsed time while rendering the game. It requires demo mode if `--mode` is
specified explicitly. `--speed` ranges from 0.25 to 32 and affects demo playback
only. Slower machines can take longer than the requested duration to simulate a
demo. Recordings are 1280 × 800 WebM video without audio; the opening cinematic
is skipped and encounter drums are disabled. The normal HUD and harbor screens
remain visible.

For an interactive demo on any static server, open:

```text
http://localhost:8000/?automation=demo&seed=baseline&speed=1
```

Automation always starts a fresh seeded voyage. It ignores the saved voyage,
stored map seed, and debug overrides, and does not write game saves or settings.
Save/load/new-game buttons are disabled for the session. Removing the query
parameters returns to ordinary play and the existing saved voyage.

## Browser control API

Open `/?automation=step&seed=baseline` and wait for
`window.parchmentAutomation.version === 1`. Step mode starts with its simulation
paused and the merchant policy enabled. The API is absent during ordinary play.

```js
const api = window.parchmentAutomation;
const initial = api.snapshot();
const after = api.step(300); // exactly ten simulation seconds
api.render(); // draw the current state before a screenshot

api.resume(); // real-time fixed-step playback
api.pause(); // stop playback; explicit step() still works
api.setAutoplay(false); // supply your own actions
api.command({ type: "steer", angle: Math.PI / 2, power: 1 });
api.step(30);
api.setAutoplay(true); // return control to the merchant policy
```

`step(frames = 1)` accepts integers from 1 through 1800 and returns a detached,
JSON-serializable snapshot. Larger experiments should advance in chunks. Rendering
does not advance time. `snapshot()` also returns a detached copy; editing it
cannot change the simulation. Reload the page to reset the run or change its seed.
Seed strings accept up to 128 characters.

`command(action)` returns `{ ok: true, ... }` or `{ ok: false, reason }` and records
the result. Commands act immediately; pausing playback does not prevent them.

| Action     | Fields                         | Behavior                                                                                    |
| ---------- | ------------------------------ | ------------------------------------------------------------------------------------------- |
| `steer`    | `angle`, `power`               | Set a heading in radians and power from 0 to 1. Input persists until replaced.              |
| `dock`     | —                              | Dock at the harbor currently in range.                                                      |
| `depart`   | —                              | Close the current harbor and prepare to cast off.                                           |
| `course`   | `port`                         | Plan a land-avoiding course to a named port. Autoplay follows it while at sea.              |
| `trade`    | `key`, `direction`, `quantity` | Buy or sell through normal market order validation while docked.                            |
| `contract` | `id`                           | Accept an available, compatible delivery commission while docked.                           |
| `supply`   | —                              | Buy provisions toward 18 and repair damage while retaining a 40-crown repair reserve.       |
| `rest`     | —                              | Grant one day of shore leave through the same cost, wage, and recovery rules as the player. |
| `combat`   | `action`                       | Choose `fight`, `flee`, `parley`, or `surrender` during combat.                             |

To find contract IDs, inspect `snapshot().game.contractOffers[currentPort].offers`.
To choose goods and inspect local supply and demand, use `snapshot().game.economy`.
External policies should turn autoplay off before sending commands.

## Repeatability and validation

For comparisons, use the same seed, code, viewport, motion preference, and action
sequence. Simulation inputs use the fixed clock, including weather and encounter
timing. Merchant sightings are recorded during simulation ticks, so changing
chunk size or screenshot cadence does not change game state. Video frames and
wall-clock duration can vary across machines. A policy that makes no progress
toward its destination for 90 simulation seconds stops with a diagnostic instead
of silently moving the ship or granting resources.

```sh
npm run test:automation
```

The browser checks cover two identical 120-second runs with different chunk sizes
and rendering cadence, real trading and completed commissions, preservation of
existing player storage, custom actions and rejected actions, ordinary keyboard
play and saving, and a short demo recording. Artifacts go under
`.context/automation-tests/`. Unit tests cover the clock, options, telemetry,
failures, voyage selection, and navigation around islands and across the world
seam. Run the regular formatter, linter, tests, and coverage checks as well.

Run `npm run test:ui` for desktop keyboard and phone touch checks of survey
instructions, commission course selection, and market purchases. Screenshots go
under `.context/harbor-ui-tests/`.

Run `npm run test:gameplay` for crew warning and shore-leave previews, deadline
warnings, contextual ship suggestions, legacy save migration, and real voyage
receipt updates after trading and resting. Artifacts go to `.context/gameplay-tests/`.

See [gameplay tuning suggestions](./gameplay-tuning.md) for findings from longer
merchant voyages and proposed crew, economy, and progression experiments.
