# Groq API Official Documentation & Integration Specification

This document details the official Groq API findings, endpoints, authentication mechanisms, structured output protocols, and error normalization rules relied upon by `GroqAdapter`.

---

## 1. Official Documentation & REST Specifications

### 1.1 Official Guides & API References

- **Groq Console Documentation:** [Groq Documentation Overview](https://console.groq.com/docs)
- **Chat Completions API Reference:** [Groq Chat Completions Reference](https://console.groq.com/docs/api-reference#chat-create)
- **Structured Outputs & JSON Mode:** [Groq Structured Outputs Guide](https://console.groq.com/docs/structured-outputs)
- **Error Codes Reference:** [Groq Error Codes](https://console.groq.com/docs/error-codes)
- **Models Endpoint:** [Groq List Models Reference](https://console.groq.com/docs/models)

### 1.2 Base Endpoint & HTTP Methods

- **Base URL:** `https://api.groq.com/openai/v1`
- **Chat Completions Endpoint:**
  ```http
  POST https://api.groq.com/openai/v1/chat/completions
  ```
- **Models / Health Check Endpoint:**
  ```http
  GET https://api.groq.com/openai/v1/models/{model}
  ```

---

## 2. Authentication & Credential Security

- **Official Header:** `Authorization: Bearer <GROQ_API_KEY>`
- **Security Requirement:** The API key MUST be passed exclusively via the HTTP `Authorization` header.
- **Credential Hygiene:** The API key must never be logged, printed to console, or embedded in `AIError` messages or audit entries.

---

## 3. Request Format & Payload Mapping

### 3.1 Mapping `AIRequest` to Groq Chat Completions Body

An incoming internal `AIRequest` maps to Groq's JSON payload as follows:

```json
{
  "model": "<configured-model-id>",
  "messages": [
    {
      "role": "system",
      "content": "<systemInstruction>"
    },
    {
      "role": "user",
      "content": "<userInput (with serialized context prepended if present)>"
    }
  ],
  "temperature": 0.2,
  "max_tokens": 2048,
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "structured_response",
      "strict": true,
      "schema": { ... }
    }
  }
}
```

### 3.2 Structured Output Approach & Fallback

- **Native Support:** Groq supports `response_format: { type: "json_schema", json_schema: { name: "...", strict: true, schema: outputSchema } }`.
- **JSON Mode Fallback:** Groq also supports `response_format: { type: "json_object" }`. When `outputSchema` is provided, prompt instructions enforce valid JSON output, and `json_schema` is supplied in `response_format`.
- **Parsing:** Candidate content from `choices[0].message.content` is extracted and parsed with `JSON.parse()`. If parsing fails or output is empty, `GroqAdapter` throws `AIError('...', 'INVALID_REQUEST', 'groq')`.

---

## 4. Token Usage Tracking (`usage`)

Groq returns token consumption in the standard OpenAI-compatible `usage` object:

```json
{
  "usage": {
    "prompt_tokens": 120,
    "completion_tokens": 60,
    "total_tokens": 180
  }
}
```

- **Mapping to `AIResponse.usage`:**
  - `inputTokens`: `usage.prompt_tokens ?? 0`
  - `outputTokens`: `usage.completion_tokens ?? 0`
  - `totalTokens`: `usage.total_tokens ?? (inputTokens + outputTokens)`

---

## 5. Error Handling & Spec Section 21 / 33 Fallback Taxonomy

Groq communicates errors via standard HTTP status codes and JSON error objects:

```json
{
  "error": {
    "message": "Rate limit reached for requests per minute (RPM).",
    "type": "rate_limit_exceeded",
    "code": "rate_limit_exceeded"
  }
}
```

### 5.1 Mapping Matrix to `AIErrorCategory`

| HTTP Status / Condition  | Groq Error Type / Code                      | Category          | Retryable | Fallback Behavior                             |
| ------------------------ | ------------------------------------------- | ----------------- | --------- | --------------------------------------------- |
| **429**                  | `rate_limit_exceeded`, `rate_limit_reached` | `RATE_LIMIT`      | `true`    | Retry with backoff; fallback after 3 attempts |
| **Timeout / AbortError** | N/A (Client Abort)                          | `TIMEOUT`         | `true`    | Retry with backoff; fallback after 3 attempts |
| **500, 502, 504**        | `internal_server_error`, `server_error`     | `PROVIDER_ERROR`  | `true`    | Retry with backoff; fallback after 3 attempts |
| **503**                  | `service_unavailable`                       | `UNAVAILABLE`     | `true`    | Retry with backoff; fallback after 3 attempts |
| **Network Failure**      | `fetch failed`, `ECONNRESET`                | `NETWORK`         | `true`    | Retry with backoff; fallback after 3 attempts |
| **401, 403**             | `invalid_api_key`, `unauthorized`           | `AUTH_CONFIG`     | `false`   | **Fast-fail; DO NOT retry; DO NOT fallback**  |
| **400**                  | `invalid_request_error`                     | `INVALID_REQUEST` | `false`   | **Fast-fail; DO NOT retry; DO NOT fallback**  |
| **404**                  | `model_not_found`, `not_found`              | `INVALID_REQUEST` | `false`   | **Fast-fail; DO NOT retry; DO NOT fallback**  |

---

## 6. Timeout Configuration

- Execution uses `AbortController` with `setTimeout` / `signal`.
- Default timeout is configurable (`timeoutMs`, defaulting to `15000` ms).
- If the abort signal triggers, the caught error is mapped directly to `AIErrorCategory.TIMEOUT` (`retryable: true`).
