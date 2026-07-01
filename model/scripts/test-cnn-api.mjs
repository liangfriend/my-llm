const arr = JSON.stringify([
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 1, 1, 0, 0, 0],
  [0, 1, 0, 0, 1, 0, 0],
  [0, 0, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
]);

const detectForm = new FormData();
detectForm.append('notation', 's');
detectForm.append('arr', arr);

console.log('detect...');
const t0 = Date.now();
const detect = await fetch('http://localhost:3000/msd/detect', { method: 'POST', body: detectForm });
console.log('detect', detect.status, await detect.json(), `${Date.now() - t0}ms`);

const trainForm = new FormData();
trainForm.append('notation', 's');
trainForm.append('arr', arr);
trainForm.append('label', '20');
trainForm.append('lr', '0.001');

console.log('train...');
const t1 = Date.now();
const train = await fetch('http://localhost:3000/msd/train', { method: 'POST', body: trainForm });
console.log('train', train.status, await train.json(), `${Date.now() - t1}ms`);
