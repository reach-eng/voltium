export async function register() {
  // P2-4: fail fast on a production boot with the dev auto-login env var set.
  // The auto-login route was deleted (P0-2), so the flag is dead config now,
  // but a stale env-file mistake must not silently linger in prod. Refuse to
  // boot so operators are forced to clean it up.
  if (process.env.APP_ENV === 'production' && process.env.ENABLE_DEV_ADMIN_LOGIN === 'true') {
    throw new Error(
      'Refusing to start: ENABLE_DEV_ADMIN_LOGIN is set in a production environment. ' +
        'The dev auto-login backdoor was removed; unset this variable.'
    );
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
    const { resourceFromAttributes } = await import('@opentelemetry/resources');
    const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import('@opentelemetry/semantic-conventions');

    const traceExporter = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT })
      : undefined; // Defaults to console if we want to add a ConsoleSpanExporter, but for now we only export if OTLP is configured

    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: 'voltium-web',
        [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.1.0',
      }),
      traceExporter,
      instrumentations: [getNodeAutoInstrumentations()],
    });

    sdk.start();
  }
}
