# Kubernetes Probes Configuration

To ensure the Voltium application runs reliably in Kubernetes, you must configure Liveness and Readiness probes.

## Liveness Probe

The liveness probe checks if the node process is alive and responsive. If this fails, Kubernetes will restart the pod.

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 8081
  initialDelaySeconds: 15
  periodSeconds: 20
  timeoutSeconds: 5
  failureThreshold: 3
```

## Readiness Probe

The readiness probe checks if the application is ready to accept traffic. It verifies downstream dependencies like PostgreSQL and local storage volumes. If this fails, the pod is removed from the Service load balancer, but it will not be restarted.

```yaml
readinessProbe:
  httpGet:
    path: /api/ready
    port: 8081
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3
```

## Prometheus Metrics Scraping

Prometheus metrics are exposed via the `/api/metrics` endpoint. You can configure a ServiceMonitor or pod annotations for scraping:

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/path: "/api/metrics"
    prometheus.io/port: "8081"
```
