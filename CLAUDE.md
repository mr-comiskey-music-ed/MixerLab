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
- Deployed on Vercel at its own mrcomiskey.com subdomain. Work on a
  branch and don't push to main unless I say so.
- Touch screens must clearly separate swipe-to-scroll from
  touch-and-drag on knobs.

## Structure
- Top tabs are color-coded. A "Challenges" tab holds sub-tabs:
  Scenarios, What Changed?, Match the Mix, My Mix (more may come).
  "EQ Wizard" is its own top tab next to Challenges. Grade Report is last.
- Teachers assign challenges by whole challenge type. Unassigned ones
  are hidden from students. Grade is an even split across what's
  assigned (weighting may change later). EQ Wizard's three sections
  are assignable separately.
- Scenarios: target 10 total, easy ones first (panning, "show too loud").
- What Changed?: 8 questions, uses the Quack song. Its three synth
  tracks sound alike, so changes must be big or hinted.
- Match the Mix: blind A/B (switch target vs own mix without seeing
  changes). More reference examples may come.
- My Mix: students explain their choices in text.
- One-knob orange compressor under the gain knob with an
  off/green/yellow/red light, with its own Learn step.

## EQ Wizard
Three sections, each 6 levels x 8 questions:
- FreqID: identify sine tones via translucent answer boxes over a
  31-band EQ (level 5 uses a 10-band EQ).
- FreqBandID: identify boosted/cut bands in EQ'd music clips with an
  original/altered toggle. 3-band, then 5-band answers, with
  vocabulary like Punch/Boom and Warmth/Mud.
- FreqTweak: match an example using the app's channel EQ (analog for
  Q1-4, digital for Q5-8). Was too hard: 50% score floor "to start",
  and multi-change questions change only 2 bands.
- Graphic EQs (10-band, 31-band) are on the mains only, in a fold-out
  panel, and usable elsewhere too.
- Uses only the two recorded songs for now. The new dry-stem song is
  excluded. Free's Vox Dbl/Ad Lib stem is removed as a clip option
  (already over-accentuated in the mids).
- Based partly on the FreqHero ear-training site. ISO Frequencies and
  Parametric EQ levels were dropped.

## Songs
- Six set-in-stone songs: Card Game (Indie; default and the
  challenge/Scenarios song), Free (Hip Hop), Give My Heart, Tubular,
  Summertime (Afrobeat), Quack (Funk Groove). Floating is dropped.
- Channel order: drums, other percussion, bass, chords/pads/synths/
  guitars; anything labelled melody goes on channel 6. No _TrackName
  suffix in channel labels.
- Summertime track 5 is "Ear Candy" (plucked synth + pitched vocal stab).
- Card Game's acoustic guitar track has heavy vocal bleed and could
  look mislabeled. Note it wherever that stem matters.
- Channel EQ shelf corners: LOW 120 Hz / HIGH 8 kHz app-wide; LOW
  150 Hz / HIGH 6 kHz in FreqTweak. EQ changes should be obvious even
  on poor listening devices.

## Grading
- Grade Report has no "Anti-Tamper" wording and no Class Period/Student
  ID input.
- Total grade colors: 0-59% red, 60-84% yellow, 85-100% green.
- Teacher batch grading parses codes out of a pasted whole Google
  Classroom page (names, returns, other text), like SynthLab.

## Design
- Teal is dropped. Level-meter colors (green, yellow, red) are the
  primary colors. Don't use red/green where text could read as
  correct/incorrect.
- Logo font for headers; courier-style body font; small
  function-over-form console lettering.

## Wanted, not confirmed done (check the repo first)
- New song of raw/dry 6-stem tracks (I supply the stems) so the FX
  loop and My Mix are more creative; later maybe dry-stem challenges
  (compression, reverb, bad EQ)
- Replace the funk song in EQ Wizard
- Anything above that isn't in the app yet

## Working style
Start from the teaching goal, then shape features around it. Suggest
ideas and angles before building. Ask before big changes.
