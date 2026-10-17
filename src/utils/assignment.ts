import { ChallengeTabId, EqSectionId, EQ_LEVELS, MyMix, StudentSubmission } from '../types/audio';
import { SCENARIOS } from '../components/ScenarioChallenges';
import { REFERENCE_PROFILES } from '../components/MatchTheMix';
import { WHAT_CHANGED_QUESTIONS } from '../components/WhatChanged';
import { MY_MIX_MIN_WORDS } from '../components/MyMix';

/**
 * Assignments travel inside the link the teacher posts in Google Classroom,
 * e.g. mrkamiski.com/mixerlab?a=swy&t=Unit+3. Nothing is stored anywhere:
 * the link holds the teacher's choices, the submission code holds the student's work.
 *
 * Letters: s = Scenarios, w = What Changed?, m = Match the Mix, y = My Mix, l = Learn (Mixer Academy),
 *          f = EQ Wizard: Freq Tone ID, b = EQ Wizard: Freq Band ID, t = EQ Wizard: Freq Tweak
 * No ?a= in the link means everything is assigned.
 */
export type AssignmentItem = ChallengeTabId | 'learn' | EqSectionId;

export interface Assignment {
  items: AssignmentItem[];
  title: string;
}

export const ASSIGNMENT_ITEMS: { id: AssignmentItem; letter: string; label: string }[] = [
  { id: 'learn', letter: 'l', label: 'Mixer Academy (Learn)' },
  { id: 'scenarios', letter: 's', label: 'Scenarios' },
  { id: 'whatchanged', letter: 'w', label: 'What Changed?' },
  { id: 'match', letter: 'm', label: 'Match the Mix' },
  { id: 'mymix', letter: 'y', label: 'My Mix' },
  { id: 'freqid', letter: 'f', label: 'Freq Tone ID' },
  { id: 'freqband', letter: 'b', label: 'Freq Band ID' },
  { id: 'freqtweak', letter: 't', label: 'Freq Tweak' }
];

export const EVERYTHING: Assignment = { items: ASSIGNMENT_ITEMS.map((i) => i.id), title: '' };

export function itemsToLetters(items: AssignmentItem[]): string {
  return ASSIGNMENT_ITEMS.filter((i) => items.includes(i.id)).map((i) => i.letter).join('');
}

export function lettersToItems(letters: string): AssignmentItem[] {
  return ASSIGNMENT_ITEMS.filter((i) => letters.includes(i.letter)).map((i) => i.id);
}

/** Read the assignment from the page's link (or everything, if the link has none). */
export function readAssignmentFromUrl(search: string = window.location.search): Assignment {
  const params = new URLSearchParams(search);
  const letters = params.get('a');
  if (!letters) return EVERYTHING;
  const items = lettersToItems(letters.toLowerCase());
  if (items.length === 0) return EVERYTHING;
  return { items, title: (params.get('t') || '').slice(0, 60) };
}

export function buildAssignmentLink(assignment: Assignment, base: string = window.location.origin + window.location.pathname): string {
  const params = new URLSearchParams();
  params.set('a', itemsToLetters(assignment.items));
  if (assignment.title.trim()) params.set('t', assignment.title.trim().slice(0, 60));
  return `${base}?${params.toString()}`;
}

export const isEverything = (a: Assignment) => a.items.length === ASSIGNMENT_ITEMS.length;

export function assignmentName(a: Assignment): string {
  if (a.title) return a.title;
  if (isEverything(a)) return 'Everything';
  return ASSIGNMENT_ITEMS.filter((i) => a.items.includes(i.id)).map((i) => i.label.replace(' (Learn)', '')).join(' + ');
}

// ---------- Grading ----------
const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

/** Average of the best score on every reference mix (references not attempted count as 0). */
export function matchAverage(matchScores: Record<string, number>): number {
  if (matchScores.legacy !== undefined) return matchScores.legacy; // older codes stored a single score
  if (REFERENCE_PROFILES.length === 0) return 0;
  const sum = REFERENCE_PROFILES.reduce((acc, p) => acc + (matchScores[p.id] || 0), 0);
  return Math.round(sum / REFERENCE_PROFILES.length);
}

