import { join } from 'path';
import { writeFileSync } from 'fs';

export async function generateMetadata(analysisResult, taskDir, generatedAssets) {
  const { images, audios, animations, configs } = generatedAssets;
  const questions = analysisResult.questions || analysisResult.epics?.flatMap(e => e.questions) || [];

  const summary = questions.map(q => ({
    questionId: q.id,
    type: q.type,
    stem: q.stem,
    correctAnswers: q.correctAnswers,
    imageCount: images.filter(i => i.questionId === q.id).length,
    audioCount: audios.filter(a => a.questionId === q.id).length,
    animationCount: animations.filter(a => a.questionId === q.id).length,
    configStatus: configs.find(c => c.questionId === q.id)?.status || 'unknown',
  }));
  writeFileSync(join(taskDir, '题目汇总.json'), JSON.stringify(summary, null, 2), 'utf-8');

  const checklist = [
    ...images.map(i => ({ type: 'image', id: `${i.questionId}/${i.name}.png`, status: i.status, error: i.error })),
    ...audios.map(a => ({ type: 'audio', id: `${a.questionId}/${a.name}.mp3`, text: a.text, status: a.status, error: a.error })),
    ...animations.map(a => ({ type: 'animation', id: `${a.questionId}/${a.name}.apng`, description: a.description, status: a.status, error: a.error })),
    ...configs.map(c => ({ type: 'config', id: `${c.questionId}/config.json`, status: c.status })),
  ];
  writeFileSync(join(taskDir, '资源清单.json'), JSON.stringify(checklist, null, 2), 'utf-8');

  return {
    summaryCount: summary.length,
    checklistTotal: checklist.length,
    checklistDone: checklist.filter(c => c.status === 'done').length,
    checklistFailed: checklist.filter(c => c.status === 'failed').length,
  };
}
