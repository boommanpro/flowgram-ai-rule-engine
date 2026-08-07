/**
 * API 配置管理
 * 统一管理 API 基础地址的获取逻辑
 * 支持运行时通过 localStorage 配置（用于 GitHub Pages 部署 + 自定义后端场景）
 */

export const getApiBaseUrl = (): string => {
  // 1. 优先从 localStorage 获取用户设置的服务器地址
  const storedApiBaseUrl = localStorage.getItem('apiBaseUrl');
  if (storedApiBaseUrl) {
    return storedApiBaseUrl;
  }

  // 2. 开发环境（rsbuild dev server port 3000）使用相对路径，由代理转发
  if (typeof window !== 'undefined' && window.location.port === '3000') {
    return '/api';
  }

  // 3. 生产环境默认本地后端
  return 'http://127.0.0.1:48080/api';
};

// 用于动态更新 API 基础 URL 的函数
export const updateApiBaseUrl = (newBaseUrl: string): void => {
  localStorage.setItem('apiBaseUrl', newBaseUrl);
};

// 获取完整的 API 端点 URL
export const getApiEndpoint = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl();
  if (baseUrl.endsWith('/') && endpoint.startsWith('/')) {
    return baseUrl + endpoint.substring(1);
  } else if (!baseUrl.endsWith('/') && !endpoint.startsWith('/')) {
    return `${baseUrl}/${endpoint}`;
  } else {
    return baseUrl + endpoint;
  }
};

/**
 * 生成可直接用于 curl 的绝对 URL（含协议 + 主机 + 端口）。
 * 当 getApiBaseUrl 返回相对路径（如 /api）时，使用当前页面的 location.origin 补全。
 * 用于导出链接 / curl 命令等需要在浏览器外部执行的场景。
 */
export const getAbsoluteApiUrl = (path: string): string => {
  const base = getApiBaseUrl();
  if (base.startsWith('http://') || base.startsWith('https://')) {
    // 已是绝对路径，直接拼接
    if (base.endsWith('/') && path.startsWith('/')) {
      return base + path.slice(1);
    } else if (!base.endsWith('/') && !path.startsWith('/')) {
      return `${base}/${path}`;
    }
    return base + path;
  }
  // 相对路径（如 /api），使用当前页面 origin 补全
  const origin = typeof window !== 'undefined' && window.location
    ? window.location.origin
    : 'http://127.0.0.1:3000';
  const normalizedBase = base.startsWith('/') ? base : `/${base}`;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return origin + normalizedBase + (normalizedBase.endsWith('/') && normalizedPath.startsWith('/')
    ? normalizedPath.slice(1)
    : normalizedPath);
};
