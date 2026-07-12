const API_BASE = 'http://127.0.0.1:8005';

export function getApiBase() {
  return API_BASE;
}

export async function postDetect(file) {
  const form = new FormData();
  form.append('file', file);

  const response = await fetch(`${API_BASE}/detect`, {
    method: 'POST',
    body: form,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || response.statusText || '识别失败');
  }
  return data;
}

export async function postSample(file, className) {
  const form = new FormData();
  form.append('file', file);
  form.append('class_name', className);

  const response = await fetch(`${API_BASE}/samples`, {
    method: 'POST',
    body: form,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || response.statusText || '保存失败');
  }
  return data;
}
