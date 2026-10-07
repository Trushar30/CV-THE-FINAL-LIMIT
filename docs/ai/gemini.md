# Google Gemini API Official Documentation & Integration Specification

This document details the official Google Gemini API findings, endpoints, authentication mechanisms, structured output protocols, and error normalization rules relied upon by `GeminiAdapter`.

---

## 1. Official SDK & Direct REST Specifications

### 1.1 SDK and Package Name

- **Current Official Node.js SDK:** `@google/genai` (Current standard recommended by Google; replaces legacy `@google/generative-ai`).
- **Official Documentation Quickstart:** [Google AI for Developers — Gemini API Quickstart](https://ai.google.dev/gemini-api/docs/quickstart)
- **API Reference:** [Gemini API Reference — generateContent](https://ai.google.dev/api/generate-content)
- **Direct REST Interface:** Direct HTTP execution via standard `fetch` against the Google Generative Language REST API (`v1beta`). This approach avoids unnecessary external dependencies, minimizes package footprint, and guarantees complete control over HTTP timeouts, headers, and request aborts.

### 1.2 Base Endpoint & HTTP Methods

- **Base URL:** `https://generativelanguage.googleapis.com/v1beta`
- **Generate Content Endpoint:**
  ```http
  POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
  ```
  _Path parameter `{model}`:_ Model ID (e.g., `gemini-2.5-flash`, `gemini-1.5-flash`). Passed dynamically via configuration, never hardcoded.
- **Model Health / Info Endpoint:**
  ```http
  GET https://generativelanguage.googleapis.com/v1beta/models/{model}
  ```

---

## 2. Authentication & Credential Security

- **Official Header:** `x-goog-api-key: <API_KEY>`
- **Security Requirement:** The API key MUST be passed exclusively via the HTTP header `x-goog-api-key`.
- **Prohibition:** Do NOT pass the API key as a URL query parameter (`?key=...`), as query parameters risk leaking into proxy logs, web server access logs, and error stack traces.
- **Credential Hygiene:** The API key must never be logged, printed to console, or embedded in `AIError` messages or audit entries.

---

## 3. Request Format & Payload Mapping

### 3.1 Mapping `AIRequest` to Gemini REST Body

An incoming internal `AIRequest` maps to Gemini's REST JSON payload as follows:

```json
{
  "system_instruction": {
    "parts": [
      { "text": "<systemInstruction>" }
    ]
  },
  "contents": [
    {
      "role": "user",
      "parts": [
        { "text": "<userInput (with optional context serialized if present)>" }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.2,
    "maxOutputTokens": 2048,
    "responseMimeType": "application/json",
    "responseSchema": { ... }
  }
}
```

### 3.2 Rules:

1. `system_instruction`: Mapped if `systemInstruction` is provided and non-empty.
2. `contents`: Contains a single user message part with `userInput`. If `request.context` is provided, context is prepended or passed as structured context block.
3. `generationConfig.temperature`: Mapped directly from `request.temperature` if specified.
4. `generationConfig.maxOutputTokens`: Mapped directly from `request.maxTokens` if specified.

---

## 4. Structured Output Protocol

- **Official Documentation:** [Gemini API Structured Outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- When `request.outputSchema` is provided:
  - Set `generationConfig.responseMimeType = "application/json"`.
  - Set `generationConfig.responseSchema = request.outputSchema`.
- When `outputSchema` is NOT specified:
  - Omit `responseMimeType` and `responseSchema` (or default to standard plain text generation).
- **Extraction:**
  - Raw text is retrieved from `candidates[0].content.parts[0].text`.
  - When `outputSchema` is requested, `JSON.parse(rawText)` is invoked to produce `structuredData`.

---

## 5. Token Usage Tracking (`usageMetadata`)

- **Official Documentation:** [Gemini API Usage Metadata](https://ai.google.dev/api/generate-content#UsageMetadata)
- Google Gemini returns token metrics in the top-level `usageMetadata` object:
  ```json
  "usageMetadata": {
    "promptTokenCount": 150,
    "candidatesTokenCount": 42,
    "totalTokenCount": 192
  }
  ```
- **Mapping to `AIResponse.usage`:**
  - `inputTokens`: `usageMetadata.promptTokenCount ?? 0`
  - `outputTokens`: `usageMetadata.candidatesTokenCount ?? 0`
  - `totalTokens`: `usageMetadata.totalTokenCount ?? (inputTokens + outputTokens)`

---

## 6. Error Handling & Spec Section 21 / 33 Fallback Taxonomy

The Gemini API communicates errors via standard HTTP status codes and a JSON error payload:

```json
{
  "error": {
    "code": 429,
    "message": "Resource has been exhausted (e.g. check quota).",
    "status": "RESOURCE_EXHAUSTED"
  }
}
```

### 6.1 Mapping Matrix to `AIErrorCategory`

| HTTP Status / Condition  | Gemini Status                          | Category          | Retryable | Fallback Behavior                             |
| ------------------------ | -------------------------------------- | ----------------- | --------- | --------------------------------------------- |
| **429**                  | `RESOURCE_EXHAUSTED`                   | `RATE_LIMIT`      | `true`    | Retry with backoff; fallback after 3 attempts |
| **Timeout / AbortError** | N/A (Client Abort)                     | `TIMEOUT`         | `true`    | Retry with backoff; fallback after 3 attempts |
| **500, 502, 504**        | `INTERNAL`                             | `PROVIDER_ERROR`  | `true`    | Retry with backoff; fallback after 3 attempts |
| **503**                  | `UNAVAILABLE`                          | `UNAVAILABLE`     | `true`    | Retry with backoff; fallback after 3 attempts |
| **Network Failure**      | `fetch failed`, `ECONNRESET`           | `NETWORK`         | `true`    | Retry with backoff; fallback after 3 attempts |
| **401, 403**             | `UNAUTHENTICATED`, `PERMISSION_DENIED` | `AUTH_CONFIG`     | `false`   | **Fast-fail; DO NOT retry; DO NOT fallback**  |
| **400**                  | `INVALID_ARGUMENT`                     | `INVALID_REQUEST` | `false`   | **Fast-fail; DO NOT retry; DO NOT fallback**  |
| **404**                  | `NOT_FOUND`                            | `INVALID_REQUEST` | `false`   | **Fast-fail; DO NOT retry; DO NOT fallback**  |

---

## 7. Timeout Configuration

- Execution uses `AbortController` with `AbortSignal.timeout(timeoutMs)`.
- Default timeout is configurable (e.g. `timeoutMs` option, defaulting to `15000` ms).
- If the abort signal triggers, the caught error is mapped directly to `AIErrorCategory.TIMEOUT` (`retryable: true`).
