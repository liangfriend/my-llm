// base 时值映射
const baseMap= {
    512: "1n",
    256: "2n",
    128: "4n",
    64: "8n",
    32: "16n",
    16: "32n",
    8: "64n",
    4: "128n",
    2: "256n",
    1: "512n",
}

function findDuration(chronaxie) {
    // 遍历所有 base
    for (const base of Object.keys(baseMap).map(Number)) {
        // 允许尝试 0~4 个附点（够用了）
        for (let dots = 0; dots <= 4; dots++) {
            const factor = 2 - 1 / Math.pow(2, dots)
            const approx = base * factor

            // 如果两者足够接近就算匹配
            if (Math.abs(approx - chronaxie) < 1e-3) {
                const suffix = dots ? ".".repeat(dots) : ""
                return baseMap[base] + suffix
            }
        }
    }
    throw new Error("unknown chronaxie: " + chronaxie)
}

export function melodyToToneSeq(melody) {
  return (melody || [])
    .filter(({ midi }) => Number(midi) !== 0)
    .map(({ midi, chronaxie }) => ({
      midi,
      duration: findDuration(chronaxie),
    }));
}

/** 将二维样本 melody 展平为单句，便于播放预览 */
export function flattenSampleMelody(sampleMelody) {
  if (!Array.isArray(sampleMelody)) return [];
  if (sampleMelody.length && Array.isArray(sampleMelody[0])) {
    return sampleMelody.flat();
  }
  return sampleMelody;
}