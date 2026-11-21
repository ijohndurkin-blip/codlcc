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

Open the printed URL in a desktop browser (mouse and keyboard) or on a phone or tablet (touch controls).

## Deploy to Vercel

Import the repo in Vercel. It auto-detects Vite (`vercel.json` pins it anyway):

- Build command: `npm run build`
- Output directory: `dist`

## Playing on a phone

Phones and tablets get on-screen controls automatically. Play in landscape; you'll be prompted to turn the
phone sideways.

| Touch | Action |
| --- | --- |
| Left thumb (drag anywhere on the left) | Walk the rooftop |
| Right thumb (drag anywhere on the right) | Aim |
| FIRE | Shoot (keep your thumb on it and drag to aim as well) |
| SCOPE | Scope in / out (while scoped, the left stick does fine aiming instead of walking) |
| + / − and HOLD BREATH | Zoom and steady your aim (only shown while scoped) |
| CROUCH, R, SWAP | Duck behind the parapet, reload, change rifle |
| ❚❚ / ⛶ | Pause / full screen |

Tapping DEPLOY goes full screen and locks to landscape where the browser allows it. iPhone Safari can't
do full screen for web pages, so on iPhone use **Share → Add to Home Screen**, which opens the game without the
browser bars. Phones default to **GRAPHICS: LOW**, and you can raise it on the menu. The game pauses when you
switch apps.

## Controls (desktop)

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
| 1–5 / Q | Swap rifle (once unlocked) |
| Esc | Pause |
| F | Full screen |

## The "Keh"

On every kill the game says "Keh". It uses the first one of these it finds:

1. **Your own voice:** on the main menu hit **🎙 RECORD YOUR "KEH"** and say it into the mic.
   It's saved in your browser.
2. **A sound file:** drop a `keh.mp3` into `public/` before deploying.
3. **Text-to-speech** built into the browser.

## The cast (all fictional)

- **Craig**, the wee bald Scottish owner, comes out of the sliding showroom door now and again and shouts
  **"Get yourself away!"**
- **Kev Jones**, a short, bald car trader, turns up in his **pale blue 3 Series**, parks at the kerb, walks over to
  haggle with Craig, then drives off.
- **The mechanic from Merton Garages** (navy overalls) pulls up in a **black BMW X6** and walks into the
  showroom. He comes back out, gets in a car on the forecourt, drives it out onto the road and pulls up at
  the kerb. Then he gets out, waves a white sheet of paper in the air and shouts **"M-O-T done!"**. He walks
  back into the showroom, comes out again and drives off in the X6.
- **The valeter**, a bodybuilder, jet-washes a white Corsa outside the open shutter to the left of the showroom.

Kev and the mechanic take turns visiting. Kill Kev Jones and Craig rings Merton Garages: the mechanic turns
up a few seconds later. Anyone you drop comes back on a later wave.

## The rifle ladder

Every time you drop **Craig, Kev Jones or the mechanic** you move up one rifle. The valeter doesn't count.

| Key | Rifle | What it does |
| --- | --- | --- |
| 1 | L115 .338 bolt-action | Where you start. 5 rounds. |
| 2 | .50 cal anti-materiel | Semi-auto, 8 rounds, 16x zoom. Goes through bodies and cars. |
| 3 | .50 cal HE-I | Explosive rounds that blow up anything near where they land. |
| 4 | XR-9 railgun | Goes straight through walls, cars and people, with a blue beam. 20x zoom. |
| 5 | Golden railgun 'Get Yersel Away' | Railgun plus explosive impact. 12 rounds, 24x zoom. |

Swap with `1`–`5` or `Q`.

## Voices

The voices are recordable, or you can drop sound files into `public/`:

- `keh.mp3`: your kill line
- `craig.mp3`: "Get yourself away!"
- `mot.mp3`: "M-O-T done!"

All three also have **🎙 record** buttons on the menu (they work on phones too). Anything that isn't recorded or supplied
falls back to the browser's text-to-speech.

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

- **LOW** (default on phones): renders straight to the screen with no post-processing, no real-time
  shadows, no flash lights, simpler car paint, clouds and soldiers, and half the particles.
- **MEDIUM**: 1x resolution, 2K shadows, no bloom. For laptops and integrated GPUs.
- **HIGH** (default): up to 1.5x resolution, 4K shadows, bloom.
- **ULTRA**: up to 2x resolution plus GTAO ambient occlusion.
