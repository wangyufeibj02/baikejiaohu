import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

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

function rect(name, x, y, w, h) {
  return { name, x, y, height: h, width: w };
}

function singleChoice3(question) {
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
  const hasAnimation = question.assets?.animations?.length > 0;
  if (hasAnimation) {
    config.endBackgroundPictures.push(rect('bg_right', 0, -150, 1624, 1050));
  }
  return config;
}

function multiChoice3(question) {
  return singleChoice3(question);
}

function dragDrop3(question) {
  const config = emptyConfig();
  config.normalBackgroundPictures.push(rect('bg', 12, -146, 1624, 1050));
  config.finals = [
    rect('final1', 347, 118, 230, 230),
    rect('final2', 697, 118, 230, 230),
    rect('final3', 1047, 118, 230, 230),
  ];
  config.options = [
    rect('option1', 347, 404, 230, 230),
    rect('option2', 697, 405, 230, 230),
    rect('option3', 1047, 405, 230, 230),
  ];
  config.collides = [
    rect('collide1', 347, 118, 230, 230),
    rect('collide2', 697, 118, 230, 230),
    rect('collide3', 1047, 118, 230, 230),
  ];
  config.audioPictures = [
    rect('audio1', 449, 645, 66, 66),
    rect('audio2', 779, 645, 66, 66),
    rect('audio3', 1109, 645, 66, 66),
  ];
  return config;
}

function getTemplateForQuestion(question) {
  switch (question.type) {
    case 'singleChoice': return singleChoice3(question);
    case 'multiChoice': return multiChoice3(question);
    case 'dragDrop': return dragDrop3(question);
    default: return singleChoice3(question);
  }
}

export async function generateConfigs(analysisResult, taskDir) {
  const results = [];
  const questions = analysisResult.questions || analysisResult.epics?.flatMap(e => e.questions) || [];

  for (const question of questions) {
    const qDir = join(taskDir, question.id.replace(/\./g, '-'));
    mkdirSync(qDir, { recursive: true });

    const config = getTemplateForQuestion(question);
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
