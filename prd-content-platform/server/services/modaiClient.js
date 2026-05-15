/**
 * 魔搭 AI 平台统一 API 客户端
 * 封装 27 个接口的调用逻辑
 */

const BASE = 'https://conan-modai-studio.zhenguanyu.com/conan-modai-studio/api/web/ai';
const API_KEY = process.env.OPENAI_API_KEY;

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY}`,
  };
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || '请求失败');
  return data;
}

async function postSSE(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const results = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('event: ')) {
        const eventType = line.substring(7);
        const dataLine = lines[i + 1];
        if (dataLine && dataLine.startsWith('data: ')) {
          const eventData = JSON.parse(dataLine.substring(6));
          if (eventType === 'image') results.push(eventData.data.imageUrl);
          if (eventType === 'error') throw new Error(eventData.data.error);
          i++;
        }
      }
    }
  }
  return results;
}

async function postBinary(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '请求失败');
  }
  return Buffer.from(await res.arrayBuffer());
}

async function getJson(url) {
  const res = await fetch(url, { headers: headers() });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || '查询失败');
  return data;
}

async function pollUntilDone(pollFn, intervalMs = 8000, timeoutMs = 300000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await pollFn();
    if (result.status === 'COMPLETED') return result;
    if (result.status === 'FAILED') throw new Error(result.error || '任务失败');
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('任务超时');
}

// ── 图片生成 ──

export async function doubaoTextToImage(prompt, width, height) {
  const urls = await postSSE(`${BASE}/doubao/text-to-image`, {
    prompt,
    parameters: { width, height },
  });
  return urls[0];
}

export async function geminiTextToImage(prompt, aspectRatio = '1:1', imageSize = '2K') {
  const res = await postJson(`${BASE}/gemini/text-to-image`, {
    prompt,
    parameters: { aspectRatio, imageSize, sampleCount: 1 },
  });
  return res.data.resultFiles[0];
}

export async function doubaoImageToImage(prompt, inputFileUrls, width, height) {
  const urls = await postSSE(`${BASE}/doubao/image-to-image`, {
    prompt,
    inputFileUrls,
    parameters: { width, height },
  });
  return urls[0];
}

export async function geminiImageToImage(prompt, inputFileUrls, aspectRatio = '1:1') {
  const res = await postJson(`${BASE}/gemini/image-to-image`, {
    prompt,
    inputFileUrls,
    parameters: { aspectRatio, sampleCount: 1 },
  });
  return res.data.resultFiles[0];
}

function gptSafeSize(w, h) {
  const pixels = w * h;
  const MIN_PX = 655360, MAX_PX = 8294400, MAX_SIDE = 3839;
  if (pixels >= MIN_PX && pixels <= MAX_PX && w < MAX_SIDE && h < MAX_SIDE) return `${w}x${h}`;
  const ratio = w / h;
  if (ratio > 1.3) return '1536x1024';
  if (ratio < 0.77) return '1024x1536';
  return '1024x1024';
}

export async function gptTextToImage(prompt, width, height) {
  const res = await postJson(`${BASE}/azure-openai/text-to-image`, {
    prompt,
    model: 'gpt-image-2',
    parameters: { size: gptSafeSize(width, height), quality: 'medium', numImages: 1 },
  });
  return res.data.resultFiles[0];
}

export async function gptImageToImage(prompt, inputFileUrls, width, height) {
  const res = await postJson(`${BASE}/azure-openai/image-to-image`, {
    prompt,
    inputFileUrls,
    model: 'gpt-image-2',
    parameters: { size: gptSafeSize(width, height), quality: 'medium', numImages: 1 },
  });
  return res.data.resultFiles[0];
}

// ── 视频生成 ──

export async function veoTextToVideo(prompt, opts = {}) {
  const res = await postJson(`${BASE}/veo3/text-to-video`, {
    prompt,
    parameters: {
      aspectRatio: opts.aspectRatio || '16:9',
      duration: opts.duration || 4,
      resolution: opts.resolution || '720p',
    },
  });
  const { taskId, metadata } = res.data;

  return pollUntilDone(async () => {
    const poll = await postJson(`${BASE}/veo3/poll-operation`, {
      operationName: metadata.operationName,
      taskId,
    });
    return {
      status: poll.data.status,
      url: poll.data.resultFiles?.[0]?.url,
      error: poll.data.error,
    };
  });
}

export async function soraTextToVideo(prompt, opts = {}) {
  const res = await postJson(`${BASE}/sora/text-to-video`, {
    prompt,
    parameters: {
      size: opts.size || '1280x720',
      seconds: opts.seconds || 4,
    },
  });
  const { taskId, metadata } = res.data;

  return pollUntilDone(async () => {
    const poll = await postJson(`${BASE}/sora/poll-video`, {
      videoId: metadata.videoId,
      taskId,
    });
    return {
      status: poll.data.status,
      url: poll.data.downloadUrl,
      error: poll.data.error,
    };
  });
}

export async function seedanceTextToVideo(prompt, opts = {}) {
  const res = await postJson(`${BASE}/seedance/text-to-video`, {
    prompt,
    parameters: {
      aspect_ratio: opts.aspectRatio || '16:9',
      duration: opts.duration || 4,
      resolution: opts.resolution || '720p',
      with_audio: opts.withAudio ?? false,
    },
  });
  const { taskId } = res.data;

  return pollUntilDone(async () => {
    const poll = await postJson(`${BASE}/seedance/poll-task`, { taskId });
    return {
      status: poll.data.status,
      url: poll.data.resultFiles?.[0],
      error: poll.data.error,
    };
  });
}

export async function seedanceImageToVideo(prompt, inputFileUrls, opts = {}) {
  const res = await postJson(`${BASE}/seedance/image-to-video`, {
    prompt,
    inputFileUrls,
    parameters: {
      aspect_ratio: opts.aspectRatio || '16:9',
      duration: opts.duration || 4,
      resolution: opts.resolution || '720p',
      with_audio: opts.withAudio ?? false,
    },
  });
  const { taskId } = res.data;

  return pollUntilDone(async () => {
    const poll = await postJson(`${BASE}/seedance/poll-task`, { taskId });
    return {
      status: poll.data.status,
      url: poll.data.resultFiles?.[0],
      error: poll.data.error,
    };
  });
}

// ── 语音合成 ──

export async function doubaoTTS(text, voiceName = 'zh_female_vv_uranus_bigtts', opts = {}) {
  const res = await postJson(`${BASE}/doubao/text-to-speech`, {
    text,
    voiceName,
    speechRate: opts.speechRate ?? 0,
    volume: opts.volume ?? 0,
    advanced: opts.advanced,
  });
  return res.data.resultFiles[0];
}

export async function minimaxTTS(text, voiceId = 'male-qn-qingse') {
  const res = await postJson(`${BASE}/minimax/text-to-speech`, {
    text,
    voice_setting: { voice_id: voiceId },
  });
  return res.data.resultFiles[0];
}

export async function minimaxTTSStream(text, opts = {}) {
  return postBinary(`${BASE}/minimax/text-to-speech-stream`, {
    text,
    voiceId: opts.voiceId || 'male-qn-qingse',
    format: opts.format || 'mp3',
    speed: opts.speed,
    vol: opts.vol,
  });
}

export async function geminiTTS(text, voiceName = 'Kore') {
  const res = await postJson(`${BASE}/gemini/text-to-speech`, {
    text,
    voiceName,
    model: 'flash',
  });
  return res.data.resultFiles[0];
}

export async function azureTTS(text, voiceName, opts = {}) {
  const res = await postJson(`${BASE}/azure/text-to-speech`, {
    text,
    voiceName,
    parameters: opts,
  });
  return res.data.resultFiles[0];
}

const TTSHUB_URL = 'https://speech-inner.yuanfudao.com/apeman-tts-hub/api/v1/tts';

export async function ttsHubTTS(text, speaker = 'xiaoyuan', opts = {}) {
  const body = {
    requestId: `prd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    appKey: 'test',
    appId: 'test',
    text,
    speaker,
    withTimestamps: false,
    audioFormat: { audioType: 'mp3', sampleRate: 24000 },
    expressFeatures: {
      speechRatio: opts.speechRatio ?? 1.0,
      volumeRatio: opts.volumeRatio ?? 1.0,
    },
  };
  const res = await fetch(TTSHUB_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.status !== 0) throw new Error(`TTS Hub error ${data.status}: ${data.message || 'unknown'}`);
  return Buffer.from(data.audioContent.audioHexString, 'hex');
}

