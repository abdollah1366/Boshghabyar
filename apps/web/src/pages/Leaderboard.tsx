import { useEffect, useState } from 'react';

import { Icon } from '../components/Icon';
import { PageSkeleton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../lib/api';
import { formatNumber } from '../lib/format';
import { useDocumentTitle } from '../lib/hooks';

interface Entry {
  rank: number;
  name: string;
  points: number;
  level: string;
}

export function Leaderboard() {
  useDocumentTitle('برترین‌ها');
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ leaderboard: Entry[] }>('/api/leaderboard')
      .then((r) => setEntries(r.leaderboard))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <div className="page">
      <header className="stack-sm">
        <h1>برترین‌ها 🏆</h1>
        <p className="muted">کاربرانی که بیشترین ژتون را کسب کرده‌اند. با ثبت وعده‌ها، مسابقه و دعوت دوستان، خودتان هم بالا بیایید.</p>
      </header>

      {error && <p className="error">{error}</p>}
      {!entries && !error && <PageSkeleton />}

      <div className="stack-sm">
        {entries?.map((e) => {
          const isMe = user?.name === e.name;
          const medal = e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `#${e.rank}`;
          return (
            <div key={e.rank} className={`card row between ${isMe ? 'card-hero' : ''}`} style={{ padding: 14 }}>
              <div className="row" style={{ gap: 14, alignItems: 'center' }}>
                <span style={{ fontSize: 24, width: 36, textAlign: 'center' }}>{medal}</span>
                <div>
                  <strong>{e.name}{isMe ? ' (شما)' : ''}</strong>
                  <div className="tiny muted">{e.level}</div>
                </div>
              </div>
              <strong className="num" style={{ color: 'var(--gold)' }}>{formatNumber(e.points)} ژتون</strong>
            </div>
          );
        })}
      </div>

      {entries && entries.length === 0 && <p className="muted">هنوز کسی ژتونی نگرفته است. شما اولین باشید!</p>}

      <div className="card stack-sm" style={{ marginTop: 16 }}>
        <h3>چگونه بالا بیایم؟</h3>
        <ul className="stack-xs small muted">
          <li>ورود روزانه +۲ ژتون</li>
          <li>اولین وعدهٔ روز +۳ ژتون</li>
          <li>مسابقهٔ روزانه (جواب درست +۱۰)</li>
          <li>معرفی دوست +۵۰ ژتون</li>
          <li>ثبت محصول با بارکد +۵ ژتون</li>
        </ul>
      </div>
    </div>
  );
}
