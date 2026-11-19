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
| 1 / 2 / Q | Swap rifle (once the .50 cal is unlocked) |
| Esc | Pause |

## The "Keh"

On every kill the game says "Keh". It uses the first one of these it finds:

1. **Your own voice:** on the main menu hit **🎙 RECORD YOUR "KEH"** and say it into the mic.
   It's saved in your browser.
2. **A sound file:** drop a `keh.mp3` into `public/` before deploying.
3. **Text-to-speech** built into the browser.

## Craig, Kev Jones and the .50 cal

- **Craig** (fictional), the wee bald Scottish owner, comes out of the sliding showroom door now and again and
  shouts **"Get yourself away!"**
- **Kev Jones** (fictional), a short, bald car trader, turns up in his **pale blue 3 Series**, parks at the kerb,
  walks over to haggle with Craig, then drives off.
- Drop **either** of them and you unlock the **.50 CAL ANTI-MATERIEL**. It's semi-auto with an 8-round mag and
  zooms to 16x. It goes through bodies and cars, and anything it hits goes down. Swap with `1`/`2` or `Q`.
- They come back on later waves.
- Craig's voice works like the Keh: hit **🎙 RECORD CRAIG'S SHOUT** on the menu, or drop a `craig.mp3` into
  `public/`. Otherwise text-to-speech does it, using a Scottish voice if your system has one.

## Shooting the cars up

Every car can be wrecked, including the four on display inside the showroom:

- **Glass** cracks on the first hit and shatters on the second. Rounds carry on through, so you can shoot
  troops hiding behind a car through its windows.
- **Tyres** pop, and the car sags onto that corner.
- **Roof price boards** get shot clean off and tumble onto the tarmac.
- **Bodywork** keeps its bullet holes. A battered car starts smoking, then **explodes**, flips, burns and can
  set off the cars next to it.
- Alarms go off when cars get hit.

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
