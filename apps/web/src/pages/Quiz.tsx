import { useEffect, useState } from 'react';

import { Notice } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../lib/api';
import { formatNumber } from '../lib/format';
import { useDocumentTitle } from '../lib/hooks';

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
}

interface QuizResponse {
  question: QuizQuestion;
  alreadyAnswered: boolean;
  wasCorrect: boolean | null;
  explanation: string | null;
}

export function Quiz() {
  useDocumentTitle('مسابقهٔ روزانه');
  const { setUser } = useAuth();
  const [data, setData] = useState<QuizResponse | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [tokens, setTokens] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<QuizResponse>('/api/quiz/today')
      .then((r) => {
        setData(r);
        setAnswered(r.alreadyAnswered);
        setCorrect(r.wasCorrect);
        setExplanation(r.explanation);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const answer = async () => {
    if (selected === null || !data || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await api<{ correct: boolean; explanation: string; tokensEarned: number; balance: number }>('/api/quiz/answer', {
        method: 'POST',
        json: { questionId: data.question.id, answerIndex: selected },
      });
      setCorrect(r.correct);
      setExplanation(r.explanation);
      setTokens(r.tokensEarned);
      setAnswered(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const question = data?.question;

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <header className="stack-sm">
        <h1>مسابقهٔ روزانه 🎯</h1>
        <p className="muted">هر روز یک سوال دربارهٔ تغذیه؛ جواب درست +۱۰ ژتون، مشارکت +۱ ژتون.</p>
      </header>

      {error && <Notice tone="error">{error}</Notice>}

      {!question && !error && <p className="muted">در حال بارگذاری…</p>}

      {question && !answered && (
        <div className="card stack">
          <h2 style={{ fontSize: 'var(--text-lg)' }}>{question.question}</h2>
          <div className="stack-sm">
            {question.options.map((opt, i) => (
              <button
                key={i}
                className={`quiz-option ${selected === i ? 'selected' : ''}`}
                onClick={() => setSelected(i)}
              >
                <span className="quiz-letter">{String.fromCharCode(65 + i)}</span>
                {opt}
              </button>
            ))}
          </div>
          <button className="btn btn-lg" onClick={answer} disabled={selected === null || busy}>
            {busy ? 'در حال بررسی…' : 'ثبت جواب'}
          </button>
        </div>
      )}

      {answered && (
        <div className="card stack">
          <div style={{ fontSize: 48 }}>{correct ? '🎉' : '💪'}</div>
          <h2>{correct ? 'جواب درست است!' : 'اشکال ندارد، فردا دوباره'}</h2>
          {explanation && <p className="muted">{explanation}</p>}
          {tokens > 0 && <p style={{ color: 'var(--gold)' }}><strong>+{formatNumber(tokens)} ژتون گرفتید!</strong></p>}
          <a className="btn btn-secondary" href="/club">برو به باشگاه</a>
        </div>
      )}
    </div>
  );
}