/** Grade for Match the Mix: each reference earns 50% for trying it plus half its best match score. */
export function matchGrade(matchScores: Record<string, number>): number {
  if (matchScores.legacy !== undefined) return Math.round(50 + matchScores.legacy / 2);
  if (REFERENCE_PROFILES.length === 0) return 0;
  const sum = REFERENCE_PROFILES.reduce((acc, p) => acc + (matchScores[p.id] !== undefined ? 50 + matchScores[p.id] / 2 : 0), 0);
  return Math.round(sum / REFERENCE_PROFILES.length);
}

export interface GradePart {
  id: AssignmentItem;
  label: string;
  percent: number;
  detail: string;
}

/** Each assigned part is scored 0-100; the grade is an even split across assigned parts. */
export function computeGrade(
  scores: StudentSubmission['scores'],
  myMix: MyMix | null | undefined,
  assignment: Assignment
): { total: number; parts: GradePart[] } {
  const parts: GradePart[] = [];
  for (const item of ASSIGNMENT_ITEMS) {
    if (!assignment.items.includes(item.id)) continue;
    switch (item.id) {
      case 'learn':
        parts.push({ id: 'learn', label: item.label, percent: scores.learnCompleted ? 100 : 0, detail: scores.learnCompleted ? 'Completed' : 'Not completed' });
        break;
      case 'scenarios': {
        const pts = SCENARIOS.reduce((a, sc) => a + Math.min(100, scores.scenarios[sc.id] || 0), 0);
        const solved = SCENARIOS.filter((sc) => (scores.scenarios[sc.id] || 0) >= 100).length;
        parts.push({ id: 'scenarios', label: item.label, percent: Math.round((pts / (SCENARIOS.length * 100)) * 100), detail: `${solved}/${SCENARIOS.length} solved` });
        break;
      }
      case 'whatchanged':
        parts.push({ id: 'whatchanged', label: item.label, percent: Math.round((scores.whatChanged / WHAT_CHANGED_QUESTIONS) * 100), detail: `Best ${scores.whatChanged}/${WHAT_CHANGED_QUESTIONS}` });
        break;
      case 'match':
        {
          const tried = scores.matchScores.legacy !== undefined ? 1 : REFERENCE_PROFILES.filter((p) => scores.matchScores[p.id] !== undefined).length;
          const total = scores.matchScores.legacy !== undefined ? 1 : REFERENCE_PROFILES.length;
          parts.push({
            id: 'match',
            label: item.label,
            percent: matchGrade(scores.matchScores),
            detail: `${tried}/${total} tried · ${matchAverage(scores.matchScores)}% average match`
          });
        }
        break;
      case 'freqid':
      case 'freqband':
      case 'freqtweak': {
        const levels = scores.eqWizard?.[item.id] ?? Array(EQ_LEVELS).fill(-1);
        const tried = levels.filter((x) => x >= 0).length;
        const avg = levels.reduce((a, x) => a + Math.max(0, x), 0) / EQ_LEVELS;
        parts.push({ id: item.id, label: item.label, percent: Math.round(avg), detail: `${tried}/${EQ_LEVELS} levels tried` });
        break;
      }
      case 'mymix': {
        // Auto-scored on completion: a mix plus a written explanation of at least MY_MIX_MIN_WORDS words.
        // The teacher still listens and can adjust.
        const words = myMix ? countWords(myMix.explanation) : 0;
        parts.push({
          id: 'mymix',
          label: item.label,
          percent: myMix ? Math.round(Math.min(1, words / MY_MIX_MIN_WORDS) * 100) : 0,
          detail: myMix ? `${words} words written` : 'Not started'
        });
        break;
      }
    }
  }
  const total = parts.length ? Math.round(parts.reduce((a, p) => a + p.percent, 0) / parts.length) : 0;
  return { total, parts };
}
