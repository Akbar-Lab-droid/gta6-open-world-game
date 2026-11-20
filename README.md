# Solmar Heat — an open-world getaway

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Akbar-Lab-droid/gta6-open-world-game/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Akbar-Lab-droid/gta6-open-world-game/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01): steal cars, run jobs for the fixer Vera Kane, lose the Solmar police, and get paid — all in the sun-soaked fictional city of Solmar. Everything in it is original: its own city, characters, vehicles, story, art and synthesised sound. Nothing is taken from any commercial game.

## Play it

Serve `game/` with any static server and open `index.html` in desktop Chrome — no build step, no network request:

```sh
node serve.ts
# open http://localhost:8080
```

Keyboard and mouse: **WASD** move / drive, **E** enter a car or grab a package, **click** to shoot, **Space** to punch, **Shift** to sprint, **R** reload, **P** pause, **M** mute. Progress saves automatically at every job.

## The game

- **A city to explore** — Solmar is a 3600×2600 grid of roads, blocks, parks, a beach and a harbour docks district, with traffic that keeps to the roads and pedestrians on the sidewalks.
- **Cars to steal and drive** — parked cars and traffic; each kind (sedan, sport, van, taxi) handles differently, with acceleration, steering, skids and crashes.
- **A wanted level with police who respond** — 1 to 5 stars. Patrol cars chase, cut you off and ram; officers get out on foot and try to hold you. Get clean by outrunning them until the heat dies down. Get caught and you pay a fine at Solmar PD; get wasted and you wake up at Solmar General.
- **Missions and a story** — a four-job chain for Vera Kane: steal a car, deliver it to her garage, pick up a package at the docks (it is a setup — lose the cops), then deliver it to Marina Point for $800. After the chain, fares appear across the city for repeatable cash.
- **Combat** — a pistol with a magazine and reload, and a punch for close work.
- **HUD with minimap** — cash, health, wanted stars, the current objective, speed, ammo, and a live minimap showing you, the police and the mission marker.
- **Sound, menus and save** — synthesised engine, sirens, gunfire and jingles (Web Audio, no audio files), a title screen, pause, busted/wasted screens, and a localStorage save.

## Layout

```
game/
  index.html        the page (1280×720 canvas, module script)
  src/
    main.js         boot, the fixed-step loop, screens, save/load
    config.js       every tuning number and colour
    city.js         the city: roads, blocks, buildings, beach, docks, landmarks
    world.js        the game state and one fixed step of it
    entities.js     traffic, pedestrians and the police
    missions.js     Vera Kane's job chain and the fares
    render.js       drawing: the city, the cars, the HUD, the minimap, the screens
    input.js        keyboard and pointer input
    audio.js        synthesised sound (Web Audio, no files)
    shots.js        the four deterministic screenshot scenes
    random.js       the seeded generator behind the city
screenshots/        four real renders of the game (cover first)
main.ts             hands game/ and screenshots/ in and writes dossier.json
```

## Screenshots

The cover shows a three-star chase downtown — wanted level, minimap and mission objective on the HUD. The others show Danny on foot by Vera's Garage, the docks pickup with a patrol car closing in, and a run down the beach road.

## License

MIT. See [LICENSE](LICENSE).
