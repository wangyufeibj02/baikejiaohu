import React, { useState } from 'react';
import StepUpload from '../steps/StepUpload.jsx';
import StepExtract from '../steps/StepExtract.jsx';
import StepAnalyze from '../steps/StepAnalyze.jsx';
import StepGenerate from '../steps/StepGenerate.jsx';
import StepDone from '../steps/StepDone.jsx';

const STEP_LABELS = ['上传', '提取', '解析', '生成', '完成'];

export default function Production() {
  const [step, setStep] = useState(0);
  const [uploadData, setUploadData] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [allImages, setAllImages] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [generateResult, setGenerateResult] = useState(null);

  return (
    <div className="app">
      <div className="steps">
        {STEP_LABELS.map((label, i) => (
          <React.Fragment key={i}>
            {i > 0 && <div className={`step-connector${i <= step ? ' done' : ''}`} />}
            <div className={`step-dot${i === step ? ' active' : ''}${i < step ? ' done' : ''}`} title={label}>
              {i < step ? '\u2713' : i + 1}
            </div>
          </React.Fragment>
        ))}
      </div>
      {step === 0 && <StepUpload onUploaded={d => { setUploadData(d); setStep(1); }} />}
      {step === 1 && <StepExtract uploadData={uploadData} onExtracted={(t, imgs) => { setExtractedText(t); setAllImages(imgs || []); setStep(2); }} onBack={() => setStep(0)} />}
      {step === 2 && <StepAnalyze text={extractedText} images={allImages} onAnalyzed={r => { setAnalysisResult(r); setStep(3); }} onBack={() => setStep(1)} />}
      {step === 3 && <StepGenerate analysisResult={analysisResult} onGenerated={r => { setGenerateResult(r); setStep(4); }} onBack={() => setStep(2)} />}
      {step === 4 && <StepDone result={generateResult} onReset={() => { setStep(0); setUploadData(null); setExtractedText(''); setAllImages([]); setAnalysisResult(null); setGenerateResult(null); }} />}
    </div>
  );
}
