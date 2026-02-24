export function toErrorText(err, fallback = '请求失败') {
  const raw = String(err?.message || err || '');
  if (!raw) return fallback;

  if (raw.includes('403')) return '权限不足，请检查 token / 角色';
  if (raw.includes('404')) return '资源不存在或 projectId 不匹配';
  if (raw.includes('Need role')) return '当前账号角色不满足操作要求';
  if (raw.includes('fetch')) return '网络连接失败，请检查 BaseURL';

  return raw.slice(0, 120);
}
