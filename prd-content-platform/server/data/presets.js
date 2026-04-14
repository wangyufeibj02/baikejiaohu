const CANVAS_W = 1624;
const CANVAS_H = 1050;

let _uid = 0;
function uid() { return 'pre_' + (++_uid).toString(36); }

function optionRow(count, y, w, h) {
  const gap = Math.min(120, (CANVAS_W - w * count) / (count + 1));
  const totalW = w * count + gap * (count - 1);
  const startX = Math.round((CANVAS_W - totalW) / 2);
  return Array.from({ length: count }, (_, i) => ({
    id: uid(), presetKey: 'option_image', label: `选项图${i + 1}`,
    type: 'rect', color: '#6366f1',
    x: startX + i * (w + gap), y, w, h,
  }));
}

function textRow(count, y, w, h, refOptions) {
  return Array.from({ length: count }, (_, i) => ({
    id: uid(), presetKey: 'text_label', label: `选项${String.fromCharCode(65 + i)}`,
    type: 'text', color: '#f59e0b',
    x: refOptions ? refOptions[i].x + Math.round((refOptions[i].w - w) / 2) : 0,
    y, w, h,
    textContent: `选项${String.fromCharCode(65 + i)}`, fontSize: 32, textColor: '#1e3a8a',
  }));
}

function audioRow(y, refOptions) {
  return refOptions.map((opt, i) => ({
    id: uid(), presetKey: 'audio_btn', label: `配音${i + 1}`,
    type: 'circle', color: '#22c55e',
    x: opt.x + Math.round((opt.w - 66) / 2), y, w: 66, h: 66,
  }));
}

function bg() {
  return {
    id: uid(), presetKey: 'bg_area', label: '背景',
    type: 'rect', color: '#94a3b8',
    x: 0, y: 0, w: CANVAS_W, h: CANVAS_H,
  };
}

function stemImage(x, y, w, h) {
  return {
    id: uid(), presetKey: 'stem_image', label: '题干图',
    type: 'rect', color: '#0ea5e9',
    x, y, w, h,
  };
}

function stemText(x, y, w, h, text = '题干文字') {
  return {
    id: uid(), presetKey: 'stem_text', label: '题干文字',
    type: 'text', color: '#0ea5e9',
    x, y, w, h,
    textContent: text, fontSize: 36, textColor: '#1e3a8a',
  };
}

// ─── 语音题干 × 图片选项 ────────────────────────────────

function audio_image_3() {
  const opts = optionRow(3, 280, 300, 300);
  return {
    name: '语音题干-图片3选项',
    questionType: 'choice', stemType: 'audio', optionStyle: 'image',
    variant: 'audio_image_3', optionCount: 3,
    description: '语音引导，3个图片选项',
    elements: [bg(), ...opts],
  };
}

function audio_image_4() {
  const w = 260, h = 230, gapX = 140, gapY = 50;
  const totalW = w * 2 + gapX;
  const startX = Math.round((CANVAS_W - totalW) / 2);
  const startY = 230;
  const positions = [
    [startX, startY], [startX + w + gapX, startY],
    [startX, startY + h + gapY], [startX + w + gapX, startY + h + gapY],
  ];
  const opts = positions.map(([x, y], i) => ({
    id: uid(), presetKey: 'option_image', label: `选项图${i + 1}`,
    type: 'rect', color: '#6366f1', x, y, w, h,
  }));
  return {
    name: '语音题干-图片4选项',
    questionType: 'choice', stemType: 'audio', optionStyle: 'image',
    variant: 'audio_image_4', optionCount: 4,
    description: '语音引导，2×2网格4个图片选项',
    elements: [bg(), ...opts],
  };
}

function audio_image_2() {
  const opts = optionRow(2, 280, 360, 360);
  return {
    name: '语音题干-图片2选项',
    questionType: 'choice', stemType: 'audio', optionStyle: 'image',
    variant: 'audio_image_2', optionCount: 2,
    description: '语音引导，2个大图选项',
    elements: [bg(), ...opts],
  };
}

// ─── 语音题干 × 文字选项 ────────────────────────────────

function audio_text_3() {
  const refX = [247, 612, 977];
  const w = 400, h = 100;
  const totalW = w * 3 + 110 * 2;
  const sx = Math.round((CANVAS_W - totalW) / 2);
  const opts = [0, 1, 2].map(i => ({
    id: uid(), presetKey: 'text_label', label: `选项${String.fromCharCode(65 + i)}`,
    type: 'text', color: '#f59e0b',
    x: sx + i * (w + 110), y: 380, w, h,
    textContent: `选项${String.fromCharCode(65 + i)}`, fontSize: 36, textColor: '#1e3a8a',
  }));
  return {
    name: '语音题干-文字3选项',
    questionType: 'choice', stemType: 'audio', optionStyle: 'text',
    variant: 'audio_text_3', optionCount: 3,
    description: '语音引导，3个纯文字选项',
    elements: [bg(), ...opts],
  };
}

