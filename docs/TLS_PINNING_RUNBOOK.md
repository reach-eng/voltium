# TLS Pinning Runbook (FL-12 & SPKI-Class Hardening)

This document provides operational instructions for managing TLS Trust-Anchor Certificate Pinning in the Voltium Flutter Rider application.

---

## 1. Overview

Voltium uses a dual-mode TLS certificate pinning architecture implemented in PinnedHttpInterceptor (lutter/lib/core/network/pinned_http_client.dart):

| Mode (TLS_PIN_MODE) | Description | Target Environment |
|---|---|---|
| ca (Default / Recommended) | **CA Trust-Anchor Pinning**: Restricts SecurityContext anchors to bundled Voltium issuing intermediate/root CA certificates (withTrustedRoots: false). Any connection not chaining to these explicit anchors fails TLS handshake outright (blocks trusted-CA misissuance MITM). | Production Release |
| hash | **Fingerprint Callback Pinning**: Matches SHA-256 hash of server certificate DER against --dart-define=TLS_PIN_SHA256 or dynamic pins. | Emergency Rollback / Legacy |
| off | **Unpinned**: System trust store validation. | Debug Builds Only (throws StateError in Release) |

---

## 2. Certificate Extraction & Provisioning

### 2.1 Extract Issuing Intermediate CA from Server
To extract the issuing intermediate certificate from the live Voltium API host:

`ash
# Connect and dump the full certificate chain
openssl s_client -showcerts -servername api.voltium.in -connect api.voltium.in:443 </dev/null > chain.txt

# Extract the issuing intermediate CA PEM block (typically cert #1 in chain)
openssl x509 -in chain.txt -out voltium-ca.pem
`

### 2.2 Bundle CA Certificate into App Assets
1. Place the intermediate certificate in lutter/assets/certs/voltium-ca.pem.
2. Ensure pubspec.yaml registers the asset:
   `yaml
   flutter:
     assets:
       - assets/certs/
   `

---

## 3. Certificate Rotation (Dual-Anchor Window)

To prevent app bricking during scheduled TLS certificate or CA rotation:

1. **Step 1 (Pre-Rotation Release)**:
   - Obtain the upcoming/new issuing CA certificate.
   - Bundle both current and upcoming certificates in lutter/assets/certs/ (e.g. oltium-ca.pem and oltium-ca-next.pem).
   - Ship app update to riders at least 2 weeks prior to server cert cutover.
2. **Step 2 (Server Cutover)**:
   - Rotate the TLS certificate and intermediate chain on the API gateway / load balancers.
3. **Step 3 (Post-Rotation Cleanup)**:
   - Remove deprecated oltium-ca.pem in the next regular app release.

---

## 4. Building Release APKs

### 4.1 Standard Release Build (ca mode)
`ash
flutter build apk --release \
  --obfuscate --split-debug-info=build/symbols/ \
  --dart-define=TLS_PIN_MODE=ca \
  --dart-define=API_URL=https://api.voltium.in
`

### 4.2 Emergency Rollback Build (hash mode)
In the event of an unexpected CA rotation where clients on older versions lack the new CA anchor:
`ash
flutter build apk --release \
  --obfuscate --split-debug-info=build/symbols/ \
  --dart-define=TLS_PIN_MODE=hash \
  --dart-define=TLS_PIN_SHA256="<sha256_hash_1>,<sha256_hash_2>" \
  --dart-define=API_URL=https://api.voltium.in
`

---

## 5. MITM Proxy Verification Test Recipe

### 5.1 Test Negative Path (Adversarial MITM Rejection)
1. Configure Android device or emulator with mitmproxy / Charles Proxy CA in system or user trust store.
2. Launch release build of Voltium Rider app in TLS_PIN_MODE=ca.
3. Attempt API request to https://api.voltium.in.
4. **Expected Result**: Connection MUST fail with TLS Handshake / Certificate validation error. No HTTP request/response payloads decrypted by mitmproxy.

### 5.2 Test Positive Path (Valid Voltium CA)
1. Run app against live Voltium API server with genuine TLS certificate chain.
2. **Expected Result**: Handshake completes successfully; API endpoints return 200 OK.