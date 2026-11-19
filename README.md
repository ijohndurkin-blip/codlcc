# Liverpool Car Centre

A COD-style rooftop sniper game set at **Liverpool Car Centre, 75 A5038 (Brewster St), Bootle**.
Iranian troops have invaded the forecourt. You're on the roof over the road with a bolt-action rifle,
and every time you drop one you say **"Keh"**.

Built with [three.js](https://threejs.org) + Vite. Everything (textures, cars, soldiers, sound, music) is
generated procedurally at runtime, so there are no asset files to download.

## Play locally

```bash
npm install
npm run dev
```

Open the printed URL in a desktop browser (Chrome / Edge / Firefox). Mouse + keyboard required.

## Deploy to Vercel

Import the repo in Vercel. It auto-detects Vite (`vercel.json` pins it anyway):

- Build command: `npm run build`
- Output directory: `dist`

## Controls

| Input | Action |
| --- | --- |
| Mouse | Aim |
| Left click | Fire |
| Right click (hold) | Scope in |
| Mouse wheel | Scope zoom (3x–12x) |
| Shift | Hold breath while scoped / sprint |
| C or Ctrl | Crouch behind the parapet (dodges incoming fire) |
| W A S D | Move along the rooftop |
| R | Reload |
| Esc | Pause |

## The "Keh"

On every kill the game says "Keh". It uses the first one of these it finds:

1. **Your own voice:** on the main menu hit **🎙 RECORD YOUR "KEH"** and say it into the mic.
   It's saved in your browser.
2. **A sound file:** drop a `keh.mp3` into `public/` before deploying.
3. **Text-to-speech** built into the browser.

## Gameplay

- Waves of troops arrive in trucks (from the left along the A5038), on foot down Brewster St,
  and out of the showroom doors. They take cover behind the stock and pop up to shoot.
- **Rushers** cross the road and lob grenades onto your roof. Watch the grenade indicator and move.
- **Snipers** (wave 3+) appear on the red-brick building's roof. Look for the scope glint.
- **Heavies** (wave 4+) are armoured. Go for the head.
- Shoot the **red jerry cans** on a truck to blow it up and take out anyone nearby.
- Rounds go through car windows and the showroom glass. Hitting the cars sets off their alarms.
- Health regenerates once you stop taking damage. Crouch to get out of fire and reload.

## Graphics settings

**GRAPHICS** on the main menu cycles through these:

- **MEDIUM**: 1x resolution, 2K shadows, no bloom. For laptops and integrated GPUs.
- **HIGH** (default): up to 1.5x resolution, 4K shadows, bloom.
- **ULTRA**: up to 2x resolution plus GTAO ambient occlusion.