function audio_text_4() {
  const w = 350, h = 100, gapX = 60, gapY = 40;
  const totalW = w * 2 + gapX;
  const sx = Math.round((CANVAS_W - totalW) / 2);
  const sy = 300;
  const positions = [
    [sx, sy], [sx + w + gapX, sy],
    [sx, sy + h + gapY], [sx + w + gapX, sy + h + gapY],
  ];
  const opts = positions.map(([x, y], i) => ({
    id: uid(), presetKey: 'text_label', label: `选项${String.fromCharCode(65 + i)}`,
    type: 'text', color: '#f59e0b', x, y, w, h,
    textContent: `选项${String.fromCharCode(65 + i)}`, fontSize: 34, textColor: '#1e3a8a',
  }));
  return {
    name: '语音题干-文字4选项',
    questionType: 'choice', stemType: 'audio', optionStyle: 'text',
    variant: 'audio_text_4', optionCount: 4,
    description: '语音引导，2×2布局4个纯文字选项',
    elements: [bg(), ...opts],
  };
}

// ─── 语音题干 × 图文选项 ────────────────────────────────

function audio_imageText_3() {
  const opts = optionRow(3, 280, 230, 230);
  const texts = textRow(3, 530, 230, 70, opts);
  return {
    name: '语音题干-图文3选项',
    questionType: 'choice', stemType: 'audio', optionStyle: 'imageText',
    variant: 'audio_imageText_3', optionCount: 3,
    description: '语音引导，3个图片+文字标签选项',
    elements: [bg(), ...opts, ...texts],
  };
}

function audio_imageText_3_audio() {
  const opts = optionRow(3, 240, 260, 230);
  const texts = textRow(3, 490, 260, 80, opts);
  const audios = audioRow(590, opts);
  return {
    name: '语音题干-图文3选项带配音',
    questionType: 'choice', stemType: 'audio', optionStyle: 'imageText',
    variant: 'audio_imageText_3_audio', optionCount: 3,
    description: '语音引导，3个图片+文字+配音按钮',
    elements: [bg(), ...opts, ...texts, ...audios],
  };
}

function audio_imageText_4() {
  const w = 260, h = 230, gapX = 160, gapY = 50;
  const totalW = w * 2 + gapX;
  const startX = Math.round((CANVAS_W - totalW) / 2);
  const startY = 220;
  const positions = [
    [startX, startY], [startX + w + gapX, startY],
    [startX, startY + h + gapY + 70], [startX + w + gapX, startY + h + gapY + 70],
  ];
  const opts = positions.map(([x, y], i) => ({
    id: uid(), presetKey: 'option_image', label: `选项图${i + 1}`,
    type: 'rect', color: '#6366f1', x, y, w, h,
  }));
  const texts = positions.map(([x, y], i) => ({
    id: uid(), presetKey: 'text_label', label: `选项${String.fromCharCode(65 + i)}`,
    type: 'text', color: '#f59e0b',
    x: x + Math.round((w - 200) / 2), y: y + h + 10, w: 200, h: 60,
    textContent: `选项${String.fromCharCode(65 + i)}`, fontSize: 30, textColor: '#1e3a8a',
  }));
  return {
    name: '语音题干-图文4选项',
    questionType: 'choice', stemType: 'audio', optionStyle: 'imageText',
    variant: 'audio_imageText_4', optionCount: 4,
    description: '语音引导，2×2网格4个图片+文字选项',
    elements: [bg(), ...opts, ...texts],
  };
}

// ─── 文字题干 × 图片选项 ────────────────────────────────

function text_image_3() {
  const stem = stemText(312, 200, 1000, 80, '请选择正确答案');
  const opts = optionRow(3, 350, 260, 260);
  return {
    name: '文字题干-图片3选项',
    questionType: 'choice', stemType: 'text', optionStyle: 'image',
    variant: 'text_image_3', optionCount: 3,
    description: '顶部文字题干，3个图片选项',
    elements: [bg(), stem, ...opts],
  };
}

