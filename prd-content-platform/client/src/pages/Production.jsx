import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import StepUpload from '../steps/StepUpload.jsx';
import StepExtract from '../steps/StepExtract.jsx';
import StepAnalyze from '../steps/StepAnalyze.jsx';
import StepGenerate from '../steps/StepGenerate.jsx';
import StepDone from '../steps/StepDone.jsx';

const STEP_LABELS = ['上传', '提取', '解析', '生成', '完成'];

export default function Production() {
  const [searchParams] = useSearchParams();
  const fromPrd = searchParams.get('from') === 'prd';

  const [step, setStep] = useState(0);
  const [uploadData, setUploadData] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [allImages, setAllImages] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [generateResult, setGenerateResult] = useState(null);
  const [prdSource, setPrdSource] = useState(null);

  useEffect(() => {
    if (fromPrd) {
      try {
        const raw = sessionStorage.getItem('prd_analysis_result');
        if (raw) {
          const data = JSON.parse(raw);
          setPrdSource(data);
          setAnalysisResult(data);
          setStep(2);
          sessionStorage.removeItem('prd_analysis_result');
        }
      } catch { /* ignore */ }
    }
  }, [fromPrd]);

  return (
    <div>
      <h1 className="page-title">生产任务</h1>
      <p className="page-subtitle">
        {prdSource
          ? `来自 PRD "${prdSource.productLine || ''} ${prdSource.episode || ''} ${prdSource.theme || ''}" — 已跳过上传/提取，直接进入素材汇总`
          : '上传 PRD 文档，AI 自动解析并生成完整交互题素材包'}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28, justifyContent: 'center' }}>
        {STEP_LABELS.map((label, i) => (
          <React.Fragment key={i}>
            {i > 0 && (
              <div style={{
                width: 48, height: 2, borderRadius: 2,
                background: i <= step ? 'var(--primary)' : 'var(--border)',
                transition: 'background 0.3s',
              }} />
            )}
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
              background: i === step ? 'var(--primary)' : i < step ? 'var(--success)' : 'rgba(148,163,184,0.15)',
              color: i <= step ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.3s',
            }}>
              {i < step ? '\u2713' : i + 1}
            </div>
          </React.Fragment>
        ))}
      </div>

      <div className="glass-card">
        {step === 0 && <StepUpload onUploaded={(d) => { setUploadData(d); setStep(1); }} />}
        {step === 1 && <StepExtract uploadData={uploadData} onExtracted={(t, imgs) => { setExtractedText(t); setAllImages(imgs || []); setStep(2); }} onBack={() => setStep(0)} />}
        {step === 2 && <StepAnalyze text={extractedText} images={allImages} preloaded={prdSource ? analysisResult : null} onAnalyzed={(r) => { setAnalysisResult(r); setStep(3); }} onBack={() => prdSource ? null : setStep(1)} />}
        {step === 3 && <StepGenerate analysisResult={analysisResult} onGenerated={(r) => { setGenerateResult(r); setStep(4); }} onBack={() => setStep(2)} />}
        {step === 4 && <StepDone result={generateResult} onReset={() => { setStep(0); setUploadData(null); setExtractedText(''); setAllImages([]); setAnalysisResult(null); setGenerateResult(null); setPrdSource(null); }} />}
      </div>
    </div>
  );
}
