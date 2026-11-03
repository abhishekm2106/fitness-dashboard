'use client';

import { cn } from '@/lib/utils';
import { Block, CopyField, Path, Setting, Tip } from './setup-parts';
import { Act, Editor, Pill, SettingsScreen, Shots, Tok } from './shortcut-mock';

// The free daily route: a shortcut the user builds once in Apple's Shortcuts app, run every morning
// by a Time of Day automation. It posts yesterday's totals (and last night's sleep) as flat JSON.

export const SHORTCUT_NAME = 'Send to Master Dashboard';

/** Health types that are totals or averages for the day; each becomes a JSON field of the same name */
const DAILY_BLOCKS: {
  type: string;
  stat: 'Sum' | 'Average';
  key: string;
  core?: boolean;
}[] = [
  { type: 'Steps', stat: 'Sum', key: 'steps', core: true },
  { type: 'Heart Rate Variability', stat: 'Average', key: 'hrv', core: true },
  { type: 'Resting Heart Rate', stat: 'Average', key: 'resting_hr' },
  { type: 'Active Energy', stat: 'Sum', key: 'active_energy' },
  { type: 'Dietary Energy', stat: 'Sum', key: 'calories' },
  { type: 'Protein', stat: 'Sum', key: 'protein' },
  { type: 'Carbohydrates', stat: 'Sum', key: 'carbs' },
  { type: 'Total Fat', stat: 'Sum', key: 'fat' },
];

/** The JSON fields "Get Contents of URL" sends, in order */
const FIELDS: { key: string; kind: 'Text' | 'Number'; from: string }[] = [
  { key: 'date', kind: 'Text', from: 'Day' },
  { key: 'sleep', kind: 'Number', from: 'sleep' },
  ...DAILY_BLOCKS.map((b) => ({
    key: b.key,
    kind: 'Number' as const,
    from: b.key,
  })),
  { key: 'weight', kind: 'Number', from: 'weight' },
  { key: 'body_fat', kind: 'Number', from: 'body_fat' },
];

/** One action as it appears in Shortcuts: its name (what you search for) and how to set it */
function Action({ name, children }: { name: string; children?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-1.5 rounded-[10px] bg-[#141413] px-3 py-2.5 text-[13px]">
      <span className="mt-px w-fit shrink-0 rounded-md bg-[#2c6ee8] px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white">{name}</span>
      <span className="min-w-0 text-subtle">{children}</span>
    </li>
  );
}

/** A recipe block with an illustration of the finished screen beside it (below it on phones) */
function WithMock({ children, mock }: { children: React.ReactNode; mock: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_250px]">
      {children}
      {mock}
    </div>
  );
}

const Row = ({ k, v }: { k: React.ReactNode; v: React.ReactNode }) => (
  <span className="flex items-center justify-between gap-2">
    <span className="text-white/60">{k}</span>
    <span className="truncate">{v}</span>
  </span>
);

const V = ({ children }: { children: React.ReactNode }) => <span className="rounded bg-[#c98500]/20 px-1 font-semibold whitespace-nowrap text-[#f0b445]">{children}</span>;