function text_image_4() {
  const stem = stemText(312, 200, 1000, 80, '请选择正确答案');
  const w = 240, h = 240, gapX = 140, gapY = 40;
  const totalW = w * 2 + gapX;
  const sx = Math.round((CANVAS_W - totalW) / 2);
  const positions = [
    [sx, 320], [sx + w + gapX, 320],
    [sx, 320 + h + gapY], [sx + w + gapX, 320 + h + gapY],
  ];
  const opts = positions.map(([x, y], i) => ({
    id: uid(), presetKey: 'option_image', label: `选项图${i + 1}`,
    type: 'rect', color: '#6366f1', x, y, w, h,
  }));
  return {
    name: '文字题干-图片4选项',
    questionType: 'choice', stemType: 'text', optionStyle: 'image',
    variant: 'text_image_4', optionCount: 4,
    description: '顶部文字题干，2×2网格4个图片选项',
    elements: [bg(), stem, ...opts],
  };
}

// ─── 文字题干 × 文字选项 ────────────────────────────────

function text_text_3() {
  const stem = stemText(312, 200, 1000, 80, '请选择正确答案');
  const w = 350, h = 90, gap = 110;
  const totalW = w * 3 + gap * 2;
  const sx = Math.round((CANVAS_W - totalW) / 2);
  const opts = [0, 1, 2].map(i => ({
    id: uid(), presetKey: 'text_label', label: `选项${String.fromCharCode(65 + i)}`,
    type: 'text', color: '#f59e0b',
    x: sx + i * (w + gap), y: 420, w, h,
    textContent: `选项${String.fromCharCode(65 + i)}`, fontSize: 34, textColor: '#1e3a8a',
  }));
  return {
    name: '文字题干-文字3选项',
    questionType: 'choice', stemType: 'text', optionStyle: 'text',
    variant: 'text_text_3', optionCount: 3,
    description: '顶部文字题干，3个纯文字选项',
    elements: [bg(), stem, ...opts],
  };
}

// ─── 文字题干 × 图文选项 ────────────────────────────────

function text_imageText_3() {
  const stem = stemText(312, 200, 1000, 80, '请选择正确答案');
  const opts = optionRow(3, 340, 230, 200);
  const texts = textRow(3, 560, 230, 70, opts);
  return {
    name: '文字题干-图文3选项',
    questionType: 'choice', stemType: 'text', optionStyle: 'imageText',
    variant: 'text_imageText_3', optionCount: 3,
    description: '顶部文字题干，3个图片+文字选项',
    elements: [bg(), stem, ...opts, ...texts],
  };
}

// ─── 图片题干 × 图片选项 ────────────────────────────────

function image_image_3() {
  const stem = stemImage(462, 180, 700, 260);
  const opts = optionRow(3, 500, 230, 200);
  return {
    name: '图片题干-图片3选项',
    questionType: 'choice', stemType: 'image', optionStyle: 'image',
    variant: 'image_image_3', optionCount: 3,
    description: '顶部题干大图，下方3个图片选项',
    elements: [bg(), stem, ...opts],
  };
}

function image_image_side_3() {
  const stem = stemImage(120, 200, 600, 500);
  const opt1 = { id: uid(), presetKey: 'option_image', label: '选项图1', type: 'rect', color: '#6366f1', x: 820, y: 200, w: 230, h: 126 };
  const opt2 = { id: uid(), presetKey: 'option_image', label: '选项图2', type: 'rect', color: '#6366f1', x: 820, y: 386, w: 230, h: 126 };
  const opt3 = { id: uid(), presetKey: 'option_image', label: '选项图3', type: 'rect', color: '#6366f1', x: 820, y: 572, w: 230, h: 126 };
  const a1 = { id: uid(), presetKey: 'audio_btn', label: '配音1', type: 'circle', color: '#22c55e', x: 1060, y: 230, w: 66, h: 66 };
  const a2 = { id: uid(), presetKey: 'audio_btn', label: '配音2', type: 'circle', color: '#22c55e', x: 1060, y: 416, w: 66, h: 66 };
  const a3 = { id: uid(), presetKey: 'audio_btn', label: '配音3', type: 'circle', color: '#22c55e', x: 1060, y: 602, w: 66, h: 66 };
  return {
    name: '图片题干-左右布局3选项',
    questionType: 'choice', stemType: 'image', optionStyle: 'image',
    variant: 'image_image_side_3', optionCount: 3,
    description: '左侧大题干图 + 右侧3个竖排选项 + 配音',
    elements: [bg(), stem, opt1, opt2, opt3, a1, a2, a3],
  };
}

// ─── 图片题干 × 文字选项 ────────────────────────────────

