// Reads an Apple Health export (export.zip, or export.xml if already unzipped) off the main thread
// and posts back progress and the daily values. Nothing is uploaded from here.
import { Unzip, UnzipInflate } from 'fflate';
import { HealthExportReader } from '@/lib/apple-health/export-file';

export type WorkerMessage =
  | { type: 'progress'; read: number; total: number }
  | { type: 'done'; result: ReturnType<HealthExportReader['finish']> }
  | { type: 'error'; message: string };

const post = (m: WorkerMessage) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (e: MessageEvent<File>) => {
  const file = e.data;
  const reader = new HealthExportReader();
  const decoder = new TextDecoder();
  let found = false;
  let finished = false;
  try {
    const isZip = /\.zip$/i.test(file.name) || file.type.includes('zip');
    let unzip: Unzip | null = null;
    if (isZip) {
      unzip = new Unzip((entry) => {
        // export.xml holds the samples; export_cda.xml and workout routes aren't needed
        if (!/(^|\/)export\.xml$/i.test(entry.name)) return;
        found = true;
        entry.ondata = (err, chunk, final) => {
          if (err) throw err;
          reader.push(decoder.decode(chunk, { stream: !final }));
          if (final) finished = true;
        };
        entry.start();
      });
      unzip.register(UnzipInflate);
    }

    const stream = file.stream().getReader();
    let read = 0;
    let lastPost = 0;
    for (;;) {
      const { value, done } = await stream.read();
      if (value) {
        read += value.length;
        if (unzip) unzip.push(value, false);
        else reader.push(decoder.decode(value, { stream: true }));
      }
      if (done) {
        if (unzip) unzip.push(new Uint8Array(0), true);
        else {
          reader.push(decoder.decode());
          found = finished = true;
        }
        break;
      }
      if (read - lastPost > 4_000_000) {
        lastPost = read;
        post({ type: 'progress', read, total: file.size });
      }
    }
    if (!found) throw new Error('No export.xml inside this file. Choose the export.zip from Health → Export All Health Data.');
    if (!finished) throw new Error('The export ended early. Try exporting again.');
    post({ type: 'progress', read: file.size, total: file.size });
    post({ type: 'done', result: reader.finish() });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : 'Couldn’t read this file.' });
  }
};
