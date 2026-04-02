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

// ── 辅助 ──

export async function reversePrompt(imageUrl) {
  const res = await postJson(`${BASE}/gemini/reverse-prompt`, { imageUrl });
  return res.prompt;
}

export async function downloadFile(url) {
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
}
