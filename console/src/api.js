export function buildUrl(apiBase, path) {
  const base = (apiBase || '').trim().replace(/\/$/, '');
  return `${base}${path}`;
}

/**
 * @param {string} apiBase
 * @param {'detect'|'train'} mode
 * @param {object} options
 * @param {'s'|'n'} options.notation
 * @param {File|null} options.file
 * @param {string} options.arrText
 * @param {number|undefined} options.label
 * @param {number|undefined} options.lr
 */
export async function postMsd(apiBase, mode, options) {
  const { notation, file, arrText, label, lr } = options;
  const form = new FormData();
  form.append('notation', notation);

  const arrTrimmed = (arrText || '').trim();
  if (arrTrimmed) {
    JSON.parse(arrTrimmed);
    form.append('arr', arrTrimmed);
  } else if (file) {
    form.append('file', file);
  } else {
    throw new Error('请上传 file 或填写 arr');
  }

  if (mode === 'train') {
    if (label === undefined || label === null || label === '') {
      throw new Error('train 必须选择 label');
    }
    form.append('label', String(label));
    if (lr !== undefined && lr !== null && lr !== '') {
      form.append('lr', String(lr));
    }
  }

  const response = await fetch(buildUrl(apiBase, `/msd/${mode}`), {
    method: 'POST',
    body: form,
  });

  const data = await response.json();
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || response.statusText || '请求失败');
  }
  return data;
}
