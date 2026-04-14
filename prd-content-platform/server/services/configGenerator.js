import { join, dirname } from 'path';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TPL_DIR = join(__dirname, '..', '..', 'data', 'templates');

function loadTemplate(id) {
  if (!id) return null;
  const fp = join(TPL_DIR, `${id}.json`);
  return existsSync(fp) ? JSON.parse(readFileSync(fp, 'utf-8')) : null;
}

const PRESET_TO_CONFIG = {
  option_image: 'options',
  stem_image: 'guidePictures',
  audio_btn: 'audioPictures',
  bg_area: 'normalBackgroundPictures',
  collide_zone: 'collides',
  animation_area: 'startAnimations',
};

function rect(name, x, y, w, h) {
  return { name, x, y, height: h, width: w };
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

function buildConfigFromTemplate(question, tpl) {
  const config = emptyConfig();
  if (!tpl || !tpl.elements) return config;

  const qId = question.id;
  const els = tpl.elements;
  const options = question.options || [];

  const optionEls = els.filter(e => e.presetKey === 'option_image' || (e.label || '').includes('选项图'));
  const stemEls = els.filter(e => e.presetKey === 'stem_image' || (e.label || '').includes('题干'));
  const audioEls = els.filter(e => e.presetKey === 'audio_btn' || (e.label || '').includes('配音'));
  const bgEls = els.filter(e => e.presetKey === 'bg_area' || (e.label || '').includes('背景'));
  const collideEls = els.filter(e => e.presetKey === 'collide_zone' || (e.label || '').includes('碰撞'));
  const animEls = els.filter(e => e.presetKey === 'animation_area' || (e.label || '').includes('动效'));

  bgEls.forEach((el, i) => {
    config.normalBackgroundPictures.push(rect(`${qId}_bg${i > 0 ? '_' + (i + 1) : ''}`, el.x, el.y, el.w, el.h));
  });

  stemEls.forEach((el, i) => {
    config.guidePictures.push(rect(`${qId}_stem${i > 0 ? '_' + (i + 1) : ''}`, el.x, el.y, el.w, el.h));
  });

  optionEls.forEach((el, i) => {
    const label = options[i]?.label || String.fromCharCode(65 + i);
    config.options.push(rect(`${qId}_option_${label}`, el.x, el.y, el.w, el.h));
  });

  audioEls.forEach((el, i) => {
    config.audioPictures.push(rect(`${qId}_audio_${i + 1}`, el.x, el.y, el.w, el.h));
  });

  collideEls.forEach((el, i) => {
    config.collides.push(rect(`${qId}_collide_${i + 1}`, el.x, el.y, el.w, el.h));
  });

  animEls.forEach((el, i) => {
    config.startAnimations.push(rect(`${qId}_anim_${i + 1}`, el.x, el.y, el.w, el.h));
  });

  const images = question.assets?.images || [];
  for (const img of images) {
    if (img.source === '_state_variant' && img.stateType === 'selected') {
      const baseOpt = config.options.find(o => o.name === img.baseImageName);
      if (baseOpt) {
        config.selectedImages.push(rect(img.name, baseOpt.x, baseOpt.y, baseOpt.width, baseOpt.height));
      }
    }
    if (img.source === '_state_variant' && img.stateType === 'correct') {
      const baseOpt = config.options.find(o => o.name === img.baseImageName);
      if (baseOpt) {
        config.rightImages.push(rect(img.name, baseOpt.x, baseOpt.y, baseOpt.width, baseOpt.height));
      }
    }
  }

  const hasCorrectAnim = question.assets?.animations?.some(a => a.name.includes('correct'));
  if (hasCorrectAnim) {
    config.endBackgroundPictures.push(rect(`${qId}_bg_right`, 0, 0, tpl.canvasWidth || 1624, tpl.canvasHeight || 1050));
  }

  return config;
}

function fallbackConfig(question) {
  const config = emptyConfig();
  const qId = question.id;
  const options = question.options || [];

  config.normalBackgroundPictures.push(rect(`${qId}_bg`, 12, -146, 1624, 1050));

  options.forEach((opt, i) => {
    const x = 347 + i * 350;
    config.options.push(rect(`${qId}_option_${opt.label}`, x, 118, 230, 230));
    config.audioPictures.push(rect(`${qId}_audio_${i + 1}`, x + 102, 645, 66, 66));
  });

  const images = question.assets?.images || [];
  for (const img of images) {
    if (img.source === '_state_variant' && img.stateType === 'selected') {
      const baseOpt = config.options.find(o => o.name === img.baseImageName);
      if (baseOpt) {
        config.selectedImages.push(rect(img.name, baseOpt.x, baseOpt.y, baseOpt.width, baseOpt.height));
      }
    }
    if (img.source === '_state_variant' && img.stateType === 'correct') {
      const baseOpt = config.options.find(o => o.name === img.baseImageName);
      if (baseOpt) {
        config.rightImages.push(rect(img.name, baseOpt.x, baseOpt.y, baseOpt.width, baseOpt.height));
      }
    }
  }

  return config;
}

export async function generateConfigs(analysisResult, taskDir) {
  const results = [];
  const questions = analysisResult.questions || analysisResult.epics?.flatMap(e => e.questions) || [];

  for (const question of questions) {
    const qDir = join(taskDir, question.id.replace(/\./g, '-'));
    mkdirSync(qDir, { recursive: true });

    const tpl = loadTemplate(question.templateId);
    const config = tpl ? buildConfigFromTemplate(question, tpl) : fallbackConfig(question);

    const configPath = join(qDir, 'config.json');
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

    results.push({
      questionId: question.id,
      type: question.type,
      path: configPath,
      status: 'done',
    });
  }

  return results;
}
