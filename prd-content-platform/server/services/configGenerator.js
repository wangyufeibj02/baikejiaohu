import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { CONFIG_KEY_MAP } from '../data/presets.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TPL_DIR = join(__dirname, '..', '..', 'data', 'templates');

function loadTemplate(id) {
  const p = join(TPL_DIR, `${id}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; }
}

function rect(name, x, y, w, h, extra) {
  return { name, x, y, height: h, width: w, ...extra };
}

function emptyConfig() {
  return {
    finals: [], options: [], curtains: [], collides: [],
    normalBackgroundPictures: [], startBackgroundPictures: [], endBackgroundPictures: [],
    audioPictures: [], guidePictures: [],
    freeBgs: [], freeOptions: [], freeCollides: [], freeFinals: [],
    selectedImages: [], rightImages: [],
    startAnimations: [], endAnimations: [], wrongAnimations: [],
  };
}

function normRadius(br) {
  if (br == null) return 0;
  if (typeof br === 'number') return br;
  if (typeof br === 'object') return Math.max(br.tl || 0, br.tr || 0, br.br || 0, br.bl || 0);
  return 0;
}

function buildConfigFromTemplate(tpl, question) {
  const config = emptyConfig();
  const elements = tpl.elements || [];
  const optionStates = tpl.optionStates;

  const animAreaEl = elements.find(e => e.presetKey === 'animation_area');
  const animCoverEl = elements.find(e => e.presetKey === 'anim_cover');

  let animLeftPad = 0;
  let animTotalWidth = 0;
  if (animAreaEl && animCoverEl) {
    animLeftPad = animAreaEl.x - animCoverEl.x;
    animTotalWidth = animCoverEl.w;
  }

  let optionIndex = 0;

  for (const el of elements) {
    if (el.presetKey === 'anim_cover') continue;

    const configKey = CONFIG_KEY_MAP[el.presetKey];
    if (!configKey) continue;

    const br = normRadius(el.borderRadius);

    if (el.presetKey === 'animation_area') {
      const x = animCoverEl ? el.x - animLeftPad : el.x;
      const w = animCoverEl ? animTotalWidth : el.w;
      config[configKey].push(rect(el.label || el.presetKey, x, el.y, w, el.h, { borderRadius: br }));
    } else if (el.presetKey === 'option_image') {
      const optLabel = String.fromCharCode(65 + optionIndex);
      const qId = question.id;
      config[configKey].push(rect(`${qId}_option_${optLabel}`, el.x, el.y, el.w, el.h, { borderRadius: br }));
      optionIndex++;
    } else {
      const name = el.presetKey === 'stem_image' || el.presetKey === 'stem_text'
        ? `${question.id}_stem`
        : el.label || el.presetKey;
      config[configKey].push(rect(name, el.x, el.y, el.w, el.h, { borderRadius: br }));
    }
  }

  // State variant images: selectedImages / rightImages
  if (optionStates) {
    const optionEls = elements.filter(e => e.presetKey === 'option_image');
    const textEls = elements.filter(e => e.presetKey === 'text_label');
    const qId = question.id;

    for (let i = 0; i < optionEls.length; i++) {
      const optLabel = String.fromCharCode(65 + i);
      const optEl = optionEls[i];
      const textEl = textEls[i];

      const groupEls = [optEl, textEl].filter(Boolean);
      const groupW = Math.max(...groupEls.map(e => e.w));
      const minY = Math.min(...groupEls.map(e => e.y));
      const maxYH = Math.max(...groupEls.map(e => e.y + e.h));
      const groupH = maxYH - minY;
      const minX = Math.min(...groupEls.map(e => e.x));
      const gap = optionStates.selected?.borderGap || optionStates.correct?.borderGap || 0;
      const bw = optionStates.selected?.borderWidth || optionStates.correct?.borderWidth || 0;
      const expand = gap + bw;

      if (optionStates.selected) {
        config.selectedImages.push(rect(
          `${qId}_option_${optLabel}_selected`,
          minX - expand, minY - expand,
          groupW + expand * 2, groupH + expand * 2,
        ));
      }

      const correctLabels = (question.correctAnswer || '').split(/[、,]/).map(s => s.trim());
      if (optionStates.correct && correctLabels.includes(optLabel)) {
        config.rightImages.push(rect(
          `${qId}_option_${optLabel}_correct`,
          minX - expand, minY - expand,
          groupW + expand * 2, groupH + expand * 2,
        ));
      }
    }
  }

  return config;
}

// Fallback hardcoded layout
function fallbackConfig(question) {
  const config = emptyConfig();
  config.normalBackgroundPictures.push(rect('bg', 12, -146, 1624, 1050));
  config.options = [
    rect('option1', 347, 118, 230, 230),
    rect('option2', 697, 118, 230, 230),
    rect('option3', 1047, 118, 230, 230),
  ];
  config.audioPictures = [
    rect('audio1', 449, 645, 66, 66),
    rect('audio2', 779, 645, 66, 66),
    rect('audio3', 1109, 645, 66, 66),
  ];
  return config;
}

export async function generateConfigs(analysisResult, taskDir) {
  const results = [];
  const questions = analysisResult.questions || analysisResult.epics?.flatMap(e => e.questions) || [];

  for (const question of questions) {
    const qDir = join(taskDir, question.id.replace(/\./g, '-'));
    mkdirSync(qDir, { recursive: true });

    let config;
    const tpl = question.templateId ? loadTemplate(question.templateId) : null;

    if (tpl && tpl.elements?.length > 0) {
      config = buildConfigFromTemplate(tpl, question);
    } else {
      config = fallbackConfig(question);
    }

    const configPath = join(qDir, 'config.json');
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

    results.push({
      questionId: question.id,
      type: question.type,
      templateId: question.templateId || null,
      path: configPath,
      status: 'done',
    });
  }

  return results;
}
