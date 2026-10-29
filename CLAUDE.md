# MixerLab

## Purpose
A mixing console simulator (modeled on a Mackie mixer). Students learn
what each control does, then train their ears and make mixing decisions
on purpose. Drills are the means; the goal is students mixing with
intention and explaining their choices.

## Hard rules
- Never store student data of any kind, not even names. No backend.
- Students show work with a base64 code pasted into Google Classroom.
- Must run well on Chromebooks and stay lightweight. Screen space on
  small screens is a real constraint.
- Deployed on Vercel at mixerlab.mrcomiskey.com. Work on a
  branch and don't push to main unless I say so.
- Touch screens must clearly separate swipe-to-scroll from
  touch-and-drag on knobs. A hold-to-grab fix (swipe scrolls, hold then
  drag turns) is on the `touch-hold-to-grab` branch, not yet merged.

## Tech
- Vite + React 19 + TypeScript + Tailwind v4. `npm run dev` (port 3000),
  `npm run build`, `npm run lint` (tsc type check). No tests.
- Songs: `src/audio/songs.ts`; stems in `public/audio/`.
- EQ Wizard clips are pre-cut into `public/eq/` and listed in
  `public/eq/clips.json`. Rebuild with `bun scripts/make-eq-clips.ts`
  (needs ffmpeg) after changing songs or stem trims.
- Started in Google AI Studio; its leftover files have been removed.

## Structure
- Top tabs, colored like a level meter (green → yellow → orange → red):
  Learn and Mix Console (green), Challenges (yellow), EQ Wizard
  (orange), Grade Report (red, last).
- Challenges sub-tabs: Scenarios, What Changed?, Match the Mix, My Mix
  (more may come).
- Teachers build an assignment link in Grade Report (`?a=` letters,
  `?t=` title); nothing is stored. Assignable items: Learn (Mixer
  Academy), each challenge type, and each EQ Wizard section separately.
  Unassigned ones are hidden from students. Grade is an even split
  across what's assigned (weighting may change later).
- Scenarios: 10, easy ones first (panning, "show too loud"). Written
  around Card Game.
- What Changed?: 8 questions, uses the Quack song. Its synth tracks
  sound alike, so changes must be big or hinted.
- Match the Mix: blind A/B (switch hidden reference A vs own mix B).
  Three references: Free, Give My Heart, Summertime. More may come.
- My Mix: students explain their choices in text (minimum word count).
- One-knob orange compressor under the gain knob with an
  off/green/yellow/red light, with its own Learn step.

## EQ Wizard
Three sections, each 6 levels x 8 questions:
- Freq Tone ID: identify sine tones via translucent answer boxes over
  a 31-band EQ. Levels 1-4 use named regions, level 5 a 10-band EQ,
  level 6 the 31-band.
- Freq Band ID: identify boosted/cut bands in EQ'd music clips with an
  original/altered toggle. Levels 1-4 are 3-band, 5-6 are 5-band with
  vocabulary like Punch/Boom and Warmth/Mud.
- Freq Tweak: match an example using the app's channel EQ (analog for
  Q1-4, digital for Q5-8). Finishing a level earns 50%, the other 50%
  is accuracy. Questions 7-8 change 2 bands.
- Graphic EQs (10-band, 31-band) are on the mains only, in a fold-out
  panel; EQ Wizard reuses the same component.
- Clips come from all six songs, Quack included. Free's Vox Dbl/Ad Lib
  stem is excluded from Freq Tweak (already over-accentuated in the
  mids). Tubular skips its filtered intro.
- Based partly on the FreqHero ear-training site. ISO Frequencies and
  Parametric EQ levels were dropped.

## Songs
- Six set-in-stone songs, in dropdown order: Card Game (Indie; default,
  used by Learn and Scenarios), Free (Hip Hop), Give My Heart (Rock),
  Tubular (Hip Hop beat), Summertime (Afrobeat), Quack (Funk Groove).
  Dropdown titles include artist credits where known.
- Floating is dropped, and its stems are deleted.
- Channel order: drums, other percussion, bass, chords/pads/synths/
  guitars; anything labelled melody goes on channel 6. No _TrackName
  suffix in channel labels. About 13 characters fit on the digital
  console.
- Summertime track 5 is "Ear Candy" (plucked synth + pitched vocal stab).
- Card Game's acoustic guitar track has heavy vocal bleed and could
  look mislabeled. Note it wherever that stem matters (the Condenser
  Mic scenario already does).
- Channel EQ shelf corners: LOW 120 Hz / HIGH 8 kHz app-wide; LOW
  150 Hz / HIGH 6 kHz in Freq Tweak (`src/audio/eqCorners.ts`). EQ
  changes should be obvious even on poor listening devices.

## Grading
- Grade Report has no "Anti-Tamper" wording and no Class Period/Student
  ID input.
- Total grade colors: 0-59% red, 60-84% yellow, 85-100% green.
- Teacher batch grading parses codes (they start with `ML3`) out of a
  pasted whole Google Classroom page (names, returns, other text), like
  SynthLab.

## Design
- Teal is dropped as an accent. Level-meter colors (green, yellow,
  orange, red) are the primary colors. Don't use red/green where text
  could read as correct/incorrect. Teal is fine on the MID SWEEP / MID
  GAIN knobs and channel colors, where the digital EQ view needs
  blue-adjacent colors.
- Fonts: Barlow Condensed for headings and tabs (the logo's font),
  JetBrains Mono for body text and console lettering, Plus Jakarta Sans
  for short description lines. Small function-over-form console
  lettering.

## Wanted, not done yet
- Merge the `touch-hold-to-grab` branch once tested on a touch device

## Working style
Start from the teaching goal, then shape features around it. Suggest
ideas and angles before building. Ask before big changes.
