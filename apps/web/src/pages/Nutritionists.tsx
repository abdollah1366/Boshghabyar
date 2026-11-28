import { useEffect, useState } from 'react';

import { Icon } from '../components/Icon';
import { PageSkeleton } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { formatNumber } from '../lib/format';
import { useDocumentTitle } from '../lib/hooks';

interface Nutritionist {
  id: string;
  name: string;
  bio: string;
  specialties: string;
  city: string;
  priceIRR: number;
  avatarEmoji: string;
  contactPhone: string | null;
  verified: boolean;
}

export function Nutritionists() {
  useDocumentTitle('متخصصان تغذیه');
  const [list, setList] = useState<Nutritionist[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ nutritionists: Nutritionist[] }>('/api/nutritionists')
      .then((r) => setList(r.nutritionists))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <div className="page">
      <header className="stack-sm">
        <h1>متخصصان تغذیه 👩‍⚕️</h1>
        <p className="muted">متخصصان تأییدشدهٔ بشقاب‌یار. برای مشاورهٔ شخصی، با آن‌ها تماس بگیرید یا کدشان را در پروفایل وارد کنید تا گزارش‌های شما را ببینند.</p>
      </header>

      {error && <p className="error">{error}</p>}
      {!list && !error && <PageSkeleton />}

      <div className="grid grid-3">
        {list?.map((n) => (
          <div className="card" key={n.id}>
            <div className="row" style={{ alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 40 }}>{n.avatarEmoji}</span>
              <div>
                <strong>{n.name}</strong>
                {n.verified && <span className="badge badge-success" style={{ marginLeft: 8 }}>تأییدشده</span>}
                <div className="tiny muted">{n.city}</div>
              </div>
            </div>
            <p className="small muted">{n.bio}</p>
            <p className="tiny"><strong>تخصص:</strong> {n.specialties}</p>
            {n.priceIRR > 0 && <p className="small">هزینهٔ مشاوره: {formatNumber(n.priceIRR)} تومان</p>}
            {n.contactPhone && <a className="btn btn-secondary btn-sm" href={`tel:${n.contactPhone}`}><Icon name="phone" size={16} /> تماس</a>}
          </div>
        ))}
      </div>

      {list && list.length === 0 && <p className="muted">هنوز متخصصی ثبت نشده است. اگر متخصص تغذیه هستید، با پشتیبانی تماس بگیرید.</p>}
    </div>
  );
}
