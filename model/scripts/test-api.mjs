const arr = JSON.stringify([
  [0, 0, 0, 0, 0],
  [0, 1, 1, 1, 0],
  [0, 1, 0, 1, 0],
  [0, 1, 1, 1, 0],
  [0, 0, 0, 0, 0],
]);

const form = new FormData();
form.append('notation', 's');
form.append('arr', arr);

const detect = await fetch('http://localhost:3000/msd/detect', { method: 'POST', body: form });
console.log('detect', detect.status, await detect.json());

const trainForm = new FormData();
trainForm.append('notation', 's');
trainForm.append('arr', arr);
trainForm.append('label', '5');

const train = await fetch('http://localhost:3000/msd/train', { method: 'POST', body: trainForm });
console.log('train', train.status, await train.json());
