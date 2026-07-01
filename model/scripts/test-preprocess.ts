import {
  padToSquare,
  parseArr,
  preprocessTo96,
  trimWhiteBorders,
} from '../lib/preprocess';

async function main() {
  // 5×7 矩阵，中间 3×3 为笔画(1)，外围为背景(0)
  const arr = [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0, 0, 0],
    [0, 1, 1, 1, 0, 0, 0],
    [0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
  ];

  const matrix = parseArr(arr);
  console.log('parsed stroke at center:', matrix[2][2]); // expect ~0

  const trimmed = trimWhiteBorders(matrix);
  console.log('trimmed size:', trimmed[0].length, 'x', trimmed.length);

  const squared = padToSquare(trimmed);
  console.log('squared size:', squared[0].length, 'x', squared.length);

  const out = await preprocessTo96(matrix, 'arr');
  console.log('output size:', out.length, 'x', out[0].length);
  console.log('corner (bg):', out[0][0], 'center:', out[48][48]);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
