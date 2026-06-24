import { NPlayer, activeContext, startJPlayer } from '@jsh/j-player';
import { piano } from '../../../music-score/packages/j-player/example/toneColor.ts';

const TONE_COLOR_NAME = 'piano';

/** melody chronaxie(512=全) → j-player duration(256=全) */
export function chronaxieToDuration(chronaxie) {
  return Math.max(1, Math.round(Number(chronaxie) / 2));
}

/** 一维 melody → j-player Sequence（每组一个音符） */
export function melodyToJPlayerSequence(melody) {
  return (melody || [])
    .filter(note => Number(note.midi) !== 0)
    .map(note => [
      {
        midi: Number(note.midi),
        duration: chronaxieToDuration(note.chronaxie),
        toneColor: TONE_COLOR_NAME,
      },
    ]);
}

let player = null;
let playerReady = false;

async function ensurePlayer() {
  if (playerReady && player) {
    return player;
  }
  startJPlayer();
  await activeContext();
  player = new NPlayer({ checkTime: 50, checkDuration: 500 });
  await player.addToneColor(TONE_COLOR_NAME, piano);
  player.bpm = 120;
  player.rate = 1;
  player.loop = false;
  playerReady = true;
  return player;
}

export async function playMelody(melody) {
  const list = melodyToJPlayerSequence(melody);
  if (!list.length) {
    throw new Error('没有可播放的音符');
  }
  const nPlayer = await ensurePlayer();
  nPlayer.stop();
  nPlayer.setSequence(list);
  await nPlayer.play();
}

export async function stopMelody() {
  if (!player) return;
  player.stop();
}