// ── 文本生成（借助 analyze-media 端点 + 占位图片） ──

let _placeholderUri = null;
async function getPlaceholderUri() {
  if (_placeholderUri) return _placeholderUri;
  const { createCanvas } = await import('canvas');
  const cvs = createCanvas(64, 64);
  const ctx = cvs.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 64, 64);
  const imgBuf = cvs.toBuffer('image/png');

  const uploadRes = await postJson(`${BASE}/gemini/upload-media`, {
    fileName: 'placeholder.png',
    mimeType: 'image/png',
    fileSize: imgBuf.length,
  });
  const putRes = await fetch(uploadRes.data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: imgBuf,
  });
  if (!putRes.ok) throw new Error('占位图上传失败');
  _placeholderUri = uploadRes.data.fileUri;
  return _placeholderUri;
}

export async function geminiChat(prompt, opts = {}) {
  const model = opts.model || 'gemini-2.5-flash';
  const fileUri = await getPlaceholderUri();
  const res = await postJson(`${BASE}/gemini/analyze-media`, {
    fileUri,
    mimeType: 'image/png',
    prompt: '忽略图片内容。' + prompt,
    model,
    stream: false,
  });
  return res.data?.analysis || res.data?.text || '';
}

// ── 辅助 ──

export async function reversePrompt(imageUrl) {
  const res = await postJson(`${BASE}/gemini/reverse-prompt`, { imageUrl });
  return res.prompt;
}

export async function downloadFile(url) {
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
}

export async function uploadFileToCloud(buffer, fileName, mimeType) {
  const uploadRes = await postJson(`${BASE}/gemini/upload-media`, {
    fileName, mimeType, fileSize: buffer.length,
  });
  const putRes = await fetch(uploadRes.data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: buffer,
  });
  if (!putRes.ok) throw new Error('文件上传云端失败');
  return uploadRes.data.fileUri;
}