function image_text_2() {
  const stem = stemImage(412, 180, 800, 300);
  const t1 = { id: uid(), presetKey: 'text_label', label: '选项A', type: 'text', color: '#f59e0b', x: 287, y: 560, w: 350, h: 80, textContent: '选项A', fontSize: 36, textColor: '#1e3a8a' };
  const t2 = { id: uid(), presetKey: 'text_label', label: '选项B', type: 'text', color: '#f59e0b', x: 987, y: 560, w: 350, h: 80, textContent: '选项B', fontSize: 36, textColor: '#1e3a8a' };
  const a1 = { id: uid(), presetKey: 'audio_btn', label: '配音1', type: 'circle', color: '#22c55e', x: 429, y: 670, w: 66, h: 66 };
  const a2 = { id: uid(), presetKey: 'audio_btn', label: '配音2', type: 'circle', color: '#22c55e', x: 1129, y: 670, w: 66, h: 66 };
  return {
    name: '图片题干-文字2选项',
    questionType: 'choice', stemType: 'image', optionStyle: 'text',
    variant: 'image_text_2', optionCount: 2,
    description: '顶部大题干图 + 2个文字选项 + 配音',
    elements: [bg(), stem, t1, t2, a1, a2],
  };
}

// ─── 图片题干 × 图文选项 ────────────────────────────────

function image_imageText_3() {
  const stem = stemImage(462, 180, 700, 260);
  const opts = optionRow(3, 500, 230, 200);
  const texts = textRow(3, 720, 230, 70, opts);
  return {
    name: '图片题干-图文3选项',
    questionType: 'choice', stemType: 'image', optionStyle: 'imageText',
    variant: 'image_imageText_3', optionCount: 3,
    description: '顶部题干大图 + 下方3个图片+文字选项',
    elements: [bg(), stem, ...opts, ...texts],
  };
}

function image_imageText_4() {
  const stem = stemImage(462, 180, 700, 200);
  const w = 230, h = 180, gapX = 120, gapY = 30;
  const totalW = w * 2 + gapX;
  const sx = Math.round((CANVAS_W - totalW) / 2);
  const sy = 420;
  const positions = [
    [sx, sy], [sx + w + gapX, sy],
    [sx, sy + h + gapY + 50], [sx + w + gapX, sy + h + gapY + 50],
  ];
  const opts = positions.map(([x, y], i) => ({
    id: uid(), presetKey: 'option_image', label: `选项图${i + 1}`,
    type: 'rect', color: '#6366f1', x, y, w, h,
  }));
  const texts = positions.map(([x, y], i) => ({
    id: uid(), presetKey: 'text_label', label: `选项${String.fromCharCode(65 + i)}`,
    type: 'text', color: '#f59e0b',
    x: x + Math.round((w - 180) / 2), y: y + h + 5, w: 180, h: 50,
    textContent: `选项${String.fromCharCode(65 + i)}`, fontSize: 28, textColor: '#1e3a8a',
  }));
  return {
    name: '图片题干-图文4选项',
    questionType: 'choice', stemType: 'image', optionStyle: 'imageText',
    variant: 'image_imageText_4', optionCount: 4,
    description: '顶部题干图 + 2×2网格4个图文选项',
    elements: [bg(), stem, ...opts, ...texts],
  };
}

// ─── Export ─────────────────────────────────────────────

export function getAllPresets() {
  _uid = 0;
  return [
    // 语音题干
    audio_image_2(),
    audio_image_3(),
    audio_image_4(),
    audio_text_3(),
    audio_text_4(),
    audio_imageText_3(),
    audio_imageText_3_audio(),
    audio_imageText_4(),
    // 文字题干
    text_image_3(),
    text_image_4(),
    text_text_3(),
    text_imageText_3(),
    // 图片题干
    image_image_3(),
    image_image_side_3(),
    image_text_2(),
    image_imageText_3(),
    image_imageText_4(),
  ];
}

export const STEM_TYPES = [
  { key: 'audio', label: '语音题干' },
  { key: 'text', label: '文字题干' },
  { key: 'image', label: '图片题干' },
  { key: 'free', label: '自由操作区' },
];

export const OPTION_STYLES = [
  { key: 'image', label: '图片选项' },
  { key: 'text', label: '文字选项' },
  { key: 'imageText', label: '图文选项' },
];

export const CONFIG_KEY_MAP = {
  option_image: 'options',
  stem_image: 'guidePictures',
  stem_text: 'guidePictures',
  audio_btn: 'audioPictures',
  bg_area: 'normalBackgroundPictures',
  collide_zone: 'collides',
  animation_area: 'startAnimations',
};
