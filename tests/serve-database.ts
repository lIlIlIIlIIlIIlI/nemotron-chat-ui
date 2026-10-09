import { startDatabase } from './d1-fixture';
startDatabase(8788).then(({ worker }) => {
  console.info('Disposable D1 test database ready');
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void worker.dispose().then(() => process.exit(0)); });
}).catch(error => { console.error(error); process.exit(1); });
