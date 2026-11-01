import { getDb } from '@/db';
import { getDashboardData, MAIN_LIFTS } from '@/lib/metrics';
import { workoutCount } from '@/lib/sync/hevy';
import styles from './page.module.css';
import SyncButton from './sync-button';

export const dynamic = 'force-dynamic';

const LIFT_NAMES: Record<keyof typeof MAIN_LIFTS, string> = { bench: 'Bench press', squat: 'Squat', deadlift: 'Deadlift', ohp: 'Overhead press' };
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default async function Home() {
  const db = await getDb();
  const [data, total] = await Promise.all([getDashboardData(db), workoutCount(db)]);
  const { week, avatar } = data;

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1>Master Dashboard</h1>
          <p className={styles.sub}>
            Hevy sync{data.sync?.mock ? ' · sample data (HEVY_MOCK=1)' : ''} ·{' '}
            {data.sync ? `last synced ${new Date(data.sync.at).toLocaleString('en-GB')}` : 'never synced'} · {total} workouts stored
          </p>
        </div>
        <SyncButton />
      </header>

      {!data.sync ? (
        <section className={styles.card}>
          <h2>No data yet</h2>
          <p className={styles.sub}>Press Sync now to pull your workouts from Hevy.</p>
        </section>
      ) : (
        <>
          <section className={styles.grid}>
            <div className={styles.card}>
              <h2>This week</h2>
              <p className={styles.big}>{week.sessions} sessions</p>
              <p className={styles.sub}>
                {(week.volumeKg / 1000).toFixed(1)} t lifted · {week.minutes} min · last week {week.prevSessions} sessions, {(week.prevVolumeKg / 1000).toFixed(1)} t
              </p>
            </div>
            <div className={styles.card}>
              <h2>Avatar inputs</h2>
              <p className={styles.big}>{avatar.mode}</p>
              <p className={styles.sub}>
                Body fat {avatar.bodyFatPercent ?? '–'}% · weight {avatar.weightKg ?? '–'} kg · bench/BW {avatar.benchToBodyweight ?? '–'}× · muscle {avatar.muscle}
              </p>
            </div>
            <div className={styles.card}>
              <h2>Recent PRs</h2>
              <ul className={styles.list}>
                {data.prs.slice(0, 4).map((p) => (
                  <li key={`${p.lift}-${p.date}`}>
                    <span>{LIFT_NAMES[p.lift]}</span>
                    <span className={styles.sub}>
                      {p.weightKg} kg × {p.reps} · +{p.gainKg} kg · {fmtDate(p.date)}
                    </span>
                  </li>
                ))}
                {!data.prs.length && <li className={styles.sub}>None yet</li>}
              </ul>
            </div>
          </section>

          <section className={styles.card}>
            <h2>Main lifts · estimated 1RM</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Lift</th>
                  <th scope="col">Sessions</th>
                  <th scope="col">First</th>
                  <th scope="col">Latest</th>
                  <th scope="col">Change</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(MAIN_LIFTS) as (keyof typeof MAIN_LIFTS)[]).map((k) => {
                  const pts = data.lifts[k];
                  const first = pts[0]?.e1rmKg;
                  const last = pts[pts.length - 1]?.e1rmKg;
                  return (
                    <tr key={k}>
                      <td>{LIFT_NAMES[k]}</td>
                      <td>{pts.length}</td>
                      <td>{first ? `${first} kg` : '–'}</td>
                      <td>{last ? `${last} kg` : '–'}</td>
                      <td>{first && last ? `${last - first >= 0 ? '+' : ''}${(last - first).toFixed(1)} kg` : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className={styles.card}>
            <h2>Latest workouts</h2>
            <ul className={styles.list}>
              {data.workouts.slice(0, 8).map((w) => (
                <li key={w.id}>
                  <span>{w.title}</span>
                  <span className={styles.sub}>
                    {fmtDate(w.start)} · {w.durationMin} min · {Math.round(w.volumeKg).toLocaleString('en-US')} kg
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <p className={styles.sub}>
            Full dashboard data as JSON: <a href="/api/dashboard">/api/dashboard</a>
          </p>
        </>
      )}
    </main>
  );
}