export function ShortcutRecipe({ url, header }: { url: string; header: string | null }) {
  return (
    <div className="mt-1 flex flex-col gap-4">
      <p className="text-sm text-subtle">
        You&apos;ll build one shortcut that reads yesterday&apos;s Health data and sends it here. Add actions by tapping the search field at the bottom of the editor and typing the
        blue action name. <V>Orange</V> names are variables you create with <b className="text-foreground">Set Variable</b>.
      </p>
      <Tip>
        To put a variable into a field, <b className="text-foreground">press and hold</b> the field, tap <b className="text-foreground">Select Variable</b> and tap the orange name.
        Don&apos;t pick a date from the calendar that opens on a plain tap: the shortcut would send that same day forever.
      </Tip>

      <WithMock mock={<Shots shots={[{ src: '/setup/shortcuts/new-shortcut.webp', caption: 'A new, empty shortcut. Tap its name at the top to rename it.' }]} />}>
        <Block title="1. Create the shortcut" app="In Shortcuts">
          <Path steps={['Shortcuts', '+']} />
          <span className="text-[13px] text-subtle">
            Open the <b className="text-foreground">Shortcuts</b> app, stay on the <b className="text-foreground">Shortcuts</b> tab and tap <b className="text-foreground">+</b> at
            the top right. Tap the name at the top of the new shortcut (with the <b className="text-foreground">⌄</b>), choose <b className="text-foreground">Rename</b>, and call
            it:
          </span>
          <CopyField label="Name it" value={SHORTCUT_NAME} />
        </Block>
      </WithMock>

      <WithMock
        mock={
          <Shots
            shots={[
              { src: '/setup/shortcuts/dates.webp', caption: 'Today and Yesterday saved' },
              { src: '/setup/shortcuts/format-day.webp', caption: 'Noon, then Day. Tap ⌄ on Format to see its options.' },
            ]}
          />
        }
      >
        <Block title="2. Work out the dates">
          <ol className="flex flex-col gap-1.5">
            <Action name="Date">
              Leave it as <b className="text-foreground">Current Date</b>.
            </Action>
            <Action name="Adjust Date">
              Tap the blue operation and choose <b className="text-foreground">Get Start of Day</b>, so it reads &ldquo;Get Start of Day from Date&rdquo;. Then{' '}
              <b className="text-foreground">Set Variable</b> <V>Today</V>.
            </Action>
            <Action name="Adjust Date">
              <b className="text-foreground">Subtract 1 day</b> from <V>Today</V>, then <b className="text-foreground">Set Variable</b> <V>Yesterday</V>.
            </Action>
            <Action name="Adjust Date">
              <b className="text-foreground">Add 12 hours</b> to <V>Yesterday</V>, then <b className="text-foreground">Set Variable</b> <V>Noon</V>. (Sleep is read from here on.)
            </Action>
            <Action name="Format Date">
              Format <V>Noon</V> (it&apos;s on yesterday&apos;s date). Tap <b className="text-foreground">⌄</b> on the action, set Date Format to{' '}
              <b className="text-foreground">Custom</b> and Format String to the text below. Then <b className="text-foreground">Set Variable</b> <V>Day</V>.
            </Action>
          </ol>
          <CopyField label="Format String" value="yyyy-MM-dd" />
        </Block>
      </WithMock>

      <WithMock
        mock={
          <Shots
            shots={[
              { src: '/setup/shortcuts/is-on.webp', caption: 'Tap "is in the last" and choose "is on"' },
              { src: '/setup/shortcuts/steps.webp', caption: 'The finished Steps group. Add one like it per table row.' },
            ]}
          />
        }
      >
        <Block title="3. Read each daily metric">
          <span className="text-[13px] text-subtle">
            Add this group of three actions once per row in the table. Skip the ones you don&apos;t track: steps and active energy come from the iPhone alone, while HRV and resting
            heart rate need an Apple Watch.
          </span>
          <ol className="flex flex-col gap-1.5">
            <Action name="Find Health Samples">
              Set <b className="text-foreground">Type is</b> to the type below. On the <b className="text-foreground">Start Date</b> row, tap{' '}
              <b className="text-foreground">is in the last</b>, choose <b className="text-foreground">is on</b>, then press and hold the date and pick <V>Yesterday</V>. Delete any
              extra row with its <b className="text-foreground">⊖</b>, and set <b className="text-foreground">Group by</b> to <b className="text-foreground">Day</b> (so steps from
              an iPhone and a Watch count once).
            </Action>
            <Action name="Calculate Statistics">The statistic below, of the Health Samples.</Action>
            <Action name="Set Variable">Named exactly as the variable below.</Action>
          </ol>
          <div className="overflow-x-auto rounded-[10px] border border-white/10">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-white/[0.04] text-[11px] tracking-wider text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Statistic</th>
                  <th className="px-3 py-2 font-semibold">Variable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {DAILY_BLOCKS.map((b) => (
                  <tr key={b.key}>
                    <td className="px-3 py-2">
                      {b.type}
                      {b.core && <span className="ml-1.5 text-[11px] text-primary">start here</span>}
                    </td>
                    <td className="px-3 py-2 text-subtle">{b.stat}</td>
                    <td className="px-3 py-2">
                      <V>{b.key}</V>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Block>
      </WithMock>

      <WithMock mock={<Shots shots={[{ src: '/setup/shortcuts/weight.webp', caption: 'The finished Weight group' }]} />}>
        <Block title="4. Yesterday's weight and body fat">
          <ol className="flex flex-col gap-1.5">
            <Action name="Find Health Samples">
              <b className="text-foreground">Type is Weight</b>, <b className="text-foreground">Start Date is on</b> <V>Yesterday</V>. Set Unit to{' '}
              <b className="text-foreground">kg</b>, Sort by <b className="text-foreground">Start Date</b>, Order <b className="text-foreground">Latest First</b>, and turn{' '}
              <b className="text-foreground">Limit</b> on with 1 sample.
            </Action>
            <Action name="Get Details of Health Samples">
              Choose <b className="text-foreground">Value</b>, then <b className="text-foreground">Set Variable</b> <V>weight</V>.
            </Action>
            <Action name="Find Health Samples">
              Optional: the same three actions for <b className="text-foreground">Body Fat Percentage</b> (Unit <b className="text-foreground">%</b>), ending with{' '}
              <b className="text-foreground">Set Variable</b> <V>body_fat</V>.
            </Action>
          </ol>
          <span className="text-xs text-muted-foreground">Only a day you actually weighed in is sent, so an old weight is never repeated as a new one.</span>
        </Block>
      </WithMock>

      <WithMock
        mock={
          <Editor>
            <Act
              kind="health"
              rows={[
                <Row key="t" k="Type" v={<Tok>Sleep</Tok>} />,
                <Row
                  key="a"
                  k="Start Date is between"
                  v={
                    <span>
                      <Pill>Noon</Pill> and <Pill magic>Current Date</Pill>
                    </span>
                  }
                />,
                <Row key="b" k="Value is not" v={<Tok>In Bed</Tok>} />,
                <Row key="c" k="Value is not" v={<Tok>Awake</Tok>} />,
              ]}
            >
              Find <Tok>All Health Samples</Tok> where
            </Act>
            <Act kind="health">
              Get <Tok>Duration</Tok> from <Pill magic>Health Samples</Pill>
            </Act>
            <Act kind="math">
              Calculate <Tok>Sum</Tok> of <Pill magic>Duration</Pill>
            </Act>
            <Act kind="variable">
              Set variable <Pill>sleep</Pill> to <Pill magic>Statistics</Pill>
            </Act>
          </Editor>
        }
      >
        <Block title="5. Last night's sleep">
          <ol className="flex flex-col gap-1.5">
            <Action name="Find Health Samples">
              where <b className="text-foreground">Type</b> is <b className="text-foreground">Sleep</b>, <b className="text-foreground">Start Date is between</b> <V>Noon</V> and{' '}
              <b className="text-foreground">Current Date</b>, <b className="text-foreground">Value</b> is not <b className="text-foreground">In Bed</b>, and{' '}
              <b className="text-foreground">Value</b> is not <b className="text-foreground">Awake</b>.
            </Action>
            <Action name="Get Details of Health Samples">
              <b className="text-foreground">Duration</b>.
            </Action>
            <Action name="Calculate Statistics">
              <b className="text-foreground">Sum</b> of the Durations, then <b className="text-foreground">Set Variable</b> <V>sleep</V>.
            </Action>
          </ol>
          <span className="text-xs text-muted-foreground">Seconds, minutes or hours all work; the dashboard works out which and files it under the morning you woke up.</span>
        </Block>
      </WithMock>

      <WithMock
        mock={
          <Editor>
            <Act
              kind="web"
              rows={[
                <Row key="m" k="Method" v={<Tok>POST</Tok>} />,
                <Row key="h" k="Authorization" v={<Tok>Bearer mdah_…</Tok>} />,
                <Row key="r" k="Request Body" v={<Tok>JSON</Tok>} />,
                <Row key="d" k={<span>date · Text</span>} v={<Pill>Day</Pill>} />,
                <Row key="s" k={<span>sleep · Number</span>} v={<Pill>sleep</Pill>} />,
                <Row key="st" k={<span>steps · Number</span>} v={<Pill>steps</Pill>} />,
                <Row key="more" k="…one field per variable" v="" />,
              ]}
            >
              Get contents of <Tok>{url.replace(/^https?:\/\//, '').slice(0, 28)}…</Tok>
            </Act>
          </Editor>
        }
      >
        <Block title="6. Send it to your dashboard">
          <ol className="flex flex-col gap-1.5">
            <Action name="Get Contents of URL">
              Paste the URL, tap <b className="text-foreground">⌄</b> on the action: Method <b className="text-foreground">POST</b>, add a <b className="text-foreground">Header</b>
              , and set Request Body to <b className="text-foreground">JSON</b> with the fields below.
            </Action>
          </ol>
          <CopyField label="URL" value={url} />
          <div className="grid gap-3">
            <CopyField label="Header key" value="Authorization" />
            {header ? (
              <CopyField label="Header value" value={header} secret />
            ) : (
              <p className="self-end text-[13px] text-subtle">Header value: Bearer followed by your key (step 3).</p>
            )}
          </div>
          <div className="overflow-x-auto rounded-[10px] border border-white/10">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-white/[0.04] text-[11px] tracking-wider text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 font-semibold">Key</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {FIELDS.map((f) => (
                  <tr key={f.key}>
                    <td className="px-3 py-1.5">
                      <code>{f.key}</code>
                    </td>
                    <td className={cn('px-3 py-1.5', f.kind === 'Text' ? 'text-subtle' : 'text-muted-foreground')}>{f.kind}</td>
                    <td className="px-3 py-1.5">
                      <V>{f.from}</V>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <span className="text-xs text-muted-foreground">Leave out fields for metrics you skipped. Key names must match exactly.</span>
        </Block>
      </WithMock>

      <Tip>The first time it runs, the iPhone asks to let Shortcuts read Health and to connect to your dashboard. Allow both.</Tip>
    </div>
  );
}

export function ShortcutSchedule() {
  return (
    <div className="mt-1 flex flex-col gap-4">
      <p className="text-sm text-subtle">Now make the iPhone run the shortcut every morning, without asking.</p>
      <WithMock
        mock={
          <SettingsScreen
            title="Time of Day"
            note="Illustration: the automation's settings"
            rows={[
              { label: 'Time of Day', value: '9:00 AM', on: true },
              { label: 'Repeat', value: 'Daily', on: true },
              { label: 'Run After Confirmation' },
              { label: 'Run Immediately', check: true, on: true },
              { label: 'Notify When Run', toggle: false },
            ]}
            header={<span className="px-1 text-[10.5px] text-white/50">Then tap Next and pick {SHORTCUT_NAME}</span>}
          />
        }
      >
        <Block title="Create a daily automation" app="In Shortcuts">
          <Path steps={['Automation', 'New Automation', 'Time of Day']} />
          <ul className="divide-y divide-white/[0.06]">
            <Setting name="Time of Day" value="9:00 AM" why="A time you've usually unlocked your phone by (see below)." />
            <Setting name="Repeat" value="Daily" why="Sends yesterday's totals and last night's sleep each morning." />
            <Setting name="Run Immediately" value="On" why="Instead of Run After Confirmation, so it doesn't wait for a tap." />
            <Setting name="Notify When Run" value="Off" why="Optional; keeps your mornings quiet." />
          </ul>
          <span className="text-[13px] text-subtle">
            Tap <b className="text-foreground">Next</b> and choose <b className="text-foreground">{SHORTCUT_NAME}</b>.
          </span>
        </Block>
      </WithMock>
      <Tip tone="warn">
        iOS keeps Health data locked while the phone is locked, so a run that happens before you&apos;ve unlocked it can come up empty. If a morning is missed, run the shortcut by
        hand later that day to fill it in.
      </Tip>
    </div>
  );
}
