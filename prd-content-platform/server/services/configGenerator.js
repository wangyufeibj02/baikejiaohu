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
    controlWidgets: [],
  };
}

function buildConfigFromTemplate(question, tpl) {
  const config = emptyConfig();
  if (!tpl || !tpl.elements) return config;

  const safeTop = tpl.safeTop || 0;

  const els = tpl.elements;
  const images = question.assets?.images || [];
  const audios = question.assets?.audios || [];
  const animations = question.assets?.animations || [];

  const optionEls = els.filter(e => e.presetKey === 'option_image' || (e.label || '').includes('选项图'));
  const stemEls = els.filter(e => e.presetKey === 'stem_image' || e.presetKey === 'stem_text' || (e.label || '').includes('题干'));
  const audioEls = els.filter(e => e.presetKey === 'audio_btn' || (e.label || '').includes('配音'));
  const bgEls = els.filter(e => e.presetKey === 'bg_area' || (e.label || '').includes('背景'));
  const collideEls = els.filter(e => e.presetKey === 'collide_zone' || (e.label || '').includes('碰撞'));
  const animEls = els.filter(e => e.presetKey === 'animation_area' || ((e.label || '').includes('动效') && e.presetKey !== 'anim_cover' && e.presetKey !== 'control_widget'));
  const coverEl = els.find(e => e.presetKey === 'anim_cover');
  const textLabelEls = els.filter(e => e.presetKey === 'text_label');

  const normalImages = images.filter(img => img.source !== '_state_variant');
  const bgImages = normalImages.filter(img => img.name.startsWith('bg'));
  const optionImages = normalImages.filter(img => img.name.match(/^option\d+$/));

  stemEls.forEach((el, i) => {
    const bgImg = bgImages[i];
    config.normalBackgroundPictures.push(rect(bgImg ? bgImg.name : `bg${i + 1}`, el.x, el.y - safeTop, el.w, el.h));
  });

  const optSizeEls = optionEls.length > 0 ? optionEls : textLabelEls;
  optSizeEls.forEach((el, i) => {
    const optImg = optionImages[i];
    const name = optImg ? optImg.name : `option${i + 1}`;
    if (optImg?.cardSize && optImg?.normalStateConfig) {
      const [cw, ch] = optImg.cardSize.split('x').map(Number);
      const expand = (optImg.normalStateConfig.borderGap || 0) + (optImg.normalStateConfig.borderWidth || 0);
      config.options.push(rect(name, el.x - expand, el.y - expand - safeTop, cw, ch));
    } else {
      config.options.push(rect(name, el.x, el.y - safeTop, el.w, el.h));
    }
  });

  audioEls.forEach((el, i) => {
    const aud = audios[i];
    config.audioPictures.push(rect(aud ? aud.name : `audio${i + 1}`, el.x, el.y - safeTop, el.w, el.h));
  });

  collideEls.forEach((el, i) => {
    config.collides.push(rect(`collide${i + 1}`, el.x, el.y - safeTop, el.w, el.h));
  });

  const ANIM_TYPE_TO_CONFIG = { opening: 'startAnimations', wrong: 'wrongAnimations' };
  for (const anim of animations) {
    if (anim.animType === 'correct') continue;
    const animEl = animEls[0];
    if (!animEl) continue;
    let ax = animEl.x, aw = animEl.w;
    if (coverEl) {
      const lp = Math.max(0, animEl.x - coverEl.x);
      const rp = Math.max(0, (coverEl.x + coverEl.w) - (animEl.x + animEl.w));
      if (lp > 0 || rp > 0) {
        ax = animEl.x - lp;
        aw = lp + animEl.w + rp;
      }
    }
    const targetArr = ANIM_TYPE_TO_CONFIG[anim.animType] || 'startAnimations';
    config[targetArr].push(rect(anim.name, ax, animEl.y - safeTop, aw, animEl.h));
  }

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

  const hasRightAnim = animations.some(a => a.animType === 'correct');
  if (hasRightAnim) {
    const firstBg = bgImages[0];
    const ref = coverEl || animEls[0] || stemEls[0];
    if (ref) {
      config.endBackgroundPictures.push(rect(firstBg ? `${firstBg.name}_right` : 'bg1_right', ref.x, Math.round(ref.y - safeTop), ref.w, Math.round(ref.h)));
    }
  }

  const WIDGET_CONFIG_MAP = { audio: 'audioPictures' };
  const widgets = question.assets?.controlWidgets || [];
  for (const w of widgets) {
    const targetKey = WIDGET_CONFIG_MAP[w.widgetName] || w.widgetConfigKey || 'controlWidgets';
    const arr = config[targetKey] || config.controlWidgets;
    arr.push(rect(w.name, w.x, w.y - safeTop, w.w, w.h));
  }

  return config;
}

function fallbackConfig(question) {
  const config = emptyConfig();
  const options = question.options || [];
  const images = question.assets?.images || [];
  const audios = question.assets?.audios || [];

  const normalImages = images.filter(img => img.source !== '_state_variant');
  const bgImages = normalImages.filter(img => img.name.startsWith('bg'));
  const optionImages = normalImages.filter(img => img.name.match(/^option\d+$/));

  if (bgImages.length > 0) {
    config.normalBackgroundPictures.push(rect(bgImages[0].name, 12, -146, 1624, 1050));
  }

  options.forEach((opt, i) => {
    const x = 347 + i * 350;
    const optName = optionImages[i]?.name || `option${i + 1}`;
    config.options.push(rect(optName, x, 118, 230, 230));
    const audName = audios[i]?.name || `audio${i + 1}`;
    config.audioPictures.push(rect(audName, x + 102, 645, 66, 66));
  });

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
